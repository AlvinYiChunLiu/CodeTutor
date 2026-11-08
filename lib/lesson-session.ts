/**
 * Browser-side storage for the lesson the learner just made, so /lesson can show it and the
 * "Explain simpler" / "Go deeper" buttons can resend the original request.
 */
import { Lesson as LessonSchema, type Lesson } from "@/lib/schema";

const LESSON_KEY = "codetutor-generated-lesson";
const VIDEO_KEY = "codetutor-generated-video";
const REQUEST_KEY = "codetutor-generated-request";
const ADJUST_KEY = "codetutor-generated-adjust";

export type Adjust = "simpler" | "deeper";
export type SavedRequest = Record<string, unknown>;

/** Save what /api/lesson returned. Throws if the lesson doesn't match the schema. */
export function saveGeneratedLesson(result: { lesson?: unknown; videoSrc?: unknown }, request: SavedRequest, adjust?: Adjust): Lesson {
  const parsed = LessonSchema.safeParse(result?.lesson);
  if (!parsed.success) throw new Error("The lesson response was invalid. Please try again.");
  try {
    sessionStorage.setItem(LESSON_KEY, JSON.stringify(parsed.data));
    if (typeof result.videoSrc === "string" && result.videoSrc.startsWith("/videos/")) sessionStorage.setItem(VIDEO_KEY, result.videoSrc);
    else sessionStorage.removeItem(VIDEO_KEY);
    // Keep the ORIGINAL request (no adjust), so simpler/deeper are always relative to it.
    const { adjust: _ignored, ...base } = request;
    sessionStorage.setItem(REQUEST_KEY, JSON.stringify({ request: base, title: parsed.data.title }));
    if (adjust) sessionStorage.setItem(ADJUST_KEY, adjust);
    else sessionStorage.removeItem(ADJUST_KEY);
  } catch {
    // Private mode / storage full: the lesson still opens from memory on this navigation.
  }
  return parsed.data;
}

/** The request that made this lesson, or one rebuilt from the lesson itself (demo lessons opened by URL). */
export function requestForLesson(lesson: Lesson): { request: SavedRequest; adjust: Adjust | null } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REQUEST_KEY) ?? "null");
    const adjust = sessionStorage.getItem(ADJUST_KEY) as Adjust | null;
    if (saved?.request && saved.title === lesson.title) return { request: saved.request, adjust };
  } catch {}
  return {
    request: {
      input: `Teach: ${lesson.title}. ${lesson.summary}`,
      mode: "teach-concept",
      language: lesson.codeLanguage,
      level: lesson.level,
    },
    adjust: null,
  };
}
