import { Composition } from "remotion";
import sampleLesson from "../mocks/sample-lesson.json";
import { Lesson as LessonSchema } from "../lib/schema";
import { getLessonDurationInFrames, LessonVideo } from "./LessonVideo";

const lesson = LessonSchema.parse(sampleLesson);

export function RemotionRoot() {
  return (
    <Composition
      id="RecursionLesson"
      component={LessonVideo}
      durationInFrames={getLessonDurationInFrames(lesson)}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{ lesson }}
    />
  );
}