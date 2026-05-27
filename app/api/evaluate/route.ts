import { NextRequest, NextResponse } from "next/server";
import { claudeJSON } from "@/lib/claude";
import {
  EVALUATE_SYSTEM,
  evaluatePrompt,
  shouldWrapUp,
} from "@/lib/prompts";
import type { EvalResult, InterviewPlan } from "@/lib/types";

/**
 * Called by the browser when OpenAI Realtime emits a function_call event.
 *
 * Two function names supported (routed via `action`):
 *   - "evaluate_response": Claude evaluates the candidate's last answer
 *     and returns guidance for the interviewer's next move.
 *   - "check_wrap_up": Deterministic check on coverage + exchange count.
 *     No Claude call needed.
 *
 * The browser sends back the result via conversation.item.create
 * (function_call_output) so Realtime can continue the conversation
 * informed by Claude's evaluation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, plan, args, state } = body as {
      action: "evaluate_response" | "check_wrap_up";
      plan: InterviewPlan;
      args: { candidate_answer?: string; current_topic?: string };
      state: { coverage: Record<string, number>; exchangeCount: number };
    };

    if (action === "check_wrap_up") {
      const result = shouldWrapUp({
        plan,
        coverage: state.coverage,
        exchangeCount: state.exchangeCount,
      });
      return NextResponse.json({ result });
    }

    if (action === "evaluate_response") {
      if (!args.candidate_answer || !args.current_topic) {
        return NextResponse.json(
          { error: "Missing candidate_answer or current_topic" },
          { status: 400 },
        );
      }

      const result = await claudeJSON<EvalResult>({
        system: EVALUATE_SYSTEM,
        user: evaluatePrompt({
          plan,
          currentTopic: args.current_topic,
          candidateAnswer: args.candidate_answer,
          coverage: state.coverage,
          exchangeCount: state.exchangeCount,
        }),
        maxTokens: 800,
        // Use a faster model here — this is the latency-critical path.
        // Sonnet is plenty for the eval task; Opus reserved for prep + scoring.
        model: "claude-sonnet-4-6",
      });

      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("/api/evaluate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
