# CodeTutor (hackcamp-codetutor)

**Turn any coding question or code snippet into a narrated, animated video lesson, with practice problems.**

Ask "What is recursion?" or paste your own code, and CodeTutor plans a short lesson, writes it scene by scene,
checks it for mistakes, narrates it, and renders it as a video. Learners step through the lesson at their own pace,
then practise with a generated problem that gets line-specific feedback.

Live site: [codetutor.wiki](https://www.codetutor.wiki) (lessons only; see [Hosting](#hosting) for video)

## Features

- **Two ways in:** describe a concept ("Generate new code") or paste a snippet ("Explore my code"). Python, JavaScript, TypeScript, Java, C and C++.
- **Interactive lesson page:** code with highlighted lines, array and call-stack diagrams, program output and a recap. Each moment gets a specific label in the sidebar (for example "Line 2 · Check n == 0"), the ← → keys step through it, and clicking the transcript jumps the video.
- **Narrated video:** every scene is voiced with ElevenLabs and rendered with Remotion, with word-by-word captions.
- **Explain simpler / Go deeper:** regenerates the lesson for a beginner or adds a "Going deeper" chapter (complexity, memory, edge cases).
- **Practice:** a new problem based on the lesson, in any supported language, graded with feedback on the learner's own code.
- **Live progress:** the Generate page shows each step as it happens (planning, writing, checking, voice, video).
- **Past lessons:** lessons are saved to a shared PostgreSQL database.
- **Instant demo topics:** seven fact-checked lessons open instantly instead of waiting for the AI (see [Demo lessons](#demo-lessons)).

## How the AI works

Lessons are made by a three-step pipeline (`lib/ai/`) using open-weight models through the [Featherless](https://featherless.ai) API:
**Qwen 2.5 72B Instruct**, with **Qwen 2.5 Coder 32B** as an automatic fallback.

1. **Planner** (`planner.ts`): outlines the chapters and scenes, and writes a short example program for concept questions.
2. **Writer** (`writer.ts`): writes the full lesson as JSON that matches `lib/schema.ts`: narration, highlighted lines, diagrams and output.
3. **Checker** (`checker.ts`): plain code, not AI. It validates the schema and our teaching rules (for example, call-stack values must follow a real trace, there's one output scene, and no code is pasted into the narration), fixes small issues itself (like highlights that are one line off), and sends anything else back to the Writer to fix (up to 3 tries).

Other details:
- Replies that come back as garbage (a known Featherless glitch) are detected and retried, then sent to the fallback model.
- The same model writes and grades practice problems (`practice.ts`).
- All prompt text lives in `prompts.ts`.

## Setup

1. `npm install`
2. Create `.env.local` in the project root (copy `.env.example`). **Never commit it.**

   | Variable | Needed for |
   | --- | --- |
   | `LLM_API_KEY` | **Required.** Your Featherless key |
   | `ELEVENLABS_API_KEY` | Narrated videos. Without it, lessons are made without a video |
   | `DATABASE_URL` | Past lessons (PostgreSQL). Optional |
   | `FEATHERLESS_MODEL`, `FEATHERLESS_FALLBACK_MODEL` | Optional: override the default models |

3. `npm run dev`, then open http://localhost:3000

API keys are only read on the server (`app/api/*/route.ts` and `lib/`). Never prefix them with `NEXT_PUBLIC_`.

## Demo lessons

These fact-checked lessons are in `mocks/demo/`. Typing one of these questions (with the matching language selected, or named
in the question) opens the lesson instantly instead of calling the AI. You can also open one at `/lesson/<name>`.

| Ask | Language | Opens |
| --- | --- | --- |
| What is recursion? | Python | `/lesson/recursion` |
| Explain bubble sort | Python | `/lesson/explain-bubble-sort` |
| two sum problem | Python | `/lesson/two-sum` |
| How does async/await work? | JavaScript | `/lesson/how-does-async-await-work` |
| how do I filter an array in javascript | JavaScript | `/lesson/js-filter` |
| How do pointers work in C? | C | `/lesson/how-do-pointers-work-in-c` |
| What is a vector in C++? | C++ | `/lesson/what-is-a-vector-in-c` |

Matching is strict on purpose: "explain recursion with fibonacci" goes to the AI, because it asks for something different.
Explain simpler and Go deeper always use the AI. The matching rules are in `lib/ai/demo-topics.ts`.

Build the narrated video for each demo lesson once (this needs `ELEVENLABS_API_KEY`), then commit the results:

```sh
npm run demo:videos          # all of them, or e.g. npm run demo:videos -- two-sum
git add mocks/demo-voiced public/videos/demo
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run demo:test` | Check which questions open a demo lesson (no API keys needed) |
| `npm run demo:videos` | Narrate and render the demo lessons' videos |
| `npm run judge:test` | Run inputs a judge might type (messy paste, one-liners, vague questions, Java with the wrong dropdown) through the AI and write a report to `mocks/tuning/` |
| `npm run lesson:test -- "your question"` | Generate one lesson from the terminal. Note: it saves to `mocks/demo/`, so don't use a demo lesson's name |
| `npm run lesson:compare` | Compare a lesson with its Explain simpler and Go deeper versions |
| `npm run practice:test` | Generate and grade a practice problem |
| `npm run prompt-video:test` | Full run: lesson → narration → video |
| `npm run validate -- <file>` | Check a lesson JSON file against the schema |
| `npx tsc --noEmit` | Type check. Run it before every push |

## Hosting

The app runs fully on a laptop (`npm run dev`). On **Vercel** (codetutor.wiki), lessons, practice, demo lessons and their
pre-built videos all work, but **new videos are not rendered**: rendering needs Chrome and minutes of CPU, which serverless
functions don't have, and the server's disk is read-only. Lessons made there show a "No video for this lesson" note instead.
Ways to add video when hosted: play the scenes live in the browser with `@remotion/player`, use Remotion Lambda, or use a separate render server.

## Project structure

| Folder | What's there |
| --- | --- |
| `app/` | Pages (home, Generate, lesson, Past lessons) and API routes: `api/lesson`, `api/practice`, `api/grade`, `api/tts` |
| `components/ui/` | React UI: `InteractiveLesson`, `PracticePanel`, `AdjustLesson`, `LoadingSteps`… |
| `lib/ai/` | The AI pipeline: planner, writer, checker, prompts, practice, demo topics, Featherless client |
| `lib/schema.ts` | The lesson JSON format shared by the AI, the video and the UI |
| `lib/db.ts`, `lib/lessons.ts` | PostgreSQL storage for Past lessons |
| `lib/video/`, `remotion/` | Video scenes, diagrams, captions and rendering |
| `mocks/demo/` | Fact-checked demo lessons (`mocks/demo-voiced/` holds their narrated versions) |
| `scripts/` | The `npm run` scripts above |

Stack: Next.js 15 · React 19 · TypeScript · Tailwind CSS · zod · Remotion · Shiki · ElevenLabs · Featherless (Qwen 2.5) · PostgreSQL
