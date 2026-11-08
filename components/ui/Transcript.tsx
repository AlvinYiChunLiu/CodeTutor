type TranscriptScene = {
  narration: string;
  durationInSeconds?: number;
  audio?: {
    durationSec: number;
  };
};

type TranscriptProps = {
  scenes: TranscriptScene[];
  currentTime: number;
};

const SCENE_PADDING_SECONDS = 0.8;
const WORDS_PER_SECOND = 2.4;

function getSceneDuration(scene: TranscriptScene) {
  if (scene.durationInSeconds !== undefined) return scene.durationInSeconds;
  if (scene.audio) return scene.audio.durationSec + SCENE_PADDING_SECONDS;

  const wordCount = scene.narration.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, wordCount / WORDS_PER_SECOND) + SCENE_PADDING_SECONDS;
}

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function Transcript({ scenes, currentTime }: TranscriptProps) {
  let nextStartTime = 0;
  const timedScenes = scenes.map((scene) => {
    const startTime = nextStartTime;
    nextStartTime += getSceneDuration(scene);

    return { ...scene, startTime, endTime: nextStartTime };
  });
  const activeSceneIndex = timedScenes.findIndex(({ startTime, endTime }, index) => (
    currentTime >= startTime
      && (currentTime < endTime || (index === timedScenes.length - 1 && currentTime >= endTime))
  ));

  return (
    <ol
      aria-label="Lesson transcript"
      className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
    >
      {timedScenes.map((scene, index) => {
        const isActive = index === activeSceneIndex;

        return (
          <li
            key={`${scene.startTime}-${scene.narration}`}
            aria-current={isActive ? "step" : undefined}
            className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md px-3 py-3 transition-colors ${
              isActive
                ? "bg-[var(--blue-pale)] text-[var(--ink)]"
                : "text-[var(--muted)]"
            }`}
          >
            <time className="row-span-2 font-mono text-xs tabular-nums text-[var(--muted)]">
              {formatTimestamp(scene.startTime)}
            </time>
            <span className={`text-xs font-semibold ${isActive ? "text-[var(--blue-strong)]" : "text-[var(--muted)]"}`}>
              Scene {index + 1}
              {isActive && <span className="sr-only">, currently playing</span>}
            </span>
            <p className="col-start-2 m-0 text-sm leading-6">
              {scene.narration}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
