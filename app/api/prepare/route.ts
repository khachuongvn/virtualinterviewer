import { NextRequest, NextResponse } from "next/server";
import { claudeJSON } from "@/lib/claude";
import { PREPARE_SYSTEM, preparePrompt } from "@/lib/prompts";
import type { InterviewPlan } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { jd, cv, rubric, priorFacts } = await req.json();

    if (!jd || !cv || !rubric) {
      return NextResponse.json(
        { error: "Missing jd, cv, or rubric" },
        { status: 400 },
      );
    }

    const plan = await claudeJSON<InterviewPlan>({
      system: PREPARE_SYSTEM,
      user: preparePrompt({ jd, cv, rubric, priorFacts }),
      maxTokens: 2000,
    });

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("/api/prepare error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
