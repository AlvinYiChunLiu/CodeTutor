/**
 * All prompt text lives here so it can be tuned without touching pipeline code.
 */
import type { LessonRequest } from "./request";

const MODE_GOAL: Record<LessonRequest["mode"], string> = {
  "explain-code": "Explain what the learner's code does, line by line, and why.",
  "explain-solution": "Walk through the learner's solution step by step: the idea, how each part works, and why it is correct.",
  "teach-concept": "Teach the programming concept the learner asked about, using one short example program you write.",
};

const LEVEL_STYLE: Record<LessonRequest["level"], string> = {
  beginner: "The learner is a beginner. Use plain words, one idea at a time, and a friendly analogy where it helps.",
  intermediate: "The learner knows the basics. Be precise, mention edge cases and time complexity where relevant.",
};

const ADJUST: Record<NonNullable<LessonRequest["adjust"]>, string> = {
  simpler: "The learner asked for a SIMPLER version: fewer chapters, shorter sentences, more analogies, no jargon.",
  deeper: "The learner asked to GO DEEPER: add a chapter on edge cases or how it works under the hood, and mention complexity.",
};

export function audienceNotes(req: LessonRequest): string {
  return [MODE_GOAL[req.mode], LEVEL_STYLE[req.level], req.adjust ? ADJUST[req.adjust] : ""]
    .filter(Boolean)
    .join("\n");
}

/** Prefix each line with its 1-based number so the model gets highlightLines right. */
export function numberLines(code: string): string {
  return code
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(2, " ")}| ${line}`)
    .join("\n");
}

// ---------------------------------------------------------------- Planner

export const PLANNER_SYSTEM = `You are the lesson planner for CodeTutor, an app that turns code into a short narrated explainer video (1–3 minutes).
You plan the lesson outline only. You reply with ONE JSON object and nothing else: no markdown, no comments.`;

export function plannerUser(req: LessonRequest, needsExample: boolean): string {
  return `${audienceNotes(req)}

Learner's ${needsExample ? "question" : "code"}:
"""
${req.input}
"""

${req.language === "auto" ? "Detect the programming language." : `The language is ${req.language}.`}

Reply with this JSON shape:
{
  "title": "short lesson title, under 50 characters",
  "summary": "one sentence: what the learner will understand by the end",
  "codeLanguage": "python" | "javascript" | "typescript" | "java" | "c" | "cpp",${
    needsExample
      ? `
  "mainCode": "a short, correct example program that demonstrates the concept, ending with a call that prints something. At most 12 lines, each under 60 characters (it is shown on a video screen). Use short strings like print(\"before\")",`
      : ""
  }
  "chapters": [
    { "title": "chapter name, 2–5 words", "beats": ["one short note per scene in this chapter"] }
  ]
}

Rules:
- 3 or 4 chapters, 7 to 11 beats in total. Never fewer than 7.
- The first beat of the first chapter is a title card. The last beat of the last chapter is a recap.
- Each beat is one of: title card, code (say which 1–3 lines), output (what gets printed for a concrete input), array diagram (for lists/arrays/indexes), call-stack diagram (for recursion or nested function calls), recap.
- Walk through the code: at least 3 code beats, each about a DIFFERENT 1–3 lines, in the order the code runs. Never one beat for the whole program.
- Use a diagram only where it genuinely helps; at most 2 diagrams.

Good shape for a recursion lesson (adapt, don't copy):
title card → code: the function signature → code: the base case → code: the recursive call → call-stack diagram going down → call-stack diagram returning → output → recap`;
}

// ---------------------------------------------------------------- Writer

export const WRITER_SYSTEM = `You are the scriptwriter for CodeTutor, an app that turns code into a short narrated explainer video.
A friendly teacher voice reads every "narration" aloud, so write it to be SPOKEN:
- 1 or 2 short sentences per scene, at most 40 words.
- No markdown, no backticks, no emoji. Say symbols in words ("n minus one", "i plus plus").
- Everything you state about the code (outputs, traced values, line numbers) must be correct.
You reply with ONE JSON object and nothing else.`;

export function writerUser(args: {
  req: LessonRequest;
  plan: unknown;
  mainCode: string;
}): string {
  return `${audienceNotes(args.req)}

Lesson plan:
${JSON.stringify(args.plan, null, 2)}

Main code (line numbers are shown for you only — never include them in "code"):
${numberLines(args.mainCode)}

Write the full lesson as JSON with this shape:
{
  "title": "string",
  "summary": "string",
  "chapters": [
    { "title": "string", "scenes": [ SCENE, ... ] }
  ]
}

Each SCENE is exactly one of:
{ "type": "title", "heading": "string", "subheading": "string", "narration": "string" }
{ "type": "code", "highlightLines": [2, 3], "narration": "string" }
{ "type": "output", "output": "exactly what the program prints", "narration": "string" }
{ "type": "diagram", "diagram": { "kind": "array", "values": [5, 2, 9], "highlight": [1], "pointers": [{ "label": "i", "index": 1 }] }, "narration": "string" }
{ "type": "diagram", "diagram": { "kind": "callstack", "frames": [{ "call": "f(3)", "vars": { "n": "3" }, "returns": "6" }] }, "narration": "string" }
{ "type": "recap", "points": ["3 to 5 short takeaways"], "narration": "string" }

Rules:
- Use ONLY these 5 scene types and only "array" or "callstack" diagrams. Never invent others (no "concept", "explanation", "table"). To explain an idea without pointing at code, use a code scene with "highlightLines": [].
- Follow the plan: one scene per beat, same chapters, same order.
- The very first scene is "title"; the very last scene is "recap".
- Code scenes show the main code automatically. Only add a "code" field if you must show a DIFFERENT snippet.
- "highlightLines" are 1-based line numbers from the main code above: only the 1–3 lines this scene's narration talks about, never the whole program.
- Array diagrams: "values" are the actual array contents at that moment (max 12), "highlight" and "pointers" use 0-based indexes.
- Call-stack diagrams: frames[0] is the bottom (first call); all "vars" values and "returns" are strings. "returns" is the function's RETURN VALUE, only once that call has finished; never put printed text there, and leave it out for functions that return nothing.
- "output" must be the true printed output of the code for the example used.
- Trace the code honestly. Before narrating what happens when calls return, check which lines run AFTER the recursive call; if none, say the calls simply finish and nothing new happens. Never claim something is printed, computed or reversed unless that line actually does it.`;
}

export function writerRetryUser(issues: string[]): string {
  return `Your JSON had these problems:
${issues.map((i) => `- ${i}`).join("\n")}

Fix them and reply with the complete corrected JSON object only.`;
}
