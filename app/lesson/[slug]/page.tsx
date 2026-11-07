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
  if (!sample) notFound();

  return (
    <InteractiveLesson
      lesson={LessonSchema.parse(sample.lesson)}
      videoSrc={sample.videoSrc}
    />
  );
}