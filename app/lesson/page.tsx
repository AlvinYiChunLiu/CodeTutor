import InteractiveLesson from "@/components/ui/InteractiveLesson";
import sampleLesson from "@/mocks/sample-lesson.json";
import { Lesson as LessonSchema } from "@/lib/schema";

export default function LessonPage() {
  const lesson = LessonSchema.parse(sampleLesson);
  return <InteractiveLesson lesson={lesson} />;
}
