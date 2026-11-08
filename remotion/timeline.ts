import type { Lesson, Scene } from "../lib/schema";

const FPS = 30;
const SCENE_PADDING_SECONDS = 0.8;
const WORDS_PER_SECOND = 2.4;

export type LessonSceneEntry = {
  scene: Scene;
  chapterTitle: string;
  chapterNumber: number;
  sceneNumber: number;
};

export function flattenLessonScenes(lesson: Lesson): LessonSceneEntry[] {
  return lesson.chapters.flatMap((chapter, chapterIndex) =>
    chapter.scenes.map((scene, sceneIndex) => ({
      scene,
      chapterTitle: chapter.title,
      chapterNumber: chapterIndex + 1,
      sceneNumber: sceneIndex + 1,
    })),
  );
}

export function sceneDurationInFrames(scene: Scene) {
  const estimatedDuration = Math.max(4, scene.narration.trim().split(/\s+/).length / WORDS_PER_SECOND);
  const duration = scene.audio?.durationSec ?? estimatedDuration;
  return Math.ceil((duration + SCENE_PADDING_SECONDS) * FPS);
}

export function getLessonDurationInFrames(lesson: Lesson) {
  return flattenLessonScenes(lesson).reduce((total, { scene }) => total + sceneDurationInFrames(scene), 0);
}

export function getLessonAudioTimeline(lesson: Lesson) {
  let from = 0;
  return flattenLessonScenes(lesson).map(({ scene }) => {
    const durationInFrames = sceneDurationInFrames(scene);
    const segment = { scene, from, durationInFrames };
    from += durationInFrames;
    return segment;
  });
}