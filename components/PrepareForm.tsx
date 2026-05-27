"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_JD = `Senior QA Engineer — Công ty Fintech ABC
- Thiết kế test plan & test case cho hệ thống thanh toán/ví điện tử
- Kiểm thử thủ công lẫn tự động hoá (web + mobile iOS/Android)
- Xây dựng và duy trì automation framework (Selenium/Cypress/Appium)
- Tích hợp test vào CI/CD pipeline (Jenkins, GitHub Actions)
- Phối hợp với dev/PM/BA trong môi trường Agile/Scrum
- Yêu cầu: 4+ năm kinh nghiệm QA, hiểu API testing (Postman), SQL cơ bản
- Ưu tiên: có chứng chỉ ISTQB, từng test sản phẩm fintech/ngân hàng`;

const EXAMPLE_CV = `Phạm Thị Yến — QA Engineer
Email: yen.pham@example.com | 5 năm kinh nghiệm

DevUP (2022 – nay) — Senior QA Engineer
- Phụ trách kiểm thử ứng dụng ví điện tử (Android, iOS, web)
- Viết và maintain ~400 automation test case bằng Cypress + Appium
- Tích hợp test suite vào Jenkins, giảm thời gian regression từ 2 ngày xuống 4 tiếng
- Review test plan cho team 6 QA, mentor 2 junior

VietDevelopers (2020 – 2022) — QA Engineer
- Manual test cho e-commerce platform (~50k DAU)
- Thiết kế test case cho luồng checkout, payment gateway tích hợp VNPay/Momo
- Báo cáo và theo dõi bug trên Jira, viết test report hàng sprint

Kỹ năng:
- Manual testing, automation (Cypress, Selenium, Appium)
- API testing: Postman, Newman
- SQL: PostgreSQL, MySQL (truy vấn cơ bản đến trung bình)
- CI/CD: Jenkins, GitHub Actions
- Chứng chỉ ISTQB Foundation Level (2021)`;

const EXAMPLE_RUBRIC = `Đánh giá ứng viên QA theo các tiêu chí:

1. Tư duy kiểm thử (35%) — khả năng phân tích yêu cầu, thiết kế test case có độ phủ tốt, nghĩ ra edge case mà dev dễ bỏ sót.

2. Kỹ năng automation (30%) — kinh nghiệm thực tế với framework, biết khi nào nên automate vs manual, cách viết test ổn định (giảm flakiness).

3. Hiểu biết về hệ thống (20%) — hiểu cơ bản về API, database, CI/CD; biết cách debug khi test fail không rõ do bug hay do môi trường.

4. Giao tiếp & teamwork (15%) — diễn đạt bug rõ ràng, biết khi nào escalate, phối hợp tốt với dev/PM trong sprint.`;

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
