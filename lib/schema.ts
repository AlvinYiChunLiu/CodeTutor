import { z } from "zod";

/**
 * The lesson format shared by the whole team.
 *   B (AI)     writes lessons in this shape
 *   C (video)  plays them: one Remotion scene per `scene.type`
 *   D (audio)  voices each scene's `narration`, then fills in `audio`
 *   A (UI)     shows chapters and the transcript (all the narration lines)
 */

const base = {
  id: z.string().min(1), // unique within the lesson, e.g. "c1-s2"
  narration: z.string().min(1), // one or two spoken sentences
  // Filled in by TTS later. Leave it out when the AI writes the lesson.
  audio: z
    .object({
      url: z.string(),
      durationSec: z.number().positive(),
      wordTimings: z.array(z.object({ word: z.string(), startSec: z.number().nonnegative(), endSec: z.number().nonnegative() })).optional(),
    })
    .optional(),
};

export const TitleScene = z.object({
  ...base,
  type: z.literal("title"),
  heading: z.string(),
  subheading: z.string().optional(),
});

export const CodeScene = z.object({
  ...base,
  type: z.literal("code"),
  code: z.string(), // full snippet; repeat it in each step and change highlightLines
  highlightLines: z.array(z.number().int().positive()).default([]), // 1-based
});

export const OutputScene = z.object({
  ...base,
  type: z.literal("output"),
  output: z.string(), // what the program prints
});

export const ArrayDiagram = z.object({
  kind: z.literal("array"),
  values: z.array(z.union([z.string(), z.number()])),
  highlight: z.array(z.number().int().nonnegative()).default([]), // 0-based indexes
  pointers: z
    .array(z.object({ label: z.string(), index: z.number().int().nonnegative() }))
    .default([]),
});

export const CallStackDiagram = z.object({
  kind: z.literal("callstack"),
  frames: z.array(
    z.object({
      call: z.string(), // e.g. "factorial(3)"
      vars: z.record(z.string(), z.string()).default({}),
      returns: z.string().optional(),
    }),
  ), // frames[0] is the bottom of the stack
});

export const DiagramScene = z.object({
  ...base,
  type: z.literal("diagram"),
  diagram: z.discriminatedUnion("kind", [ArrayDiagram, CallStackDiagram]),
});

export const RecapScene = z.object({
  ...base,
  type: z.literal("recap"),
  points: z.array(z.string()).min(1).max(5),
});

export const Scene = z.discriminatedUnion("type", [
  TitleScene,
  CodeScene,
  OutputScene,
  DiagramScene,
  RecapScene,
]);

export const Chapter = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  scenes: z.array(Scene).min(1),
});

export const Practice = z.object({
  question: z.string(),
  starterCode: z.string().optional(),
  hint: z.string().optional(),
  solution: z.string(),
});

export const Lesson = z.object({
  version: z.literal(1),
  title: z.string().min(1),
  summary: z.string(),
  level: z.enum(["beginner", "intermediate"]),
  codeLanguage: z.enum(["python", "javascript", "typescript", "java", "c", "cpp"]),
  chapters: z.array(Chapter).min(1),
  practice: Practice.optional(),
});

export type Lesson = z.infer<typeof Lesson>;
export type Chapter = z.infer<typeof Chapter>;
export type Scene = z.infer<typeof Scene>;
export type SceneType = Scene["type"];
export type Practice = z.infer<typeof Practice>;
