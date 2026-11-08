import { notFound } from "next/navigation";
import InteractiveLesson from "@/components/ui/InteractiveLesson";
import { listSavedLessons } from "@/lib/lessons";

export const dynamic = "force-dynamic";

export default async function SavedLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let lessons;
  try {
    lessons = await listSavedLessons();
  } catch (error) {
    console.error("Could not load saved lesson:", error);
    notFound();
  }
  const saved = lessons.find((entry) => entry.id === id);
  if (!saved) notFound();
  return <InteractiveLesson lesson={saved.lesson} videoSrc={saved.videoSrc ?? undefined} />;
}
