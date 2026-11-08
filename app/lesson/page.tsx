"use client";

import { useEffect, useState } from "react";
import InteractiveLesson from "@/components/ui/InteractiveLesson";
import sampleLesson from "@/mocks/lesson-recursion.json";
import { Lesson as LessonSchema, type Lesson } from "@/lib/schema";

export default function LessonPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>();
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    try {
      const savedVideoSrc = window.sessionStorage.getItem("codetutor-generated-video");
      if (savedVideoSrc?.startsWith("/videos/")) setVideoSrc(savedVideoSrc);
      const savedLesson = window.sessionStorage.getItem("codetutor-generated-lesson");
      if (!savedLesson) {
        window.sessionStorage.removeItem("codetutor-generated-video");
        setVideoSrc(undefined);
        setLesson(LessonSchema.parse(sampleLesson));
        return;
      }

      const parsed = LessonSchema.safeParse(JSON.parse(savedLesson));
      // Keep the saved lesson (don't remove it): React dev mode runs this effect twice, and a
      // refresh should still show the lesson the learner just made.
      if (parsed.success) {
        setLesson(parsed.data);
      } else {
        setLoadError("The generated lesson could not be loaded. Showing the sample lesson instead.");
        setLesson(LessonSchema.parse(sampleLesson));
      }
    } catch {
      setLoadError("The generated lesson could not be loaded. Showing the sample lesson instead.");
      setLesson(LessonSchema.parse(sampleLesson));
    }
  }, []);

  if (!lesson) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper)] px-6 text-center text-[var(--muted)]">
        Loading your lesson…
      </main>
    );
  }

  if (loadError) {
    return (
      <>
        <p className="mx-auto mt-6 w-[min(900px,calc(100%_-_40px))] rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {loadError}
        </p>
        <InteractiveLesson lesson={lesson} videoSrc={videoSrc} />
      </>
    );
  }

  return <InteractiveLesson lesson={lesson} videoSrc={videoSrc} />;
}
