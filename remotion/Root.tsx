import { Composition } from "remotion";
import sampleLesson from "../mocks/sample-lesson.json";
import loopsLessonData from "../mocks/lesson-loops.json";
import variablesLessonData from "../mocks/lesson-variables.json";
import { Lesson as LessonSchema } from "../lib/schema";
import { LessonVideo } from "./LessonVideo";
import { getLessonDurationInFrames } from "./timeline";
import { withLessonAudio } from "./withLessonAudio";

const lessons = [
  { id: "RecursionLesson", lesson: LessonSchema.parse(sampleLesson) },
  { id: "LoopsLesson", lesson: LessonSchema.parse(loopsLessonData) },
  { id: "VariablesLesson", lesson: LessonSchema.parse(variablesLessonData) },
];

export function RemotionRoot() {
  return (
    <>
      {lessons.map(({ id, lesson }) => (
        <Composition
          key={id}
          id={id}
          component={withLessonAudio(LessonVideo, lesson)}
          durationInFrames={getLessonDurationInFrames(lesson)}
          fps={30}
          width={1280}
          height={720}
        />
      ))}
    </>
  );
}