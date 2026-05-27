"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { InterviewPlan } from "@/lib/types";
import InterviewSession from "@/components/InterviewSession";

export default function InterviewPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<InterviewPlan | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("interview_plan");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setPlan(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!plan) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Đang tải buổi phỏng vấn…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {plan.persona.name}
        </h1>
        <p className="text-sm text-neutral-600">{plan.persona.role}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Chủ đề: {plan.skill_areas.map((a) => a.name).join(" · ")}
        </p>
      </div>
      <InterviewSession plan={plan} />
    </main>
  );
}
