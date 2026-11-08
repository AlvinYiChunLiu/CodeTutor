/**
 * Live progress for POST /api/lesson?stream=1 — shared by the route (server) and the pages (browser).
 * No Node imports here, so it's safe to use in client components.
 *
 * The stream is NDJSON: one JSON object per line.
 *   {"type":"progress","stage":"writing","step":1,"label":"Writing script","detail":"fixing 2 issues"}
 *   {"type":"progress","stage":"video","step":4,"label":"Preparing video player","percent":40}
 *   {"type":"done","status":200,"body":{ lesson, videoSrc, meta, … }}   ← same body as the plain JSON response
 */

/** Same order and words as components/ui/LoadingSteps.tsx, so `step` can drive it directly. */
export const STAGES = [
  { id: "planning", label: "Planning lesson structure" },
  { id: "writing", label: "Writing script" },
  { id: "checking", label: "Validating code accuracy" },
  { id: "voice", label: "Recording voice narration" },
  { id: "video", label: "Preparing video player" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export type ProgressEvent = {
  type: "progress";
  stage: StageId;
  /** 0–4: index into STAGES (and into LoadingSteps). */
  step: number;
  label: string;
  /** Extra words for the UI, e.g. "fixing 2 issues" or "3 of 9 scenes". */
  detail?: string;
  /** 0–100 within this stage, when known (voice and video). */
  percent?: number;
};

export type DoneEvent = { type: "done"; status: number; body: any };
export type StreamEvent = ProgressEvent | DoneEvent;

export function progress(stage: StageId, detail?: string, percent?: number): ProgressEvent {
  const step = STAGES.findIndex((s) => s.id === stage);
  const event: ProgressEvent = { type: "progress", stage, step, label: STAGES[step].label };
  if (detail) event.detail = detail;
  if (percent !== undefined) event.percent = Math.max(0, Math.min(100, Math.round(percent)));
  return event;
}

/**
 * Browser helper: POST to /api/lesson with live progress.
 *
 *   const result = await requestLesson(body, (p) => setCurrentStepIndex(p.step));
 *   // result = { lesson, videoSrc, meta, … }  — exactly what the plain JSON call returns
 *
 * Throws an Error with a user-friendly message if the lesson can't be made.
 */
export async function requestLesson(
  body: unknown,
  onProgress?: (event: ProgressEvent) => void,
  options: { mock?: boolean; signal?: AbortSignal } = {},
): Promise<any> {
  const res = await fetch(`/api/lesson?stream=1${options.mock ? "&mock=1" : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  // Bad requests (empty input, etc.) come back as plain JSON before any streaming starts.
  if (!res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Lesson request failed (${res.status}).`);
    return data;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: DoneEvent | undefined;

  for (;;) {
    const { value, done: finished } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "progress") onProgress?.(event);
      else if (event.type === "done") done = event;
    }
    if (finished) break;
  }

  if (!done) throw new Error("The connection closed before the lesson was ready. Try again.");
  if (done.status >= 400) throw new Error(done.body?.error ?? "Couldn't make the lesson. Try again.");
  return done.body;
}
