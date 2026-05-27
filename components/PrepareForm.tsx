"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_JD = `Senior Backend Engineer at Anthropic
- Design and operate distributed systems serving billions of requests
- Strong systems thinking, ownership, debugging skills
- Comfortable with Go or Rust, Kubernetes, observability stacks
- 5+ years experience`;

const EXAMPLE_CV = `Nguyen Van A
Senior Software Engineer, ABC Corp (2020-present)
- Led migration from monolith to microservices
- Built event-driven order processing handling 50k req/min
- Languages: Go, Python, TypeScript
- Open-source contributor to Kafka client library`;

const EXAMPLE_RUBRIC = `Evaluate on:
1. System design (40%) — can they decompose a problem, reason about tradeoffs?
2. Debugging and operations (25%) — production instincts, observability mindset
3. Code quality (20%) — testability, abstractions, simplicity
4. Communication (15%) — clarity, ability to explain to non-experts`;

export default function PrepareForm() {
  const router = useRouter();
  const [jd, setJd] = useState(EXAMPLE_JD);
  const [cv, setCv] = useState(EXAMPLE_CV);
  const [rubric, setRubric] = useState(EXAMPLE_RUBRIC);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd, cv, rubric }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const { plan } = await res.json();
      sessionStorage.setItem("interview_plan", JSON.stringify(plan));
      router.push("/interview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Field label="Job description" value={jd} onChange={setJd} rows={6} />
      <Field label="Candidate CV" value={cv} onChange={setCv} rows={6} />
      <Field label="Rubric" value={rubric} onChange={setRubric} rows={5} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full rounded-md bg-amber-600 px-4 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Preparing interview…" : "Start interview"}
      </button>

      <p className="text-xs text-neutral-500">
        Claude (Opus) generates the interview plan in ~3-6 seconds. The plan
        includes skill areas, persona, opener, and first question.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </label>
  );
}
