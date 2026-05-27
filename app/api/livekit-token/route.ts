import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { InterviewPlan } from "@/lib/types";

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

    // 1. Create room with plan as metadata (so agent can read it on connect)
    const roomName = `interview-${crypto.randomUUID()}`;
    const httpUrl = url.replace(/^wss?:\/\//, "https://");
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);

    await svc.createRoom({
      name: roomName,
      metadata: JSON.stringify({ plan }),
      emptyTimeout: 300, // close room 5min after last participant leaves
      maxParticipants: 2, // candidate + agent
    });

    // 2. Mint JWT for candidate
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `candidate-${Date.now()}`,
      name: "Candidate",
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
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
