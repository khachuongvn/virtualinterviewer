import PrepareForm from "@/components/PrepareForm";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Phỏng vấn ảo</h1>
        <p className="mt-2 text-neutral-600">
          Buổi phỏng vấn tự động bằng giọng nói. Hệ thống dựa trên hồ sơ ứng
          viên và mô tả công việc để tạo bộ câu hỏi phù hợp, sau đó trò chuyện
          và đánh giá ứng viên theo thời gian thực.
        </p>
      </div>
      <PrepareForm />
    </main>
  );
}
