# Agent

LiveKit worker (Node.js/TypeScript) running OpenAI Realtime + calling Claude for evaluation.

Chạy chung với Next.js qua `npm run dev` (root). Chạy riêng:

```bash
npm run dev:agent      # development
npm run start:agent    # production
```

## What it does

1. Picks up a job when a browser joins a LiveKit room
2. Reads `plan` from `room.metadata` (set by `/api/livekit-token`)
3. Spawns an `AgentSession` with `openai.realtime.RealtimeModel`
4. Exposes 2 tools to the model:
   - `evaluate_response` → HTTP POST to Next.js `/api/evaluate` → Claude
   - `check_wrap_up` → local deterministic check on coverage
5. Publishes data messages for avatar state (`state`, `reaction`, `transcript`)
6. On candidate disconnect, publishes `{type: "end", transcript}` so the browser can POST to `/api/score`

## Why a separate process

Next.js API routes are short-lived serverless functions — they can't hold a WebRTC connection. The agent is a long-running Node process that maintains a LiveKit room connection and orchestrates the conversation. They share prompts and types via the `lib/` directory.
