import { NextRequest, NextResponse } from "next/server";
import { claudeJSON } from "@/lib/claude";
import { SCORE_SYSTEM, scorePrompt } from "@/lib/prompts";
import type { InterviewPlan, InterviewReport, TranscriptTurn } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { plan, transcript } = (await req.json()) as {
      plan: InterviewPlan;
      transcript: TranscriptTurn[];
    };

    if (!plan || !transcript?.length) {
      return NextResponse.json(
        { error: "Missing plan or transcript" },
        { status: 400 },
      );
    }

    // Format transcript as readable text
    const formatted = transcript
      .map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.text}`)
      .join("\n\n");

    const report = await claudeJSON<InterviewReport>({
      system: SCORE_SYSTEM,
      user: scorePrompt({ plan, transcript: formatted }),
      maxTokens: 3000,
    });

    return NextResponse.json({ report });
  } catch (err) {
    console.error("/api/score error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
