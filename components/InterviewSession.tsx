"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import type { InterviewPlan, TranscriptTurn } from "@/lib/types";
import InterviewerAvatar, {
  type AvatarState,
  type Reaction,
} from "./InterviewerAvatar";

/**
 * Owns the live interview session:
 *   1. POST /api/livekit-token to mint a JWT (room metadata = plan)
 *   2. Connect to LiveKit room
 *   3. Publish microphone
 *   4. Subscribe to agent's audio track (plays through hidden <audio>)
 *   5. Listen for agent's data messages:
 *        - {type: "state"}      → drives the avatar
 *        - {type: "reaction"}   → triggers reaction layer
 *        - {type: "transcript"} → appended to live transcript
 *        - {type: "end"}        → routes to /results
 */
export default function InterviewSession({ plan }: { plan: InterviewPlan }) {
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const audioMountRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<AvatarState>("idle");
  const [reaction, setReaction] = useState<Reaction>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let room: Room | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const tokenRes = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        if (!tokenRes.ok) {
          const j = await tokenRes.json().catch(() => ({}));
          throw new Error(j.error || `Token request failed: ${tokenRes.status}`);
        }
        const { token, url } = await tokenRes.json();
        if (cancelled) return;

        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        // Agent → browser data messages
        room.on(RoomEvent.DataReceived, (payload) => {
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload));
            handleAgentMessage(msg);
          } catch (e) {
            console.warn("Bad data message", e);
          }
        });

        // Auto-attach agent's published audio track
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio && audioMountRef.current) {
            const el = track.attach() as HTMLAudioElement;
            el.autoplay = true;
            audioMountRef.current.innerHTML = "";
            audioMountRef.current.appendChild(el);
          }
        });

        await room.connect(url, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        setConnected(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      room?.disconnect();
    };
  }, [plan]);

  function handleAgentMessage(msg: any) {
    if (msg.type === "state") {
      setState(msg.value);
    } else if (msg.type === "reaction") {
      setReaction(msg.value);
      // Reaction is a transient overlay
      setTimeout(() => setReaction(null), 2500);
    } else if (msg.type === "transcript") {
      setTranscript((prev) => [
        ...prev,
        {
          role: msg.role === "interviewer" ? "interviewer" : "candidate",
          text: msg.text,
          timestamp: Date.now(),
        },
      ]);
    } else if (msg.type === "end") {
      // Final transcript from agent
      sessionStorage.setItem(
        "interview_transcript",
        JSON.stringify(msg.transcript),
      );
      router.push("/results");
    }
  }

  async function handleEnd() {
    await roomRef.current?.disconnect();
    // Agent will publish "end" on disconnect, which routes us.
    // Fallback in case agent is slow:
    setTimeout(() => {
      sessionStorage.setItem(
        "interview_transcript",
        JSON.stringify(transcript),
      );
      router.push("/results");
    }, 4000);
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
        <strong>Connection error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_3fr]">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <InterviewerAvatar state={state} reaction={reaction} />
        <div className="mt-4 flex items-center justify-between">
          <StateIndicator state={state} connected={connected} />
          <button
            onClick={handleEnd}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            End interview
          </button>
        </div>
        <div ref={audioMountRef} className="hidden" />
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-neutral-600">Live transcript</h2>
        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
          {transcript.length === 0 && (
            <p className="text-sm text-neutral-400">
              Waiting for conversation to start…
            </p>
          )}
          {transcript.map((t, i) => (
            <div key={i}>
              <span
                className={`block text-xs uppercase tracking-wide ${
                  t.role === "interviewer" ? "text-neutral-400" : "text-amber-600"
                }`}
              >
                {t.role}
              </span>
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-800">
                {t.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StateIndicator({
  state,
  connected,
}: {
  state: AvatarState;
  connected: boolean;
}) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
        Connecting…
      </span>
    );
  }
  const labels: Record<AvatarState, [string, string]> = {
    idle: ["Ready", "bg-neutral-400"],
    listening: ["Listening", "bg-emerald-500 animate-pulse"],
    thinking: ["Thinking", "bg-amber-500 animate-pulse"],
    talking: ["Speaking", "bg-blue-500"],
  };
  const [label, dot] = labels[state];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-neutral-700">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
