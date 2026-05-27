// Shared types across client + server

export type SkillArea = {
  name: string;
  must_probe: string[]; // sub-topics to dig into
  weight: number;       // 0-1, sums to ~1 across areas
};

export type Persona = {
  name: string;
  role: string;         // "Senior backend engineer", "Engineering manager"
  tone: string;         // "warm but probing", "rigorous, slightly skeptical"
};

export type InterviewPlan = {
  skill_areas: SkillArea[];
  persona: Persona;
  candidate_summary: string;
  opener: string;
  first_question: string;
  max_exchanges: number; // soft cap before wrap-up suggested
};

export type TranscriptTurn = {
  role: "interviewer" | "candidate";
  text: string;
  topic?: string;
  timestamp: number;
};

// Result returned by /api/evaluate (called by Realtime function call)
export type EvalResult = {
  depth_score: 1 | 2 | 3 | 4 | 5;
  should_probe: boolean;
  probe_hint?: string;   // what to ask next if probing
  next_topic?: string;   // if moving on, which skill area
  reaction: "impressed" | "skeptical" | "encouraging" | "neutral";
  reasoning: string;     // for debugging, not shown to candidate
};

export type WrapUpResult = {
  should_wrap: boolean;
  reason: string;
};

// Final scoring output from /api/score
export type InterviewReport = {
  skill_scores: Array<{
    name: string;
    score: number; // 1-5
    evidence: string;
    concerns: string;
  }>;
  overall: {
    recommendation: "strong_yes" | "yes" | "lean_no" | "no";
    strengths: string[];
    weaknesses: string[];
    summary: string;
  };
  updated_facts: string[]; // for next round's prep
};
