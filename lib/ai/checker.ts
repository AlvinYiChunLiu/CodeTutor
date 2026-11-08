/**
 * Step 3: Checker — repairs the small, predictable LLM mistakes in code, then runs the
 * shared Lesson schema. Anything it can't safely repair is returned as `issues`
 * so the Writer can fix it on a retry.
 */
import { Lesson, Scene } from "../schema";
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

/**
 * Does `code` define a function that calls itself? Works for Python and brace languages by
 * looking for the function's own name inside the indented lines under its definition.
 */
export function isRecursive(code: string): boolean {
  const lines = code.split("\n");
  const defRe = /^(\s*)(?:def|function|(?:public|private|static|\s)*[\w<>\[\]]+)\s+(\w+)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(defRe);
    if (!m || ["if", "for", "while", "return", "switch", "catch", "new"].includes(m[2])) continue;
    const indent = m[1].length;
    const call = new RegExp(`\\b${m[2]}\\s*\\(`);
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim()) continue;
      if (l.length - l.trimStart().length <= indent && !/^\s*[})\]]/.test(l)) break; // left the body
      if (call.test(l)) return true;
    }
  }
  // JS arrow functions: const f = (n) => ... f(n - 1)
  const arrow = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
  if (arrow) {
    const after = code.slice(code.indexOf(arrow[0]) + arrow[0].length);
    const body = after.split(/\n(?=\S)/)[0];
    if (new RegExp(`\\b${arrow[1]}\\s*\\(`).test(body)) return true;
  }
  return false;
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

  // Last attempt: salvage instead of failing. Drop scenes the schema rejects (e.g. an invented
  // scene type or diagram kind) and fill in an empty recap.
  if (ctx.lastAttempt) {
    chapters = chapters
      .map((c, ci) => ({
        ...c,
        scenes: c.scenes.filter((s: Any, si: number) => {
          if (s?.type === "recap" && Array.isArray(s.points) && s.points.length === 0) {
            s.points = chapters.map((ch) => ch.title).slice(0, 5);
          }
          const ok = Scene.safeParse({ id: "x", ...s }).success;
          if (!ok) warnings.push(`dropped invalid scene chapters.${ci}.scenes.${si} (type "${s?.type}")`);
          return ok;
        }),
      }))
      .filter((c) => c.scenes.length > 0);
    if (chapters.length === 0) return { ok: false, issues: ["No valid scenes left."], warnings };
  }

  const codeLines = ctx.plan.mainCode.split("\n").filter((l) => l.trim()).length;
  const n = all().length;
  // Quality gates: ask the writer to fix these, but accept on the last attempt rather than fail.
  if (n < 4) issues.push(`Only ${n} scenes. Write at least 7.`);
  else if (n < (codeLines <= 3 ? 5 : 7) && !ctx.lastAttempt) issues.push(`Only ${n} scenes. Write 7 to 11: split the code walkthrough into more scenes.`);
  const codeScenes = all().filter((s: Any) => s.type === "code");
  const wide = codeScenes.filter((s: Any) => s.highlightLines.length > 4).length;
  // A 2-line program can't have 3 different code scenes, so scale the minimum to the code.
  const minCode = Math.min(3, Math.max(1, codeLines - 1));
  if (!ctx.lastAttempt && codeScenes.length < minCode) {
    issues.push(`Only ${codeScenes.length} code scene(s). Walk through the code in at least ${minCode} code scenes, each highlighting different 1–3 lines.`);
  } else if (!ctx.lastAttempt && wide) {
    issues.push(`${wide} code scene(s) highlight more than 4 lines. Split them so each highlights 1–3 lines.`);
  }
  if (n > 13 && !ctx.lastAttempt) issues.push(`${n} scenes is too long. Use 7 to 11: merge code scenes about neighbouring lines and drop repeats.`);
  else if (n > 18) warnings.push(`${n} scenes is a long video`);
  const outputs = all().filter((s: Any) => s.type === "output").length;
  if (outputs > 1 && !ctx.lastAttempt) issues.push(`There are ${outputs} output scenes. Use exactly one, with the complete printed output.`);

  // Call stacks: returns must fill in from the top, and recursion needs the 3-step sequence.
  const stacks = all().filter((s: Any) => s.type === "diagram" && s.diagram?.kind === "callstack");
  stacks.forEach((s: Any) => {
    const frames: Any[] = s.diagram.frames ?? [];
    const firstReturn = frames.findIndex((f) => f.returns !== undefined);
    if (firstReturn !== -1 && frames.slice(firstReturn).some((f) => f.returns === undefined)) {
      if (ctx.lastAttempt) {
        // Repair: a call can't return while a call above it is still running.
        frames.slice(0, frames.findLastIndex((f) => f.returns === undefined)).forEach((f) => delete f.returns);
        warnings.push("fixed call-stack returns that weren't filled from the top");
      } else {
        issues.push(`A call-stack diagram has "returns" on a lower frame while a frame above it has none. Calls finish from the top: only the top frames can have "returns".`);
      }
    }
  });
  // Every stack frame's return value must agree with the trace the writer worked out first.
  const norm = (v: unknown) => str(v).replace(/\s+/g, "").replace(/^['"]|['"]$/g, "");
  const traced = new Map<string, string>();
  for (const t of Array.isArray(d.trace) ? d.trace : []) if (t?.call && t?.returns !== undefined) traced.set(norm(t.call), norm(t.returns));
  const wrong = new Set<string>();
  for (const st of stacks) for (const f of st.diagram.frames ?? []) {
    const want = traced.get(norm(f.call));
    if (f.returns !== undefined && want !== undefined && norm(f.returns) !== want) wrong.add(`${f.call} shows ${f.returns} but your trace says ${want}`);
  }
  if (wrong.size) {
    if (ctx.lastAttempt) warnings.push(`call-stack values disagree with the trace: ${[...wrong].join("; ")}`);
    else issues.push(`Call-stack return values disagree with your trace: ${[...wrong].join("; ")}. Recheck the trace step by step from the base case, then make every diagram and narration match it.`);
  }
  if (!ctx.lastAttempt && isRecursive(ctx.plan.mainCode) && traced.size === 0) {
    issues.push(`The code is recursive but "trace" is empty. Fill "trace" first: every call with its return value, from the base case up.`);
  }

  const lastStack: Any = stacks.at(-1);
  if (!ctx.lastAttempt && stacks.length >= 3 && lastStack.diagram.frames.some((f: Any) => f.returns === undefined)) {
    issues.push(`The last call-stack scene (unwinding) must show EVERY frame finished: give every frame its "returns" value.`);
  }
  if (!ctx.lastAttempt && isRecursive(ctx.plan.mainCode) && stacks.length < 3) {
    issues.push(
      `The code is recursive but there ${stacks.length === 1 ? "is 1 call-stack diagram" : `are ${stacks.length} call-stack diagrams`}. ` +
        `Add 3 call-stack scenes in a row with the same frames: growing (no "returns"), base case (only the top frame returns), unwinding (every frame returns).`,
    );
  }

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
