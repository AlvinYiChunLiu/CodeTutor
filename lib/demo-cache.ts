/**
 * Server-only: the fact-checked demo lessons and their ready-made narrated videos.
 *
 *   mocks/demo/<slug>.json          the checked lesson (no audio)
 *   mocks/demo-voiced/<slug>.json   the same lesson after narration (audio durations + word timings)
 *   public/videos/demo/<slug>.mp4   its narrated video
 *
 * The voiced copy and the video are made the first time a demo topic is asked for with an
 * ElevenLabs key (or all at once with `npm run demo:videos`). Commit them so the demo works on
 * every laptop. If someone edits a demo lesson, its old video is ignored and made again.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Lesson, type Lesson as LessonData } from "@/lib/schema";

const root = () => process.cwd();
const lessonPath = (slug: string) => path.join(root(), "mocks", "demo", `${slug}.json`);
const voicedPath = (slug: string) => path.join(root(), "mocks", "demo-voiced", `${slug}.json`);
const videoFile = (slug: string) => path.join(root(), "public", "videos", "demo", `${slug}.mp4`);
export const demoVideoSrc = (slug: string) => `/videos/demo/${slug}.mp4`;

export async function loadDemoLesson(slug: string): Promise<LessonData> {
  return Lesson.parse(JSON.parse(await readFile(lessonPath(slug), "utf8")));
}

/** The lesson with its narration stripped, so a voiced copy can be compared with the checked original. */
function withoutAudio(lesson: LessonData) {
  return {
    ...lesson,
    chapters: lesson.chapters.map((c) => ({ ...c, scenes: c.scenes.map(({ audio: _audio, ...scene }) => scene) })),
  };
}

/** The voiced lesson and its video, if both exist and still match the checked lesson. */
export async function cachedDemoVideo(slug: string, lesson: LessonData): Promise<{ lesson: LessonData; videoSrc: string } | null> {
  try {
    const voiced = Lesson.parse(JSON.parse(await readFile(voicedPath(slug), "utf8")));
    if (JSON.stringify(withoutAudio(voiced)) !== JSON.stringify(withoutAudio(lesson))) return null;
    // Hosted servers don't upload public/ next to the code (it's served separately), so only check the
    // video file where we can see it. demo:videos commits the voiced copy and the video together.
    const size = await stat(videoFile(slug)).then((f) => f.size, () => (process.env.VERCEL ? 1 : 0));
    if (!size) return null;
    return { lesson: voiced, videoSrc: demoVideoSrc(slug) };
  } catch {
    return null;
  }
}

/** Keep a freshly rendered demo video (videoSrc like "/videos/generated/x.mp4") for next time. */
export async function storeDemoVideo(slug: string, voiced: LessonData, videoSrc: string): Promise<string> {
  const from = path.join(root(), "public", videoSrc.replace(/^\/+/, ""));
  await mkdir(path.dirname(videoFile(slug)), { recursive: true });
  await mkdir(path.dirname(voicedPath(slug)), { recursive: true });
  await copyFile(from, videoFile(slug));
  await writeFile(voicedPath(slug), `${JSON.stringify(voiced, null, 2)}\n`);
  return demoVideoSrc(slug);
}
