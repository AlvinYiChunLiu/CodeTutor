/**
 * POST /api/lesson
 * Body: { input, mode?, language?, level?, adjust? }  (see lib/ai/request.ts)
 * 200 → { lesson: Lesson, meta }   400 → { error, issues }   500/502 → { error, issues? }
 *
 * Add ?mock=1 (or set LLM_MOCK=1) to get the sample lesson instantly with no API call.
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sample from "@/mocks/sample-lesson.json";
import { Lesson, type Lesson as LessonData } from "@/lib/schema";
import { LessonRequest } from "@/lib/ai/request";
import { generateLesson, LessonGenerationError } from "@/lib/ai/lesson";
import { LLMError } from "@/lib/ai/llm";
import { shouldMock } from "@/lib/ai/http";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 300;

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

async function createLessonVideo(savedAs: string) {
  const lessonPath = path.resolve(process.cwd(), savedAs);
  const workerPath = path.join(process.cwd(), "scripts", "create-lesson-video.ts");
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx", workerPath, lessonPath], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
  const videoSrc = stdout.match(/^VIDEO_SRC=(.+)$/m)?.[1];
  if (!videoSrc) throw new Error("The video worker finished without returning a video path.");

  const lesson = Lesson.parse(JSON.parse(await readFile(lessonPath, "utf8")));
  return { lesson, savedAs, videoSrc };
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
  try {
    let lesson: LessonData;
    let meta: unknown;

    if (mock) {
      if (!process.env.LLM_API_KEY) console.log("[lesson] no LLM_API_KEY: returning the sample lesson");
      await new Promise((r) => setTimeout(r, 800));
      lesson = Lesson.parse(sample);
      meta = { model: "mock", totalMs: 800, steps: [], warnings: [] };
    } else {
      const generated = await generateLesson(parsed.data, (s) =>
        console.log(`[lesson] ${s.step}#${s.attempt ?? 1} ${s.ms}ms${s.issues ? `\n  ✗ ${s.issues.join("\n  ✗ ")}` : ""}`),
      );
      lesson = generated.lesson;
      meta = generated.meta;
      if (generated.meta.warnings.length) console.log(`[lesson] warnings: ${generated.meta.warnings.join("; ")}`);
    }

    const savedAs = await saveLesson(lesson);
    // The video is a bonus: if narration or rendering fails (no ElevenLabs key, out of credits),
    // still return the lesson so the learner isn't left with nothing.
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log("[lesson] no ELEVENLABS_API_KEY: skipping the video, returning the lesson only");
      return Response.json({ lesson, savedAs, videoSrc: null, meta });
    }
    try {
      const result = await createLessonVideo(savedAs);
      return Response.json({ ...result, meta });
    } catch (videoError) {
      console.error("[lesson] video step failed, returning the lesson without a video:", videoError);
      return Response.json({ lesson, savedAs, videoSrc: null, videoError: "The video couldn't be made this time.", meta });
    }
  } catch (e) {
    console.error("[lesson] failed:", e);
    if (e instanceof LessonGenerationError) {
      return Response.json({ error: e.message, issues: e.issues }, { status: 502 });
    }
    if (e instanceof LLMError) {
      return Response.json({ error: e.message }, { status: e.status === 500 || e.status === 401 ? 500 : 502 });
    }
    return Response.json({ error: "Something went wrong making the lesson." }, { status: 500 });
  }
}
