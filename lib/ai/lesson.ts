/** Planner → Writer → Checker, with schema-driven retries. Used by /api/lesson and scripts. */
import type { Lesson } from "../schema";
import { currentModel, extractJson } from "./llm";
import { planLesson } from "./planner";
import { Writer } from "./writer";
import { checkLesson } from "./checker";
import type { LessonRequest } from "./request";

const MAX_WRITER_ATTEMPTS = 3;

export type StepLog = { step: "planner" | "writer" | "checker"; ms: number; attempt?: number; issues?: string[] };
export type LessonMeta = { model: string; totalMs: number; steps: StepLog[]; warnings: string[] };

export async function generateLesson(
  req: LessonRequest,
  onStep?: (log: StepLog) => void,
): Promise<{ lesson: Lesson; meta: LessonMeta }> {
  const t0 = Date.now();
  const steps: StepLog[] = [];
  const log = (s: StepLog) => {
    steps.push(s);
    onStep?.(s);
  };

  // 1. Planner
  let t = Date.now();
  const { plan, attempts: planAttempts } = await planLesson(req);
  log({ step: "planner", ms: Date.now() - t, attempt: planAttempts });

  // 2. Writer ⇄ 3. Checker
  const writer = new Writer(req, plan);
  let text = "";
  let issues: string[] = [];
  let lastDraft: unknown; // most recent reply that was valid JSON, kept as a fallback
  for (let attempt = 1; attempt <= MAX_WRITER_ATTEMPTS; attempt++) {
    t = Date.now();
    text = attempt === 1 ? await writer.draft() : await writer.revise(text, issues);
    log({ step: "writer", ms: Date.now() - t, attempt });

    t = Date.now();
    let draft: unknown;
    try {
      draft = extractJson(text);
      lastDraft = draft;
    } catch (e) {
      issues = [`Your reply was not valid JSON (${(e as Error).message}).`];
      log({ step: "checker", ms: Date.now() - t, attempt, issues });
      continue;
    }
    const result = checkLesson(draft, { plan, req, lastAttempt: attempt === MAX_WRITER_ATTEMPTS });
    if (result.ok) {
      log({ step: "checker", ms: Date.now() - t, attempt });
      return {
        lesson: result.lesson,
        meta: { model: currentModel(), totalMs: Date.now() - t0, steps, warnings: result.warnings },
      };
    }
    issues = result.issues;
    log({ step: "checker", ms: Date.now() - t, attempt, issues });
  }
  // Last reply was unusable: salvage the most recent valid draft with the last-attempt cleanup.
  if (lastDraft !== undefined) {
    t = Date.now();
    const result = checkLesson(lastDraft, { plan, req, lastAttempt: true });
    if (result.ok) {
      log({ step: "checker", ms: Date.now() - t, attempt: MAX_WRITER_ATTEMPTS + 1 });
      return {
        lesson: result.lesson,
        meta: { model: currentModel(), totalMs: Date.now() - t0, steps, warnings: ["used the best earlier draft", ...result.warnings] },
      };
    }
  }
  throw new LessonGenerationError(`Lesson failed the schema check after ${MAX_WRITER_ATTEMPTS} tries.`, issues, steps);
}

export class LessonGenerationError extends Error {
  constructor(message: string, public issues: string[], public steps: StepLog[]) {
    super(message);
    this.name = "LessonGenerationError";
  }
}
