"use client";

/**
 * "Explain simpler" / "Go deeper": resend the request that made this lesson with `adjust`,
 * show live progress while the new version is made, then open it.
 */
import { useEffect, useRef, useState } from "react";
import type { Lesson } from "@/lib/schema";
import LoadingSteps from "@/components/ui/LoadingSteps";
import { requestLesson } from "@/lib/ai/progress";
import { lessonUrl, requestForLesson, saveGeneratedLesson, type Adjust } from "@/lib/lesson-session";

const LABEL: Record<Adjust, string> = { simpler: "Explain simpler", deeper: "Go deeper" };
const MAKING: Record<Adjust, string> = { simpler: "Making a simpler version…", deeper: "Making a deeper version…" };

export default function AdjustLesson({ lesson }: { lesson: Lesson }) {
  const [current, setCurrent] = useState<Adjust | null>(null);
  const [running, setRunning] = useState<Adjust | null>(null);
  const [progress, setProgress] = useState<{ step: number; detail?: string; percent?: number }>({ step: 0 });
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Which version is showing now (read after mount: sessionStorage isn't available on the server).
  useEffect(() => setCurrent(requestForLesson(lesson).adjust), [lesson]);

  async function adjust(direction: Adjust) {
    const { request } = requestForLesson(lesson);
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(direction);
    setError("");
    setProgress({ step: 0 });
    try {
      const result = await requestLesson({ ...request, adjust: direction }, (p) => setProgress({ step: p.step, detail: p.detail, percent: p.percent }), {
        signal: controller.signal,
      });
      saveGeneratedLesson(result, request, direction);
      // Full navigation so the lesson page (and its video) reload with the new version.
      window.location.assign(lessonUrl(result));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Couldn't make that version. Try again.");
      setRunning(null);
    }
  }

  return (
    <div className="adjust-lesson">
      <div className="adjust-buttons" role="group" aria-label="Change how this lesson explains things">
        {current && <span className="adjust-current">{current === "simpler" ? "Simpler version" : "Deeper version"}</span>}
        {(["simpler", "deeper"] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            className={`adjust-button ${current === direction ? "adjust-button-active" : ""}`}
            onClick={() => adjust(direction)}
            disabled={running !== null || current === direction}
            aria-pressed={current === direction}
          >
            <span aria-hidden="true">{direction === "simpler" ? "↓" : "↑"}</span>
            {running === direction ? MAKING[direction] : LABEL[direction]}
          </button>
        ))}
      </div>

      {running && (
        <div className="adjust-progress" role="status" aria-live="polite">
          <div className="adjust-progress-head">
            <b>{MAKING[running]}</b>
            <button type="button" className="practice-link" onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
          <LoadingSteps currentStepIndex={progress.step} detail={progress.detail} percent={progress.percent} />
        </div>
      )}
      {error && <p className="adjust-error" role="alert">{error}</p>}
    </div>
  );
}
