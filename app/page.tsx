import PrepareForm from "@/components/PrepareForm";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Virtual Interviewer</h1>
        <p className="mt-2 text-neutral-600">
          Real-time AI interviewer. Claude designs the questions, OpenAI Realtime
          handles the voice, and an avatar reacts to your answers.
        </p>
      </div>
      <PrepareForm />
    </main>
  );
}
