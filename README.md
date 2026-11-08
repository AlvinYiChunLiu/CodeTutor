# hackcamp-codetutor

Turns pasted code or a programming concept into a narrated explainer video.

Stack: Next.js (App Router) · React · Tailwind CSS · Remotion · Shiki

## Setup

1. `npm install`
2. Create `.env.local` in the project root and add your keys, including `DATABASE_URL` for PostgreSQL (never commit `.env.local`)
3. `npm run dev`, then open http://localhost:3000

API keys are only read on the server (`app/api/*/route.ts` and `lib/`). Don't prefix them with `NEXT_PUBLIC_`.

## Demo lessons

Add your `LLM_API_KEY` to your ignored `.env.local` file, then generate the visual demo lessons with:

```sh
npm run lesson:test -- binary-search
npm run lesson:test -- factorial
npm run lesson:test -- two-pointers
npm run lesson:test -- recursion
```

Each lesson is saved under `mocks/demo/` and can be opened at `/lesson/<filename-without-extension>` (for example, `/lesson/binary-search`). Validate a saved lesson with `npm run validate -- mocks/demo/binary-search.json`.

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
