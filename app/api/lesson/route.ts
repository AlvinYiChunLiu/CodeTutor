/**
 * POST /api/lesson
 * Body: { input, mode?, language?, level?, adjust? }  (see lib/ai/request.ts)
 * 200 → { lesson, savedAs, videoSrc, meta }   400 → { error, issues }   500/502 → { error, issues? }
 *
 * ?stream=1  → NDJSON progress lines, then {"type":"done","status":…,"body":…} (see lib/ai/progress.ts;
 *              pages can use requestLesson() from there instead of fetch).
 * ?mock=1 (or LLM_MOCK=1, or no LLM_API_KEY in dev) → the sample lesson instead of calling Featherless.
 *
 * Demo topics ("What is recursion?", bubble sort… see lib/ai/demo-topics.ts) skip the AI and use the
 * fact-checked lesson in mocks/demo, plus its ready-made video when there is one (lib/demo-cache.ts).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import sample from "@/mocks/lesson-recursion.json";
import { Lesson, type Lesson as LessonData } from "@/lib/schema";
import { LessonRequest } from "@/lib/ai/request";
import { generateLesson, LessonGenerationError } from "@/lib/ai/lesson";
import { LLMError } from "@/lib/ai/llm";
import { shouldMock } from "@/lib/ai/http";
import { progress, type ProgressEvent } from "@/lib/ai/progress";
import { saveLessonToDatabase } from "@/lib/lessons";
import { findDemoTopic } from "@/lib/ai/demo-topics";
import { cachedDemoVideo, loadDemoLesson, storeDemoVideo } from "@/lib/demo-cache";

export const runtime = "nodejs";
export const maxDuration = 300;

type Emit = (event: ProgressEvent) => void;

/** Save to the database for Past videos. A database problem must never cost the learner their lesson. */
async function saveIfConfigured(lesson: LessonData, videoSrc: string | null): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await saveLessonToDatabase(lesson, videoSrc);
  } catch (e) {
    console.error("[lesson] could not save to the database (lesson still returned):", e);
    return null;
  }
}
type Result = { status: number; body: unknown };

