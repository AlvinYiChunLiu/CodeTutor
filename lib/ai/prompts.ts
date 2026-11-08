/**
 * All prompt text lives here so it can be tuned without touching pipeline code.
 */
import type { LessonRequest } from "./request";

/**
 * Bug spotting for pasted code ("Spotting the bug" chapter + the fixed program). Switched OFF for now:
 * the writer struggled to add the fix reliably. Set to true to bring it back (planner, writer and checker all follow it).
 */
export const SPOT_BUGS = false;

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
  simpler:
    "The learner asked for a SIMPLER version. Use the simplest possible example, keep every narration under 25 words, " +
    "include at least 1 everyday analogy that starts with \"Think of it like\" or \"Imagine\" (recursion: Russian nesting dolls; loops: laps around a track; variables: labelled boxes; arrays: a row of lockers), and avoid jargon; if you must use a term, say what it means in plain words.",
  deeper:
    "The learner asked to GO DEEPER. Keep the normal walkthrough, then add a final chapter titled \"Going deeper\" (before the recap) " +
    "with at least 3 code scenes or diagram-free code scenes covering things a beginner lesson skips: time complexity (big-O, said in words), " +
    "memory / how the call stack or data grows, edge cases (empty input, zero, negative numbers), and limits or pitfalls " +
    "(e.g. Python's recursion limit and RecursionError). Be precise and correct.",
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
  "mainCode": "a short, correct, COMPLETE example program that demonstrates the concept (with any #include or import lines it needs, so it compiles and runs as is), ending with a call that prints something. At most 12 lines, each under 60 characters (it is shown on a video screen). Use short strings like print(\"before\")",`
      : ""
  }
${
    needsExample || !SPOT_BUGS
      ? ""
      : `
  "bug": null, or ONE plain sentence naming the bug and its effect (see BUGS below),
  "fixedCode": only when "bug" is set: the learner's COMPLETE program with the smallest change that fixes it,`
  }
  "chapters": [
    { "title": "chapter name, 2–5 words", "beats": ["one short note per scene in this chapter"] }
  ]
}

Rules:${
    needsExample || !SPOT_BUGS
      ? ""
      : `
- BUGS: before planning, run the learner's code in your head on its own input. It has a bug if it would crash or not compile or run (a missing colon, an undefined name, an index out of range), or if it gives a WRONG answer for what its names and comments say it should do (e.g. an average() that divides by len(nums) + 1, or a count_vowels() that never counts "u"). Style and speed are not bugs; if unsure, it is not a bug.
  If there is a bug: walk through the code as written with its REAL behaviour (its real output, or the error message if it cannot run), then add a chapter titled "Spotting the bug" right before the recap, with 3 beats: (1) a code beat on the faulty line saying what goes wrong and why, (2) a code beat showing fixedCode with the changed line, (3) an output beat with fixedCode's output. A lesson with a bug has exactly TWO output beats (the original's, or its error, then the fixed one) and up to 13 beats.`
  }
- 3 or 4 chapters, 7 to 11 beats in total. Never fewer than 7, never more than 11 (a GO DEEPER lesson: up to 15, with the extra beats in its "Going deeper" chapter).
- The first beat of the first chapter is a title card. The last beat of the last chapter is a recap.
- Each beat is one of: title card, code (say which 1–3 lines), output (what gets printed for a concrete input), array diagram (for lists/arrays/indexes), call-stack diagram (for recursion or nested function calls), recap.
- Walk through the code: at least 3 code beats, each about a DIFFERENT 1–3 lines, in the order the code runs. Never one beat for the whole program, and never two beats about the same lines. Keep a small block together (an if with its body = one beat).
- Exactly ONE output beat${SPOT_BUGS ? " (TWO when there is a bug)" : ""}, showing the program's full printed output at once, placed after every diagram and right before the recap.
- LOOPS: walk through the loop body ONCE, then ONE beat that sums up every iteration (e.g. "count goes 0, 1, 2, then 3 fails the check"). Never repeat the same lines for each iteration. An array diagram of the values the loop variable takes can show the iterations.
- Exactly ONE title card: the very first beat. Chapters already have titles, so never use a title card as a section header.
- If the code works through a list (a loop over it, sorting, searching), plan 2 or 3 array-diagram beats that show the list CHANGING step by step (e.g. after each pass of a sort), not just the final list.
- Use a diagram only where it genuinely helps; at most 3 diagrams.
- For a recursion CONCEPT, write an example function that RETURNS a value (factorial, sum of 1..n, list length), not one that only prints, so the call stack can show values coming back.
- If the code is RECURSIVE (a function calls itself), plan exactly 3 call-stack beats in a row: (1) the stack growing, (2) the base case returning, (3) the stack unwinding with every return value. Keep the example input small (e.g. 3) so the stack has at most 5 frames.

Good shape for a recursion lesson (adapt, don't copy):
title card → code: the function signature → code: the base case → code: the recursive call → call stack: growing → call stack: base case returns → call stack: unwinding → output → recap`;
}

// ---------------------------------------------------------------- Writer

export const WRITER_SYSTEM = `You are the scriptwriter for CodeTutor, an app that turns code into a short narrated explainer video.
A friendly teacher voice reads every "narration" aloud, so write it to be SPOKEN:
- 1 or 2 short sentences per scene, at most 40 words.
- No markdown, no backticks, no emoji. Say symbols in words ("n minus one", "count plus equals one").
- Never paste code into "narration": explain what the line does in plain words. The code is already on screen.
- Describe the code exactly as written in its language: don't mention syntax it doesn't have (no "plus plus" or parentheses around conditions in Python).
- Everything you state about the code (outputs, traced values, line numbers) must be correct for the code AS WRITTEN. Pasted code may contain mistakes: describe what it really does, never what its name suggests it was meant to do.
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
  "trace": [ { "call": "f(0)", "returns": "1", "how": "base case" }, { "call": "f(1)", "returns": "1", "how": "1 × f(0) = 1" } ],
  "title": "string",
  "summary": "string",
  "chapters": [
    { "title": "string", "scenes": [ SCENE, ... ] }
  ]
}

