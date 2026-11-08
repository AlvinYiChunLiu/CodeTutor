type LoadingStepsProps = {
  currentStepIndex: number;
  /** Extra words for the active step, e.g. "fixing 1 issue" or "4 of 10 scenes". */
  detail?: string;
  /** 0–100 progress within the active step (voice and video). */
  percent?: number;
};

const steps = [
  "Planning lesson structure",
  "Writing script",
  "Validating code accuracy",
  "Recording voice narration",
  "Preparing video player",
];

export default function LoadingSteps({ currentStepIndex, detail, percent }: LoadingStepsProps) {
  return (
    <ol aria-label="Lesson generation progress" className="flex flex-col gap-4">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isActive = index === currentStepIndex;

        return (
          <li
            key={step}
            aria-current={isActive ? "step" : undefined}
            className={`flex items-center gap-3 text-sm transition-opacity ${
              isCompleted
                ? "text-[var(--ink)]"
                : isActive
                  ? "font-medium text-[var(--ink)]"
                  : "text-[var(--muted)] opacity-50"
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid size-6 shrink-0 place-items-center rounded-full ${
                isCompleted
                  ? "bg-green-100 text-green-700"
                  : isActive
                    ? "border-2 border-[var(--blue)]"
                    : "border border-[var(--line)]"
              }`}
            >
              {isCompleted ? (
                <svg viewBox="0 0 16 16" className="size-4" fill="none">
                  <path
                    d="m3.5 8.25 3 3 6-6.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              ) : isActive ? (
                <span className="size-3 animate-spin rounded-full border-2 border-[var(--blue)] border-t-transparent" />
              ) : (
                <span className="text-xs">{index + 1}</span>
              )}
            </span>
            <span className="loading-step-copy">
              <span>{step}</span>
              {isActive && detail && <small>{detail}</small>}
              {isActive && percent !== undefined && (
                <span className="loading-step-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
              )}
            </span>
            {isActive && <span className="sr-only">In progress{detail ? `: ${detail}` : ""}</span>}
          </li>
        );
      })}
    </ol>
  );
}
