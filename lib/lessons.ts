import { randomUUID } from "node:crypto";
import { Lesson, type Lesson as LessonData } from "@/lib/schema";
import { getDb } from "@/lib/db";

export type SavedLesson = {
  id: string;
  lesson: LessonData;
  videoSrc: string | null;
  createdAt: string;
};

async function ensureLessonsTable() {
  await getDb()`CREATE TABLE IF NOT EXISTS lessons (
    id text PRIMARY KEY,
    title text NOT NULL,
    lesson jsonb NOT NULL,
    video_src text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
}

export async function saveLessonToDatabase(lesson: LessonData, videoSrc: string | null) {
  const id = randomUUID();
  await ensureLessonsTable();
  await getDb()`INSERT INTO lessons (id, title, lesson, video_src)
    VALUES (${id}, ${lesson.title}, ${JSON.stringify(lesson)}::jsonb, ${videoSrc})`;
  return id;
}

export async function listSavedLessons(): Promise<SavedLesson[]> {
  await ensureLessonsTable();
  const rows = await getDb()<{
    id: string;
    lesson: unknown;
    video_src: string | null;
    created_at: Date | string;
  }[]>`SELECT id, lesson, video_src, created_at FROM lessons ORDER BY created_at DESC`;
  return rows.flatMap((row) => {
    const parsed = Lesson.safeParse(typeof row.lesson === "string" ? JSON.parse(row.lesson) : row.lesson);
    if (!parsed.success) return [];
    return [{
      id: row.id,
      lesson: parsed.data,
      videoSrc: row.video_src,
      createdAt: new Date(row.created_at).toISOString(),
    }];
  });
}