Each SCENE is exactly one of:
{ "type": "title", "heading": "string", "subheading": "string", "narration": "string" }
{ "type": "code", "highlightLines": [2, 3], "narration": "string" }${SPOT_BUGS ? `   (add "fixed": true to show the plan's fixedCode instead; only when the plan has a "bug")` : ""}
{ "type": "output", "output": "exactly what the program prints", "narration": "string" }
{ "type": "diagram", "diagram": { "kind": "array", "values": [5, 2, 9], "highlight": [1], "pointers": [{ "label": "i", "index": 1 }] }, "narration": "string" }
{ "type": "diagram", "diagram": { "kind": "callstack", "frames": [{ "call": "f(3)", "vars": { "n": "3" }, "returns": "6" }] }, "narration": "string" }
{ "type": "recap", "points": ["3 to 5 short takeaways"], "narration": "string" }

Rules:
- Use ONLY these 5 scene types and only "array" or "callstack" diagrams. Never invent others (no "concept", "explanation", "table"). To explain an idea without pointing at code, use a code scene with "highlightLines": [].
- Follow the plan's chapters and order, but these rules win over the plan: if beats repeat the same lines, play out a loop iteration by iteration, or add extra output beats, merge or drop them.
- The very first scene is "title"; the very last scene is "recap".
- Code scenes show the main code automatically. Only add a "code" field if you must show a DIFFERENT snippet.
- "highlightLines" are 1-based line numbers from the main code above: only the 1–3 lines this scene's narration talks about, never the whole program.
- Array diagrams: "values" are the actual array contents at that moment (max 12), "highlight" and "pointers" use 0-based indexes.
- Call-stack diagrams: frames[0] is the bottom (first call); all "vars" values and "returns" are strings. "returns" is the function's RETURN VALUE, only once that call has finished; never put printed text there, and leave it out for functions that return nothing.
- "trace" comes FIRST, before you write any scene: if the code has a function call (recursive or not), run the example by hand and list every call with its return value, starting from the call that finishes first and showing the arithmetic in "how" (factorial: f(0) = 1 base case, f(1) = 1 × f(0) = 1 × 1 = 1, f(2) = 2 × f(1) = 2 × 1 = 2, f(3) = 3 × f(2) = 3 × 2 = 6). Every "returns" in a call-stack diagram, every value in the narration and the "output" must match this trace exactly. No function calls → "trace": [].
- Work out "output" by stepping through the code line by line with the real values (a loop: write down each variable after every pass in your head), NOT from what the function's name promises. Example: a count_evens that checks "n % 2 == 1" really counts the ODD numbers, so say that and print that count.
- Write each frame's "call" with the function's real name from the code, e.g. "factorial(3)", never a shortened "f(3)".
- Calls finish from the TOP down, so only the top frames can have "returns": if a frame has "returns", every frame above it must too.
- For recursion, write 3 call-stack scenes with the SAME frames, changing only "returns":
  1. growing: no "returns" at all ("each call waits for the next one")
  2. base case: only the top frame has "returns"
  3. unwinding: EVERY frame has "returns", and each value is computed from the one above it (factorial: 1, 2, 6)
  A function that returns nothing returns "None" in Python and "undefined" in JavaScript.
- A stack shows ONE chain of calls that are waiting on each other. When a function calls itself more than once (like fib(n-1) + fib(n-2)), show only the path currently running, e.g. fib(3) → fib(2) → fib(1); never stack sibling calls like fib(1) and fib(0) on top of each other. Show the first call's final answer only in the LAST call-stack scene.
- Exactly ONE "title" scene, the first. Never use title scenes as section headers.
- Loops: explain the loop body's lines once. Never write a second code scene for lines already highlighted; sum up the remaining iterations in one scene's narration (or an array diagram of the loop variable's values, with a pointer on each).
- Array diagrams for a list being processed: 2 or 3 scenes showing the list as it changes, highlighting the items being compared or moved in that step.
- Exactly ONE output scene, with the program's complete printed output in "output"${SPOT_BUGS ? ` (TWO when the plan has a "bug": see BUGS)` : ""}.
- "output" must be the true printed output of the code for the example used. Only print / console.log / cout lines produce output: a value a function RETURNS is not shown unless the code prints it.
${SPOT_BUGS ? `- BUGS: only if the plan has a "bug". Never call the buggy line correct, intended or a good idea. Explain the code as written; the FIRST output scene shows what it really prints, or the exact error message if it cannot run (e.g. "SyntaxError: expected ':'"), never invented output. In the "Spotting the bug" chapter say plainly that this is a bug and why, in beginner words. The fix scenes are code scenes with "fixed": true and NO "code" field (the app shows the plan's fixedCode for you), with "highlightLines" on the changed line(s) of fixedCode; the SECOND output scene shows what fixedCode prints. A lesson with a bug has exactly two output scenes. Without a "bug" in the plan, ignore this rule.
` : ""}- Trace the code honestly. Before narrating what happens when calls return, check which lines run AFTER the recursive call; if none, say the calls simply finish and nothing new happens. Never claim something is printed, computed or reversed unless that line actually does it.`;
}

export function writerRetryUser(issues: string[]): string {
  return `Your JSON had these problems:
${issues.map((i) => `- ${i}`).join("\n")}

Fix them and reply with the complete corrected JSON object only.`;
}
