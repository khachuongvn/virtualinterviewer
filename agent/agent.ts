/**
 * LiveKit agent for the virtual interviewer.
 *
 * Runs as a worker that picks up jobs from LiveKit Cloud. On each job:
 *   1. Read the interview plan from room.metadata
 *   2. Configure OpenAI Realtime with persona + blueprint + first question
 *   3. Register function tools (evaluate_response, check_wrap_up) that
 *      HTTP-call the Next.js /api/evaluate endpoint (Claude lives there).
 *   4. Publish state messages over LiveKit data channel so the browser
 *      can drive the Rive avatar (listening / thinking / talking / reaction).
 *   5. On disconnect, publish the full transcript as a final data message
 *      so the browser can POST it to /api/score.
 *
 * Run locally:
 *     pnpm agent:dev
 *
 * Deploy to production:
 *     pnpm agent:start    (or run as container)
 */

import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { BackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import dotenv from "dotenv";

import type { InterviewPlan } from "../lib/types.js";
import { realtimeInstructions, shouldWrapUp } from "../lib/prompts.js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

// ─────────────────────────────────────────────────────────────────────────────
// Avatar state publishing — drives Rive state machine in the browser
// ─────────────────────────────────────────────────────────────────────────────

type AvatarMessage =
  | { type: "state"; value: "idle" | "listening" | "thinking" | "talking" }
  | { type: "reaction"; value: "impressed" | "skeptical" | "encouraging" }
  | { type: "transcript"; role: "interviewer" | "candidate"; text: string }
  | { type: "end"; transcript: Array<{ role: string; text: string; topic?: string }> };

function makeAvatar(ctx: JobContext) {
  return {
    async publish(msg: AvatarMessage) {
      try {
        const encoder = new TextEncoder();
        await ctx.room.localParticipant?.publishData(
          encoder.encode(JSON.stringify(msg)),
          { reliable: true },
        );
      } catch (err) {
        console.warn("publishData failed:", err);
      }
    },
    state(value: "idle" | "listening" | "thinking" | "talking") {
      return this.publish({ type: "state", value });
    },
    reaction(value: "impressed" | "skeptical" | "encouraging") {
      return this.publish({ type: "reaction", value });
    },
    transcript(role: "interviewer" | "candidate", text: string) {
      return this.publish({ type: "transcript", role, text });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP call to Next.js /api/evaluate (where Claude actually runs)
// ─────────────────────────────────────────────────────────────────────────────

async function callClaudeEvaluate(
  plan: InterviewPlan,
  state: { coverage: Record<string, number>; exchangeCount: number },
  args: { candidate_answer: string; current_topic: string },
) {
  const res = await fetch(`${APP_URL}/api/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "evaluate_response", plan, state, args }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`evaluate failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent entrypoint
// ─────────────────────────────────────────────────────────────────────────────

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Pre-load Silero VAD to speed up cold starts
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    console.log(`Agent starting for room ${ctx.room.name}`);
    await ctx.connect();

    // Read interview plan from room metadata (set by /api/livekit-token)
    let plan: InterviewPlan;
    try {
      const meta = JSON.parse(ctx.room.metadata || "{}");
      plan = meta.plan;
      if (!plan?.persona) throw new Error("No plan in metadata");
    } catch (err) {
      console.error("Failed to parse room metadata:", err);
      return;
    }
    console.log(`Loaded plan with ${plan.skill_areas.length} skill areas`);

    const participant = await ctx.waitForParticipant();
    console.log(`Candidate joined: ${participant.identity}`);

    const avatar = makeAvatar(ctx);
    const conversationState = {
      coverage: {} as Record<string, number>,
      exchangeCount: 0,
    };
    const transcript: Array<{ role: string; text: string; topic?: string }> = [];

    // ── Tools ───────────────────────────────────────────────────────────────

    const evaluateResponse = llm.tool({
      description:
        "Call after EACH substantive candidate answer. Returns guidance: " +
        "depth_score (1-5), should_probe (bool), probe_hint, next_topic, reaction.",
      parameters: z.object({
        candidate_answer: z
          .string()
          .describe("The candidate's most recent spoken answer, verbatim or close to it"),
        current_topic: z
          .string()
          .describe("The skill area currently being discussed (one of plan.skill_areas[].name)"),
      }),
      execute: async ({ candidate_answer, current_topic }) => {
        await avatar.state("thinking");
        conversationState.exchangeCount += 1;
        transcript.push({ role: "candidate", text: candidate_answer, topic: current_topic });
        await avatar.transcript("candidate", candidate_answer);

        try {
          const result = await callClaudeEvaluate(plan, conversationState, {
            candidate_answer,
            current_topic,
          });

          // Update coverage
          if (typeof result.depth_score === "number") {
            const prev = conversationState.coverage[current_topic] ?? 0;
            conversationState.coverage[current_topic] = prev + result.depth_score;
          }

          // Drive reaction layer
          if (result.reaction && result.reaction !== "neutral") {
            await avatar.reaction(result.reaction);
          }

          return JSON.stringify(result);
        } catch (err) {
          console.error("evaluate_response error:", err);
          return JSON.stringify({
            depth_score: 3,
            should_probe: false,
            reaction: "neutral",
            reasoning: "evaluation_failed_fallback",
          });
        }
      },
    });

    const checkWrapUp = llm.tool({
      description:
        "Check if the interview should wrap up. Call every 4-5 exchanges. " +
        "Returns { should_wrap: bool, reason: string }.",
      parameters: z.object({}),
      execute: async () => {
        // Deterministic — no Claude call needed
        const result = shouldWrapUp({
          plan,
          coverage: conversationState.coverage,
          exchangeCount: conversationState.exchangeCount,
        });
        return JSON.stringify(result);
      },
    });

    // ── Build agent + session ───────────────────────────────────────────────

    const interviewer = new voice.Agent({
      instructions: realtimeInstructions(plan),
      tools: { evaluate_response: evaluateResponse, check_wrap_up: checkWrapUp },
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: REALTIME_VOICE,
        // Server VAD via OpenAI Realtime API
        turnDetection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
        },
      }),
    });

    // ── Wire session events → avatar state ──────────────────────────────────

    session.on("user_started_speaking", () => {
      void avatar.state("listening");
    });
    session.on("user_stopped_speaking", () => {
      void avatar.state("thinking");
    });
    session.on("agent_started_speaking", () => {
      void avatar.state("talking");
    });
    session.on("agent_stopped_speaking", () => {
      void avatar.state("idle");
    });

    // Capture interviewer turns for transcript
    session.on("conversation_item_added", (item: any) => {
      if (item?.role === "assistant" && typeof item?.content === "string") {
        transcript.push({ role: "interviewer", text: item.content });
        void avatar.transcript("interviewer", item.content);
      }
    });

    // ── Start ───────────────────────────────────────────────────────────────

    await session.start({
      agent: interviewer,
      room: ctx.room,
      inputOptions: {
        // Noise cancellation greatly improves VAD accuracy on real laptops
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });
    await avatar.state("idle");

    // ── Wait for candidate to disconnect ────────────────────────────────────

    await new Promise<void>((resolve) => {
      ctx.room.on("participantDisconnected", (p) => {
        if (p.identity === participant.identity) resolve();
      });
    });

    console.log("Candidate left; publishing final transcript");
    await avatar.publish({ type: "end", transcript });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
