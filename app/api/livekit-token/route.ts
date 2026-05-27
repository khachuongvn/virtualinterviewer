import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import type { InterviewPlan } from "@/lib/types";

// Must match WorkerOptions.agentName in agent/agent.ts. The worker runs in
// explicit-dispatch mode (it only accepts jobs whose agentName matches), so
// every issued JWT must include a RoomAgentDispatch entry for this name.
const AGENT_NAME = "interviewer";

/**
 * Browser calls this with the interview plan after /api/prepare.
 * We:
 *   1. Create a LiveKit room with the plan stuffed into room.metadata
 *   2. Mint a JWT for the candidate to join
 *
 * The Python agent connects to the same room and reads the plan
 * from room.metadata. No need to ship the plan over data channels.
 */
export async function POST(req: NextRequest) {
  try {
    const { plan } = (await req.json()) as { plan: InterviewPlan };

    if (!plan) {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 },
      );
    }

    // Build a JWT that, on first join, creates the room with the right
    // metadata AND dispatches the interviewer agent. No pre-create call,
    // so there is no window where a stale empty room can claim the worker.
    const roomName = `interview-${crypto.randomUUID()}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: `candidate-${Date.now()}`,
      name: "Candidate",
    });
    at.addGrant({
      roomJoin: true,
      roomCreate: true, // candidate's join creates the room via roomConfig
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    at.roomConfig = new RoomConfiguration({
      name: roomName,
      emptyTimeout: 300, // close room 5min after last participant leaves
      maxParticipants: 2, // candidate + agent
      metadata: JSON.stringify({ plan }),
      agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
    });

    const token = await at.toJwt();

    return NextResponse.json({ token, room: roomName, url });
  } catch (err) {
    console.error("/api/livekit-token error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
