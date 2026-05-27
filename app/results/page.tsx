"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { InterviewPlan, InterviewReport } from "@/lib/types";

export default function ResultsPage() {
  const router = useRouter();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const planRaw = sessionStorage.getItem("interview_plan");
    const transcriptRaw = sessionStorage.getItem("interview_transcript");
    if (!planRaw || !transcriptRaw) {
      router.replace("/");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: JSON.parse(planRaw),
            transcript: JSON.parse(transcriptRaw),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Scoring failed: ${res.status}`);
        }
        const { report } = await res.json();
        setReport(report);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        Đang chấm điểm buổi phỏng vấn…
      </main>
    );
  }

  const recColor =
    report.overall.recommendation === "strong_yes" ? "text-emerald-700" :
    report.overall.recommendation === "yes" ? "text-emerald-600" :
    report.overall.recommendation === "lean_no" ? "text-amber-700" :
    "text-red-700";

  const recLabel: Record<typeof report.overall.recommendation, string> = {
    strong_yes: "Rất nên tuyển",
    yes: "Nên tuyển",
    lean_no: "Cân nhắc kỹ",
    no: "Không nên tuyển",
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Báo cáo phỏng vấn</h1>
        <p className="mt-3 text-xs uppercase tracking-wide text-neutral-500">
          Đề xuất
        </p>
        <p className={`text-2xl font-medium ${recColor}`}>
          {recLabel[report.overall.recommendation]}
        </p>
      </div>

      <Card title="Tóm tắt">
        <p className="text-neutral-700">{report.overall.summary}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Điểm mạnh" tone="emerald">
          <List items={report.overall.strengths} />
        </Card>
        <Card title="Điểm cần lưu ý" tone="amber">
          <List items={report.overall.weaknesses} />
        </Card>
      </div>

      <Card title="Điểm theo kỹ năng">
        <div className="space-y-4">
          {report.skill_scores.map((s, i) => (
            <div key={i} className="border-l-2 border-amber-200 pl-3">
              <div className="flex items-baseline justify-between">
                <h4 className="font-medium">{s.name}</h4>
                <span className="text-sm tabular-nums">{s.score}/5</span>
              </div>
              <p className="mt-1 text-sm text-neutral-700">
                <span className="font-medium">Dẫn chứng:</span> {s.evidence}
              </p>
              {s.concerns && (
                <p className="mt-1 text-sm text-neutral-500">
                  <span className="font-medium">Lưu ý:</span> {s.concerns}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Thông tin cần ghi nhớ cho vòng sau">
        <List items={report.updated_facts} muted />
      </Card>

      <button
        onClick={() => {
          sessionStorage.clear();
          router.push("/");
        }}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Bắt đầu phỏng vấn mới
      </button>
    </main>
  );
}

function Card({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "emerald" | "amber";
}) {
  const titleClass =
    tone === "emerald" ? "text-emerald-700" :
    tone === "amber" ? "text-amber-700" :
    "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className={`mb-3 text-sm font-medium ${titleClass}`}>{title}</h2>
      {children}
    </div>
  );
}

function List({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className={`space-y-1 text-sm ${muted ? "text-neutral-600" : "text-neutral-800"}`}>
      {items.map((s, i) => (
        <li key={i}>• {s}</li>
      ))}
    </ul>
  );
}
