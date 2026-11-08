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

/** Same code apart from spacing and quote style? (Models rarely copy a program character for character.) */
const sameCode = (a: string, b: string) => {
  const squash = (c: string) => c.replace(/["'`]/g, '"').replace(/\s+/g, "");
  return squash(a) === squash(b);
};

function normalizeScene(s: Any, mainCode: string, warnings: string[], where: string, fixedCode?: string): Any {
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
      let code = stripLineNumbers(str(s.code).trim() ? str(s.code).replace(/\s+$/, "") : mainCode);
      // Fix scenes: the writer marks them "fixed": true and we fill in the exact fixed program
      // (also when it retyped the fixed program with small spacing differences).
      if (fixedCode && (s.fixed === true || s.fixed === "true" || sameCode(code, fixedCode))) code = fixedCode;
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

// ---------------------------------------------------------------- highlight alignment
// Models often number lines one off ("we define the function" lighting up line 2). Compare what each
// narration talks about with what each line does, and move a highlight only when it clearly fits better.
const LINE_IDEAS: [string, RegExp][] = [
  ["define", /^\s*(def|function|async\s+function|class|public|private|static)\b|^\s*(int|void|double|float|char|bool|boolean|string|auto|long)\s+\w+\s*\(/],
  ["loop", /^\s*(for|while|do)\b|\.(forEach|map|filter|reduce)\s*\(/],
  ["check", /^\s*(if|elif|else\s+if|else|switch|case)\b|\?.*:/],
  ["return", /^\s*return\b/],
  ["print", /\b(print|console\.log|printf|puts|cout|System\.out\.print)/],
  ["assign", /^\s*(let|const|var|int|double|float|char|bool|auto|long|string)?\s*[\w.[\]]+\s*([-+*/%]?=)(?!=)/],
  ["import", /^\s*(import|from|#include|using|require)\b/],
];
const SPOKEN_IDEAS: [string, RegExp][] = [
  ["define", /\b(defin\w*|declar\w*|function (called|named)|takes? (a|an|the|two|one)|signature|parameters?)\b/i],
  ["loop", /\b(loop\w*|each|iterat\w*|go(es)? through|repeat\w*|every (number|item|element))\b/i],
  ["check", /\b(check\w*|if|whether|compar\w*|condition\w*|greater|less|equal|otherwise|else)\b/i],
  ["return", /\b(return\w*|hands? back|gives? back|send\w* back)\b/i],
  ["print", /\b(print\w*|display\w*|show\w* (it|the result)|outputs?)\b/i],
  ["assign", /\b(set\w*|initiali\w*|start\w* (at|with|from)|assign\w*|stor\w*|updat\w*|becomes?|variable)\b/i],
  ["import", /\b(import\w*|includ\w*|bring\w* in|librar\w*|module)\b/i],
];
const KEYWORDS = new Set("def function return for while if elif else in and or not int void const let var print console log true false none null class public static import from include std cout printf the".split(" "));
const flat = (w: string) => w.toLowerCase().replace(/_/g, "");
/** generateLessonAudio / find_max → its whole name plus each word in it (generate, lesson, audio). */
const nameWords = (w: string) => [flat(w), ...w.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_]+/).map((p) => p.toLowerCase())].filter((p) => p.length >= 3);

function lineFit(narration: string, lines: string[], ownNames: string[] = []): { ideas: number; score: number } {
  const said = new Set(SPOKEN_IDEAS.filter(([, re]) => re.test(narration)).map(([k]) => k));
  if (/\b(calls? itself|recursive call|calling itself)\b/i.test(narration)) said.add("recurse");
  if (/\bbase case|\bstop(s|ping)?\b/i.test(narration)) said.add("base");
  const shown = new Set(lines.flatMap((l) => LINE_IDEAS.filter(([, re]) => re.test(l)).map(([k]) => k)));
  // A line that calls a function defined in this code (not the def line itself) is the recursive / call step.
  if (lines.some((l) => !LINE_IDEAS[0][1].test(l) && ownNames.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(l)))) shown.add("recurse");
  if (lines.some((l) => /^\s*(if|elif|else|return)\b/.test(l))) shown.add("base");
  const ideas = [...said].filter((k) => shown.has(k)).length;
  const spokenWords = new Set(narration.split(/[^A-Za-z0-9_]+/).filter((w) => w.length >= 3).flatMap(nameWords));
  const names = new Set(lines.flatMap((l) => l.split(/[^A-Za-z0-9_]+/)).filter((w) => w.length >= 3 && !KEYWORDS.has(w.toLowerCase())).flatMap(nameWords));
  const shared = [...names].filter((n) => spokenWords.has(n)).length;
  return { ideas, score: ideas * 2 + shared };
}

/** Move a code scene's highlight by a line or two when its narration clearly describes neighbouring lines. */
export function alignHighlights(scenes: Any[], mainCode: string): number {
  const code = mainCode.split("\n");
  const ownNames = [...mainCode.matchAll(/(?:\bdef|\bfunction)\s+(\w+)|^\s*(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*\{/gm)].map((m) => m[1] ?? m[2]).filter(Boolean);
  let moved = 0;
  for (const s of scenes) {
    if (s.type !== "code" || s.code !== mainCode || !s.highlightLines?.length || s.highlightLines.length > 3) continue;
    const pick = (shift: number) => s.highlightLines.map((n: number) => n + shift);
    const valid = (ls: number[]) => ls.every((n) => n >= 1 && n <= code.length && code[n - 1].trim());
    const now = lineFit(s.narration, pick(0).map((n: number) => code[n - 1] ?? ""), ownNames);
    if (now.score > 0) continue; // the narration already mentions something on the highlighted line
    let best = { shift: 0, score: now.score };
    for (const shift of [-1, 1, -2, 2]) {
      const ls = pick(shift);
      if (!valid(ls)) continue;
      const fit = lineFit(s.narration, ls.map((n: number) => code[n - 1]), ownNames);
      if (fit.ideas > 0 && fit.score >= best.score + 2) best = { shift, score: fit.score };
    }
    if (best.shift) {
      s.highlightLines = pick(best.shift);
      moved++;
    }
  }
  return moved;
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
        normalizeScene(s, ctx.plan.mainCode, warnings, `chapters.${ci}.scenes.${si}`, ctx.plan.bug ? ctx.plan.fixedCode : undefined),
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

  {
    const moved = alignHighlights(all(), ctx.plan.mainCode);
    if (moved) warnings.push(`moved ${moved} highlight(s) to the line the narration describes`);
  }
  const codeLines = ctx.plan.mainCode.split("\n").filter((l) => l.trim()).length;
  // A buggy program gets two output scenes: what it really prints (or its error), then the fixed program's output.
  const maxOutputs = ctx.plan.bug ? 2 : 1;
  // Repeats: the same lines explained in several code scenes (usually a loop played out iteration by iteration).
  // Pointing at the faulty line again to name the bug is not a repeat.
  const namesBug = (s: Any) => Boolean(ctx.plan.bug) && /\b(bug|buggy|mistake|wrong|problem|fix|fixed)\b/i.test(str(s.narration));
  const key = (s: Any) => (s.type === "code" && s.highlightLines.length && !namesBug(s) ? `${s.code}::${s.highlightLines.join(",")}` : "");
  const seenKeys = new Set<string>();
  let repeats = 0;
  for (const s of all()) {
    const k = key(s);
    if (k && seenKeys.has(k)) repeats++;
    if (k) seenKeys.add(k);
  }
  if (repeats && !ctx.lastAttempt) {
    issues.push(`${repeats} code scene(s) repeat lines that an earlier scene already highlighted. Explain each line once; for a loop, walk through the body once, then sum up the other iterations in one scene.`);
  } else if (repeats || (ctx.lastAttempt && all().filter((s: Any) => s.type === "output").length > maxOutputs)) {
    // Last attempt: drop the repeated code scenes and merge the output pieces into one scene
    // (with a bug: keep the first and the last, the buggy and the fixed output).
    seenKeys.clear();
    const allOuts = all().filter((s: Any) => s.type === "output");
    const outs = allOuts.length > maxOutputs ? (ctx.plan.bug ? allOuts.slice(1) : allOuts) : [];
    const merged = [...new Set(outs.map((o: Any) => str(o.output).replace(/\n+$/, "")))].join("\n");
    const keepOut = outs.at(-1);
    chapters = chapters
      .map((c) => ({
        ...c,
        scenes: c.scenes.filter((s: Any) => {
          const k = key(s);
          if (k) {
            if (seenKeys.has(k)) return false;
            seenKeys.add(k);
          }
          if (s.type === "output" && outs.length > 1 && outs.includes(s)) {
            if (s !== keepOut) return false;
            s.output = merged;
          }
          return true;
        }),
      }))
      .filter((c) => c.scenes.length > 0);
    warnings.push(`removed ${repeats} repeated code scene(s)${outs.length > 1 ? ` and merged ${outs.length} output scenes` : ""}`);
  }

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
  const maxScenes = (ctx.req.adjust === "deeper" ? 16 : 13) + (ctx.plan.bug ? 2 : 0);
  if (n > maxScenes && !ctx.lastAttempt) issues.push(`${n} scenes is too long. Use 7 to 11: merge code scenes about neighbouring lines and drop repeats.`);
  else if (n > 18) warnings.push(`${n} scenes is a long video`);
  const outputs = all().filter((s: Any) => s.type === "output").length;
  if (outputs > maxOutputs && !ctx.lastAttempt) {
    issues.push(
      ctx.plan.bug
        ? `There are ${outputs} output scenes. Use exactly two: what the original code prints (or its error message), then what the fixed code prints.`
        : `There are ${outputs} output scenes. Use exactly one, with the complete printed output.`,
    );
  }
  // Buggy code: the lesson must say so and show the fix, or the learner leaves thinking the bug is correct.
  if (ctx.plan.bug && !ctx.lastAttempt) {
    const spokenAll = all().map((s: Any) => str(s.narration)).join(" ");
    const fixed = (ctx.plan.fixedCode ?? "").trim();
    const showsFix = all().some((s: Any) => s.type === "code" && str(s.code).trim() === fixed);
    if (!/\b(bug|buggy|mistake|wrong|error|problem|fix|fixed|incorrect)\b/i.test(spokenAll)) {
      issues.push(`The code has a bug (${ctx.plan.bug}) but the narration never says so. In a "Spotting the bug" chapter, say plainly that this is a bug and why.`);
    }
    if (!showsFix) {
      issues.push(`Add the fix: a code scene with "fixed": true (the app shows the plan's fixedCode) and "highlightLines" on the changed line(s), then an output scene with what the fixed code prints.`);
    } else if (outputs < 2) {
      issues.push(`Add a second output scene after the fix, showing what the fixed code prints.`);
    }
  }
  // Narration is read aloud: pasted code ("for j in range(len(nums) - 1 - i):") sounds broken.
  const codey = (t: string) => /\b(def|function|class|for|while|if|return)\b[^.!?]*[:{]\s*$/m.test(t) || /\w\[[^\]]*\]|\w\([^)]*\)\s*[:{]|==|!=|\+=|=>|;\s*$/.test(t);
  const pasted = all().filter((s: Any) => s.type !== "title" && codey(str(s.narration))).length;
  if (pasted && !ctx.lastAttempt) issues.push(`${pasted} narration(s) contain pasted code. Narration is read aloud: explain each line in plain spoken words (e.g. "we compare each number with the one after it"), never copy the code itself.`);
  // "Explain simpler" / "Go deeper" must visibly change the lesson, or the buttons look broken.
  const spoken = all().map((s: Any) => str(s.narration));
  if (ctx.req.adjust === "simpler" && !ctx.lastAttempt) {
    const long = spoken.filter((t) => t.split(" ").length > 30).length;
    const analogies = spoken.filter((t) => /\b(like a|like an|imagine|think of|just like|similar to)\b/i.test(t)).length;
    if (long) issues.push(`This is the SIMPLER version but ${long} narration(s) are over 30 words. Keep every narration under 25 words.`);
    if (analogies < 1) issues.push(`This is the SIMPLER version but it has no everyday analogy. Add one scene that says "Think of it like…" or "Imagine…".`);
  }
  if (ctx.req.adjust === "deeper" && !ctx.lastAttempt) {
    const text = spoken.join(" ");
    const topics = [
      /\b(big[- ]?o|time complexity|o of n|linear time|quadratic|logarithmic)\b/i,
      /\b(memory|space|call stack grows|stack frames?)\b/i,
      /\b(edge case|empty|negative|zero|none|null)\b/i,
      /\b(recursion ?limit|recursionerror|stack overflow|pitfall|infinite)\b/i,
    ].filter((re) => re.test(text)).length;
    const hasChapter = chapters.some((c) => /deeper|under the hood|beyond/i.test(c.title));
    if (topics < 3 || !hasChapter) {
      issues.push(`This is the GO DEEPER version but it ${hasChapter ? "" : 'has no "Going deeper" chapter and '}covers ${topics} of 4 deeper topics. Add a "Going deeper" chapter before the recap covering time complexity, memory, edge cases, and limits or pitfalls.`);
    }
  }
  const rambling = all().filter((s: Any) => str(s.narration).split(" ").length > 60).length;
  if (rambling && !ctx.lastAttempt) issues.push(`${rambling} scene(s) have narration over 60 words. Keep each narration to 1 or 2 short sentences (under 40 words).`);
  // Output can't contain a string the code only RETURNS (never prints), e.g. "stop" from `return 'stop'`.
  {
    const code = ctx.plan.mainCode;
    const literals = (re: RegExp) => new Set([...code.matchAll(re)].flatMap((m) => [...m[1].matchAll(/(['"`])((?:(?!\1).)*)\1/g)].map((q) => q[2])));
    // Only a plain `return 'stop'` (the whole return value is one string), not a literal buried in other code.
    const returned = literals(/\breturn\s+((['"`])[^'"`\n]*\2)\s*;?\s*$/gm);
    const printed = literals(/(?:\bprint|console\.log|System\.out\.print(?:ln)?|printf|\bcout\s*<<)\s*\(?([^\n;]*)/g);
    // If a call's result is printed directly (print(f(3))) or through a variable (x = f(3); print(x)), returns can show up.
    const callPrinted =
      /(?:print|console\.log|System\.out\.print(?:ln)?)\s*\(\s*\w+\s*\(/.test(code) ||
      [...code.matchAll(/\b(\w+)\s*=\s*(?:await\s+)?\w+\s*\(/g)].some((m) =>
        new RegExp(`(?:print|console\\.log|System\\.out\\.print(?:ln)?)\\s*\\([^)]*\\b${m[1]}\\b`).test(code),
      );
    for (const o of all().filter((s: Any) => s.type === "output")) {
      const lines = str(o.output).split("\n").map((l) => l.trim());
      const ghost = [...returned].filter((r) => r && !printed.has(r) && !callPrinted && lines.includes(r));
      if (ghost.length) {
        if (ctx.lastAttempt) {
          o.output = str(o.output).split("\n").filter((l) => !ghost.includes(l.trim())).join("\n");
          warnings.push(`removed returned-but-never-printed value(s) from the output: ${ghost.join(", ")}`);
        } else {
          issues.push(`The output shows ${ghost.map((g) => `"${g}"`).join(", ")}, but the code only RETURNS that value and never prints it. Show only what print statements actually print.`);
        }
      }
    }
  }
  const order = all().map((s: Any) => s.type);
  if (!ctx.lastAttempt && order.includes("output") && order.lastIndexOf("diagram") > order.indexOf("output")) {
    issues.push(`The output scene comes before a diagram scene. Put the output scene after all the diagrams, right before the recap.`);
  }
  const prints = /\bprint\s*\(|console\.log\s*\(|System\.out\.print|printf\s*\(|\bcout\s*<</.test(ctx.plan.mainCode);
  if (prints && outputs === 0 && !ctx.lastAttempt) issues.push(`The code prints something but there is no output scene. Add one { "type": "output", "output": "<exact printed text>" } before the recap.`);

  // Only the opening scene is a title card; extra ones were being used as section headers.
  const titles = all().filter((s: Any) => s.type === "title").length;
  if (titles > 1) {
    if (ctx.lastAttempt) {
      let seen = false;
      chapters = chapters
        .map((c) => ({ ...c, scenes: c.scenes.filter((s: Any) => s.type !== "title" || (!seen && (seen = true))) }))
        .filter((c) => c.scenes.length > 0);
      warnings.push(`dropped ${titles - 1} extra title scene(s)`);
    } else {
      issues.push(`There are ${titles} title scenes. Use exactly one (the first scene); chapters already have titles, so remove the title scenes used as section headers.`);
    }
  }

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

  // The first call (bottom frame) finishes last: its answer belongs only in the final stack scene.
  if (!ctx.lastAttempt && stacks.slice(0, -1).some((st: Any) => st.diagram.frames?.[0]?.returns !== undefined)) {
    issues.push(`A call-stack scene before the last one shows the first call (the bottom frame) already returning. The first call finishes last: show its answer only in the final call-stack scene.`);
  }

  // Frame names must use the function's real name from the code (factorial(3), not f(3)).
  const defined = new Set(
    [...ctx.plan.mainCode.matchAll(/(?:\bdef|\bfunction)\s+(\w+)|\b(\w+)\s*\([^)]*\)\s*\{|\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g)]
      .map((m) => m[1] ?? m[2] ?? m[3])
      .filter((n) => n && !["if", "for", "while", "switch", "catch", "main"].includes(n)),
  );
  const badNames = new Set<string>();
  for (const st of stacks) for (const f of st.diagram.frames ?? []) {
    const name = str(f.call).match(/^\s*(\w+)\s*\(/)?.[1];
    if (name && defined.size && !defined.has(name) && name !== "main") badNames.add(name);
  }
  if (badNames.size && !ctx.lastAttempt) {
    issues.push(`Call-stack frames use ${[...badNames].map((n) => `"${n}(...)"`).join(", ")} but the code defines ${[...defined].join(", ")}. Write each call with the function's real name, e.g. ${[...defined][0]}(3).`);
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
