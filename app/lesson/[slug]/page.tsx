import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import InteractiveLesson from "@/components/ui/InteractiveLesson";
import loopsLesson from "@/mocks/lesson-loops.json";
import variablesLesson from "@/mocks/lesson-variables.json";
import { Lesson as LessonSchema } from "@/lib/schema";

const sampleLessons = {
  loops: { lesson: loopsLesson, videoSrc: "/videos/loops-lesson.mp4" },
  variables: { lesson: variablesLesson, videoSrc: "/videos/variables-lesson.mp4" },
} as const;

export default async function SampleLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sample = sampleLessons[slug as keyof typeof sampleLessons];

  if (sample) {
    return (
      <InteractiveLesson
        lesson={LessonSchema.parse(sample.lesson)}
        videoSrc={sample.videoSrc}
      />
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();

  let contents: string;
  try {
    contents = await readFile(join(process.cwd(), "mocks", "demo", `${slug}.json`), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") notFound();
    throw error;
  }

  return <InteractiveLesson lesson={LessonSchema.parse(JSON.parse(contents))} />;
}