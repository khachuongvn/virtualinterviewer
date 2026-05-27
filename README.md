# Virtual Interviewer

Real-time AI interviewer dùng **Claude (brain) + OpenAI Realtime (voice) + LiveKit Cloud (transport) + Rive (avatar)**.
Pattern lấy từ Duolingo Lily: tách prep / live / eval, function calling để Realtime "hỏi" Claude trong lúc nói chuyện.

Toàn bộ TypeScript — Next.js cho UI + APIs, LiveKit Agents Node.js cho worker.

## Architecture

```
┌─ Phase 1: Prepare (Claude) ─────────────────────────────────────────┐
│  Browser ──POST /api/prepare──► Claude Opus ──► InterviewPlan       │
│            (JD + CV + Rubric)                  (skills, persona,    │
│                                                  opener, first Q)   │
└─────────────────────────────────────────────────────────────────────┘

┌─ Phase 2: Live (LiveKit room with 2 participants) ──────────────────┐
│                                                                      │
│  ┌─────────┐   WebRTC    ┌─────────────┐    WebRTC   ┌────────────┐ │
│  │ Browser │ ──audio───► │  LiveKit    │ ◄──audio─── │  Agent     │ │
│  │         │ ◄─audio───  │  Cloud      │  ──audio─►  │  (Node TS) │ │
│  │         │ ──data────► │  (room with │ ◄──data───  │            │ │
│  │ + Rive  │ ◄─data────  │  plan meta) │  ──data─►   │ (uses      │ │
│  └─────────┘             └─────────────┘             │ OpenAI     │ │
│                                                       │ Realtime)  │ │
│                                                       └─────┬──────┘ │
│                                                             │        │
│  Agent function calls during conversation:                  │        │
│     evaluate_response ──HTTP──► /api/evaluate ──► Claude    │        │
│     check_wrap_up    (local deterministic)                  │        │
│                                                             │        │
│  Agent data messages to browser:                            │        │
│     {type:"state", value:"listening"|"thinking"|...}        │        │
│     {type:"reaction", value:"impressed"|...}                │        │
│     {type:"transcript", role, text}                         │        │
│     {type:"end", transcript:[...]} ─► triggers Phase 3      │        │
└─────────────────────────────────────────────────────────────────────┘

┌─ Phase 3: Score (Claude) ───────────────────────────────────────────┐
│  Browser ──POST /api/score──► Claude Opus ──► InterviewReport       │
│            (plan + transcript)                (scores, facts)       │
└─────────────────────────────────────────────────────────────────────┘
```

**Tại sao tách Browser ↔ Agent qua LiveKit?**

Next.js API routes là serverless functions ngắn hạn — không giữ được WebRTC connection. Agent là Node process chạy lâu dài, kết nối vào room như participant thứ hai. LiveKit Cloud handle WebRTC plumbing, NAT traversal, turn detection, interruption.

Browser KHÔNG bao giờ thấy `OPENAI_API_KEY` hay `ANTHROPIC_API_KEY`. Mọi key sống server-side.

## Setup

### 1. Tạo accounts

- [LiveKit Cloud](https://cloud.livekit.io) — tạo project, lấy `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- [Anthropic Console](https://console.anthropic.com) — lấy `ANTHROPIC_API_KEY`
- [OpenAI Platform](https://platform.openai.com) — lấy `OPENAI_API_KEY` (Realtime API needs gpt-realtime access)

### 2. Install

```bash
npm install
# hoặc pnpm install nếu có pnpm
cp .env.example .env.local
# Điền các keys vào .env.local
```

### 3. Run

Một lệnh chạy cả Next.js + LiveKit agent worker:

```bash
npm run dev
```

Output sẽ có 2 màu: `[web]` (vàng) và `[agent]` (xanh). Agent register với LiveKit Cloud và chờ jobs. Mở http://localhost:3000, điền form, click Start.

Nếu cần debug riêng:
```bash
npm run dev:web      # chỉ Next.js
npm run dev:agent    # chỉ agent worker
```

Production:
```bash
npm run build
npm run start        # chạy cả 2
```

## Project structure

```
app/
  page.tsx                  Landing — JD/CV/rubric form
  interview/page.tsx        Live interview UI
  results/page.tsx          Post-interview report
  api/
    prepare/route.ts        Phase 1 — Claude generates plan
    livekit-token/route.ts  Mint JWT, create room with plan metadata
    evaluate/route.ts       Called by agent during conversation → Claude
    score/route.ts          Phase 3 — Claude scores transcript

agent/
  agent.ts                  LiveKit worker (defineAgent + RealtimeModel + tools)
  README.md

components/
  PrepareForm.tsx           JD/CV input
  InterviewSession.tsx      LiveKit Web SDK + Rive state driver
  InterviewerAvatar.tsx     Rive component (wired to State Machine 1)

lib/
  prompts.ts                ⭐ All prompts. Shared between Next.js + agent.
  claude.ts                 Anthropic SDK wrapper
  types.ts                  Shared TypeScript types

public/
  avatar.riv                Rive character file
```

## Rive avatar

The included `public/avatar.riv` is from Rive Community. State machine inputs:

- `Hear` (bool) — set to `true` when candidate is speaking
- `Talk` (bool) — set to `true` when interviewer is speaking
- `Look` (number) — gaze direction / reaction variant
- `Check` (trigger) — fires on reaction events

For more accurate lip sync (phoneme-level like Duolingo), add a `mouth_open` number input in Rive Editor and feed it from `AudioContext.AnalyserNode` amplitude on the agent's audio track. The hook is mentioned but not wired in `InterviewerAvatar.tsx`.

## Mở rộng

- **Memory across rounds**: lưu `updated_facts` từ Phase 3 vào Postgres/Supabase, query trong Phase 1 prep
- **Recording**: bật LiveKit Egress để ghi audio + transcript ra S3
- **Multi-language**: thay `voice` của Realtime, đổi instructions sang VI/EN dynamic
- **Behavioral mode**: prompt template khác cho behavioral vs technical
- **Code-pairing mode**: share screen + thêm tool `read_candidate_code` để Claude phân tích code đang viết
- **Live transcription confidence**: feed Realtime's transcript events vào UI để user thấy mình đang nói gì