function describeError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  return String(error);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function saveLesson(lesson: LessonData) {
  const slug = lesson.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "lesson";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${slug}-${randomUUID().slice(0, 8)}.json`;
  const directory = path.join(process.cwd(), "mocks", "generated");

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), `${JSON.stringify(lesson, null, 2)}\n`, { flag: "wx" });

  return path.posix.join("mocks", "generated", fileName);
}

/** Runs the narration + render worker, turning its log lines into progress events as they arrive. */
function createLessonVideo(savedAs: string, sceneCount: number, emit: Emit) {
  const lessonPath = path.resolve(process.cwd(), savedAs);
  const workerPath = path.join(process.cwd(), "scripts", "create-lesson-video.ts");

  return new Promise<{ lesson: LessonData; savedAs: string; videoSrc: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", workerPath, lessonPath], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    let voiced = 0;
    let lastPercent = -1;

    createInterface({ input: child.stdout }).on("line", (line) => {
      stdout += `${line}\n`;
      if (line.startsWith("[audio]")) {
        voiced++;
        emit(progress("voice", `${Math.min(voiced, sceneCount)} of ${sceneCount} scenes`, (voiced / sceneCount) * 100));
      } else if (line.startsWith("[render] bundling")) {
        if (lastPercent < 0) {
          lastPercent = 0;
          emit(progress("video", "getting ready", 0));
        }
      } else {
        const pct = line.match(/^\[render\] (\d+)%/);
        if (pct && Number(pct[1]) >= lastPercent + 5) {
          lastPercent = Number(pct[1]);
          emit(progress("video", "rendering", lastPercent));
        }
      }
    });
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) return reject(new Error(`Video worker exited with code ${code}: ${stderr.slice(-800)}`));
      const videoSrc = stdout.match(/^VIDEO_SRC=(.+)$/m)?.[1];
      if (!videoSrc) return reject(new Error("The video worker finished without returning a video path."));
      try {
        const lesson = Lesson.parse(JSON.parse(await readFile(lessonPath, "utf8")));
        resolve({ lesson, savedAs, videoSrc });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** The whole pipeline. Used by both the plain JSON response and the progress stream. */
async function buildLesson(request: LessonRequest, mock: boolean, emit: Emit): Promise<Result> {
  try {
    let lesson: LessonData;
    let meta: unknown;
    const started = Date.now();
    const demo = findDemoTopic(request);

    if (demo) {
      console.log(`[lesson] demo topic: using the checked lesson mocks/demo/${demo.slug}.json`);
      lesson = await loadDemoLesson(demo.slug);
      // Tick through the steps so the screen looks the same as a normal run.
      for (const stage of ["planning", "writing", "checking"] as const) {
        emit(progress(stage, stage === "checking" ? "using a checked lesson" : undefined));
        await sleep(250);
      }
      meta = { model: "demo", demo: demo.slug, totalMs: Date.now() - started, steps: [], warnings: [] };
      const cached = await cachedDemoVideo(demo.slug, lesson);
      if (cached) {
        emit(progress("video", "ready", 100));
        const id = await saveIfConfigured(cached.lesson, cached.videoSrc);
        return { status: 200, body: { ...cached, savedAs: `mocks/demo/${demo.slug}.json`, id, meta } };
      }
    } else if (mock) {
      if (!process.env.LLM_API_KEY) console.log("[lesson] no LLM_API_KEY: returning the sample lesson");
      emit(progress("planning"));
      await sleep(300);
      emit(progress("writing"));
      await sleep(300);
      emit(progress("checking"));
      await sleep(200);
      lesson = Lesson.parse(sample);
      meta = { model: "mock", totalMs: 800, steps: [], warnings: [] };
    } else {
      emit(progress("planning"));
      const generated = await generateLesson(request, (s) => {
        console.log(`[lesson] ${s.step}#${s.attempt ?? 1} ${s.ms}ms${s.issues ? `\n  ✗ ${s.issues.join("\n  ✗ ")}` : ""}`);
        if (s.step === "planner") emit(progress("writing"));
        else if (s.step === "writer") emit(progress("checking", s.attempt && s.attempt > 1 ? `try ${s.attempt}` : undefined));
        else if (s.step === "checker" && s.issues) {
          emit(progress("writing", `fixing ${s.issues.length} issue${s.issues.length === 1 ? "" : "s"}`));
        }
      });
      lesson = generated.lesson;
      meta = generated.meta;
      if (generated.meta.warnings.length) console.log(`[lesson] warnings: ${generated.meta.warnings.join("; ")}`);
    }

    // Hosted (Vercel etc.): the disk is read-only, so saving a copy can fail. That copy is only for
    // the video worker and for debugging, so a failure here must never cost the learner the lesson.
    let savedAs: string | null = null;
    try {
      savedAs = await saveLesson(lesson);
    } catch (e) {
      console.warn(`[lesson] could not save a copy to mocks/generated (read-only disk?): ${(e as Error).message}`);
    }
    // The video is a bonus: if narration or rendering fails (no ElevenLabs key, out of credits),
    // still return the lesson so the learner isn't left with nothing.
    // It needs Chrome + minutes of rendering, which serverless hosts can't do: skip it there.
    const videoOff = !process.env.ELEVENLABS_API_KEY || !savedAs || Boolean(process.env.VERCEL) || process.env.LESSON_VIDEO === "off";
    if (videoOff) {
      console.log("[lesson] video skipped (no ElevenLabs key, read-only disk, or a hosted server): returning the lesson only");
      const id = await saveIfConfigured(lesson, null);
      return { status: 200, body: { lesson, savedAs, videoSrc: null, id, meta } };
    }
    try {
      const sceneCount = lesson.chapters.reduce((n, c) => n + c.scenes.length, 0);
      emit(progress("voice", `0 of ${sceneCount} scenes`, 0));
      const result = await createLessonVideo(savedAs!, sceneCount, emit);
      if (demo) {
        // Keep it, so the next time this topic is asked for, the video is instant too.
        try {
          result.videoSrc = await storeDemoVideo(demo.slug, result.lesson, result.videoSrc);
        } catch (e) {
          console.error("[lesson] could not keep the demo video (lesson still returned):", e);
        }
      }
      const id = await saveIfConfigured(result.lesson, result.videoSrc);
      return { status: 200, body: { ...result, id, meta } };
    } catch (videoError) {
      console.error("[lesson] video step failed, returning the lesson without a video:", videoError);
      const id = await saveIfConfigured(lesson, null);
      return {
        status: 200,
        body: {
          lesson,
          savedAs,
          videoSrc: null,
          id,
          videoError: "The video couldn't be made this time.",
          ...(process.env.NODE_ENV === "development" ? { videoDebugError: describeError(videoError) } : {}),
          meta,
        },
      };
    }
  } catch (e) {
    console.error("[lesson] failed:", e);
    if (e instanceof LessonGenerationError) return { status: 502, body: { error: e.message, issues: e.issues } };
    if (e instanceof LLMError) {
      return { status: e.status === 500 || e.status === 401 ? 500 : 502, body: { error: e.message } };
    }
    return {
      status: 500,
      body: {
        error: "Something went wrong making the lesson.",
        ...(process.env.NODE_ENV === "development" ? { debugError: describeError(e) } : {}),
      },
    };
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = LessonRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const mock = shouldMock(req);
  const wantsStream = new URL(req.url).searchParams.get("stream") === "1";

  if (!wantsStream) {
    const result = await buildLesson(parsed.data, mock, () => {});
    return Response.json(result.body, { status: result.status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away (tab closed); keep going so the lesson still gets saved.
        }
      };
      const result = await buildLesson(parsed.data, mock, send);
      send({ type: "done", status: result.status, body: result.body });
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
