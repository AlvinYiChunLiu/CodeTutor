import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { Lesson } from "../lib/schema";
import { getLessonAudioTimeline } from "./timeline";

type LessonVideoComponent = ComponentType<{ lesson: Lesson }>;

export function withLessonAudio(VisualVideo: LessonVideoComponent, lesson: Lesson) {
  return function LessonVideoWithAudio() {
    const timeline = getLessonAudioTimeline(lesson);

    return (
      <AbsoluteFill>
        <VisualVideo lesson={lesson} />
        {timeline.map(({ scene, from, durationInFrames }) =>
          scene.audio?.url ? (
            <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
              <Audio src={staticFile(scene.audio.url)} />
            </Sequence>
          ) : null,
        )}
      </AbsoluteFill>
    );
  };
}