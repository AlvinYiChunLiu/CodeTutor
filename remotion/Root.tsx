import { Composition } from "remotion";
import sampleLesson from "../mocks/lesson-recursion.json";
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
const NarratedLessonVideo = withLessonAudio(LessonVideo);
const generatedLessonFallback = LessonSchema.parse(sampleLesson);

export function RemotionRoot() {
  return (
    <>
      {lessons.map(({ id, lesson }) => (
        <Composition
          key={id}
          id={id}
          component={NarratedLessonVideo}
          durationInFrames={getLessonDurationInFrames(lesson)}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ lesson }}
        />
      ))}
      <Composition
        id="GeneratedLesson"
        component={NarratedLessonVideo}
        durationInFrames={getLessonDurationInFrames(generatedLessonFallback)}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ lesson: generatedLessonFallback }}
        calculateMetadata={({ props }) => ({
          durationInFrames: getLessonDurationInFrames(LessonSchema.parse(props.lesson)),
        })}
      />
    </>
  );
}