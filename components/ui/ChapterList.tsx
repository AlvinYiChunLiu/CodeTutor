"use client";

export type ChapterScene = {
  title: string;
  durationInSeconds: number;
};

type ChapterListProps = {
  scenes: ChapterScene[];
  currentTime: number;
  onSelectChapter: (startTimeInSeconds: number) => void;
};

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function ChapterList({ scenes, currentTime, onSelectChapter }: ChapterListProps) {
  let nextStartTime = 0;
  const timedScenes = scenes.map((scene) => {
    const startTime = nextStartTime;
    nextStartTime += scene.durationInSeconds;

    return { ...scene, startTime, endTime: nextStartTime };
  });
  const activeSceneIndex = timedScenes.findIndex(({ startTime, endTime }, index) => (
    currentTime >= startTime
      && (currentTime < endTime || (index === timedScenes.length - 1 && currentTime >= endTime))
  ));

  return (
    <ol className="flex flex-col gap-1" aria-label="Lesson chapters">
      {timedScenes.map((scene, index) => {
        const isActive = index === activeSceneIndex;

        return (
          <li key={`${scene.title}-${scene.startTime}`}>
            <button
              type="button"
              onClick={() => onSelectChapter(scene.startTime)}
              aria-current={isActive ? "step" : undefined}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] ${
                isActive
                  ? "bg-[var(--blue-pale)] text-[var(--blue-strong)]"
                  : "text-[var(--muted)] hover:bg-[var(--soft-surface)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="shrink-0 font-mono text-xs tabular-nums">
                {formatTimestamp(scene.startTime)}
              </span>
              <span className={`text-sm ${isActive ? "font-semibold" : ""}`}>
                {scene.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}