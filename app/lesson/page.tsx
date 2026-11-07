"use client";
import { useEffect, useState } from "react";
import InteractiveLesson from "@/components/ui/InteractiveLesson";
import sampleLesson from "@/mocks/sample-lesson.json";
import { Lesson as LessonSchema, type Lesson } from "@/lib/schema";

export default function LessonPage() {
  const [lesson, setLesson] = useState<Lesson>(() => LessonSchema.parse(sampleLesson));
  useEffect(() => {
    const saved = sessionStorage.getItem("lesson");
    const parsed = saved ? LessonSchema.safeParse(JSON.parse(saved)) : null;
    if (parsed?.success) setLesson(parsed.data);
  }, []);
  return <InteractiveLesson lesson={lesson} />;
}