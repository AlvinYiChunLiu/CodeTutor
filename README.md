# CodeTutor (HackCamp)

Turns pasted code or a programming concept into a narrated explainer video.

Stack: Next.js (App Router) · React · Tailwind CSS · Remotion · Shiki

## Setup

1. `npm install`
2. `cp .env.example .env.local`, then fill in the keys (never commit `.env.local`)
3. `npm run dev`, then open http://localhost:3000

API keys are only read on the server (`app/api/*/route.ts` and `lib/`). Don't prefix them with `NEXT_PUBLIC_`.

## Folders

| Folder | What goes there |
| --- | --- |
| `app/` | Pages (`page.tsx`) and API routes (`api/*/route.ts`) |
| `components/ui/` | React UI components |
| `lib/ai/` | LLM calls: planner, writer, checker, prompts |
| `lib/tts/` | Text-to-speech |
| `lib/schema.ts` | Lesson JSON schema shared by everyone |
| `remotion/` | Video composition, scenes and diagrams |
| `mocks/` | Sample lesson for building without API calls |
| `scripts/` | `npm run validate` checks the sample lesson against the schema |
