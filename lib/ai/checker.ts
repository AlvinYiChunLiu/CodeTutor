/**
 * Step 3: Checker — repairs the small, predictable LLM mistakes in code, then runs the
 * shared Lesson schema. Anything it can't safely repair is returned as `issues`
 * so the Writer can fix it on a retry.
 */
import { Lesson } from "../schema";
import type { Plan } from "./planner";
import type { LessonRequest } from "./request";

type Any = any; // the draft is untrusted model output

export type CheckResult =
  | { ok: true; lesson: Lesson; warnings: string[] }
  | { ok: false; issues: string[]; warnings: string[] };

export function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.slice(0, 15).map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Narration is read aloud: strip markdown that TTS would read literally. */
const cleanSpoken = (s: string) => s.replace(/[`*_#]/g, "").replace(/\s+/g, " ").trim();

/** Remove " 3| " prefixes if the model copied our numbered listing. */
const stripLineNumbers = (code: string) => {
  const lines = code.split("\n");
  return lines.every((l) => /^\s*\d+\|\s?/.test(l) || l.trim() === "")
    ? lines.map((l) => l.replace(/^\s*\d+\|\s?/, "")).join("\n")
    : code;
};

function normalizeDiagram(d: Any, warnings: string[], where: string): Any {
  if (!d || typeof d !== "object") return d;
  const kind = str(d.kind ?? d.type).toLowerCase().replace(/[_\s-]/g, "");
  if (kind === "array" || kind === "list") {
    let values: Any[] = Array.isArray(d.values) ? d.values : [];
    if (values.length > 12) {
      warnings.push(`${where}: array trimmed to 12 values`);
      values = values.slice(0, 12);
    }
    values = values.map((v) => (typeof v === "number" ? v : str(v)));
    const inRange = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < values.length;
    return {
      kind: "array",
      values,
      highlight: (Array.isArray(d.highlight) ? d.highlight : []).map(Number).filter(inRange),
      pointers: (Array.isArray(d.pointers) ? d.pointers : [])
        .map((p: Any) => ({ label: str(p?.label), index: Number(p?.index) }))
        .filter((p: Any) => p.label && inRange(p.index)),
    };
  }
  if (kind === "callstack" || kind === "stack") {
    const frames = (Array.isArray(d.frames) ? d.frames : []).slice(0, 8).map((f: Any) => {
      const vars: Record<string, string> = {};
      if (f?.vars && typeof f.vars === "object") for (const [k, v] of Object.entries(f.vars)) vars[k] = str(v);
      const frame: Any = { call: str(f?.call), vars };
      if (f?.returns !== undefined && f?.returns !== null) frame.returns = str(f.returns);
      return frame;
    });
    return { kind: "callstack", frames };
  }
  return d;
}

function normalizeScene(s: Any, mainCode: string, warnings: string[], where: string): Any {
  if (!s || typeof s !== "object") return s;
  let type = str(s.type).toLowerCase();
  // Models sometimes put the diagram kind in "type".
  if (["array", "callstack", "call_stack"].includes(type)) {
    s = { ...s, diagram: s.diagram ?? { ...s, kind: type } };
    type = "diagram";
  }
  const narration = cleanSpoken(str(s.narration));
  const words = narration.split(" ").length;
  if (words > 55) warnings.push(`${where}: narration is long (${words} words)`);

  switch (type) {
    case "title":
      return { type, heading: str(s.heading ?? s.title), ...(s.subheading ? { subheading: str(s.subheading) } : {}), narration };
    case "code": {
      const code = stripLineNumbers(str(s.code).trim() ? str(s.code).replace(/\s+$/, "") : mainCode);
      const lineCount = code.split("\n").length;
      const raw: Any[] = Array.isArray(s.highlightLines) ? s.highlightLines : Array.isArray(s.lines) ? s.lines : [];
      const lines = [...new Set(raw.map(Number))].filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);
      const valid = lines.filter((n) => n <= lineCount);
      if (valid.length < lines.length) warnings.push(`${where}: dropped highlight lines past line ${lineCount}`);
      return { type, code, highlightLines: valid, narration };
    }
    case "output":
      return { type, output: str(s.output ?? s.example?.output), narration };
    case "diagram":
      return { type, diagram: normalizeDiagram(s.diagram, warnings, where), narration };
    case "recap": {
      const points = (Array.isArray(s.points) ? s.points : Array.isArray(s.recapPoints) ? s.recapPoints : [])
        .map((p: unknown) => cleanSpoken(str(p)))
        .filter(Boolean)
        .slice(0, 5);
      return { type, points, narration };
    }
    default:
      return { ...s, type, narration };
  }
}

export function checkLesson(
  draft: unknown,
  ctx: { plan: Plan; req: LessonRequest; lastAttempt: boolean },
): CheckResult {
  const warnings: string[] = [];
  const issues: string[] = [];
  const d: Any = draft && typeof draft === "object" ? draft : {};

  let chapters: Any[] = (Array.isArray(d.chapters) ? d.chapters : [])
    .map((c: Any, ci: number) => ({
      title: str(c?.title, `Part ${ci + 1}`),
      scenes: (Array.isArray(c?.scenes) ? c.scenes : []).map((s: Any, si: number) =>
        normalizeScene(s, ctx.plan.mainCode, warnings, `chapters.${ci}.scenes.${si}`),
      ),
    }))
    .filter((c: Any) => c.scenes.length > 0);

  if (chapters.length === 0) {
    return { ok: false, issues: ['"chapters" is missing or every chapter has no scenes.'], warnings };
  }

  const title = str(d.title).trim() || ctx.plan.title;
  const summary = str(d.summary).trim() || ctx.plan.summary;
  const all = () => chapters.flatMap((c) => c.scenes);

  // Opening title card: easy to synthesize, so just fix it.
  if (all()[0]?.type !== "title") {
    warnings.push("added a missing title scene");
    chapters[0].scenes.unshift({ type: "title", heading: title, subheading: summary, narration: `Let's learn about ${title}. ${summary}` });
  }
  // Closing recap: ask the writer first (better content); synthesize only on the last attempt.
  if (all().at(-1)?.type !== "recap") {
    if (ctx.lastAttempt) {
      warnings.push("added a missing recap scene");
      chapters.at(-1).scenes.push({
        type: "recap",
        points: chapters.map((c) => c.title).slice(0, 5),
        narration: `That's a wrap. ${summary}`,
      });
    } else {
      issues.push('The last scene of the last chapter must be { "type": "recap", "points": [...], "narration": "..." }.');
    }
  }

  const n = all().length;
  // Quality gates: ask the writer to fix these, but accept on the last attempt rather than fail.
  if (n < 4) issues.push(`Only ${n} scenes. Write at least 7.`);
  else if (n < 7 && !ctx.lastAttempt) issues.push(`Only ${n} scenes. Write 7 to 11: split the code walkthrough into more scenes.`);
  const codeScenes = all().filter((s: Any) => s.type === "code");
  const wide = codeScenes.filter((s: Any) => s.highlightLines.length > 4).length;
  if (!ctx.lastAttempt && codeScenes.length < 3) {
    issues.push(`Only ${codeScenes.length} code scene(s). Walk through the code in at least 3 code scenes, each highlighting different 1–3 lines.`);
  } else if (!ctx.lastAttempt && wide) {
    issues.push(`${wide} code scene(s) highlight more than 4 lines. Split them so each highlights 1–3 lines.`);
  }
  if (n > 18) warnings.push(`${n} scenes is a long video`);

  // Ids are ours, not the model's: always unique and stable.
  chapters = chapters.map((c, ci) => ({
    id: `c${ci + 1}`,
    title: c.title,
    scenes: c.scenes.map((s: Any, si: number) => ({ id: `c${ci + 1}-s${si + 1}`, ...s })),
  }));

  const candidate = {
    version: 1 as const,
    title,
    summary,
    level: ctx.req.level,
    codeLanguage: ctx.plan.codeLanguage,
    chapters,
  };

  const parsed = Lesson.safeParse(candidate);
  if (!parsed.success) issues.push(...formatIssues(parsed.error.issues));
  if (issues.length) return { ok: false, issues, warnings };
  return { ok: true, lesson: parsed.data!, warnings };
}
