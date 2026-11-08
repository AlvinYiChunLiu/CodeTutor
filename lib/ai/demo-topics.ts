/**
 * Instant pitch topics: when someone asks for exactly a topic we already have a fact-checked
 * demo lesson for (mocks/demo/<slug>.json), use that lesson instead of waiting 1–2 minutes for the AI.
 *
 * Matching is strict on purpose. After dropping filler words ("what is", "explain", "how does…work"),
 * every word left must belong to the topic. So "What is recursion?" and "explain recursion" match,
 * but "explain recursion with fibonacci" goes to the AI, because the learner asked for something else.
 *
 * No Node imports here: the files themselves are read in lib/demo-cache.ts.
 */
import { looksLikeCode, type LessonRequest, type CodeLanguage } from "./request";

export type DemoTopic = {
  slug: string;
  language: CodeLanguage;
  /** Each group needs at least one of its words in the request (bubble AND sort). */
  required: string[][];
  /** Words that may also appear without changing the topic. */
  extra: string[];
};

export const DEMO_TOPICS: DemoTopic[] = [
  {
    slug: "recursion",
    language: "python",
    required: [["recursion", "recursive", "recursively", "recurse"]],
    extra: ["function", "functions", "factorial", "call", "calls", "stack", "base", "case"],
  },
  {
    slug: "explain-bubble-sort",
    language: "python",
    required: [["bubble"], ["sort", "sorting", "sorts"]],
    extra: ["algorithm", "list", "array", "numbers"],
  },
  {
    slug: "how-does-async-await-work",
    language: "javascript",
    required: [["async", "await", "asynchronous"]],
    extra: ["keyword", "keywords", "function", "functions"],
  },
  {
    slug: "two-sum",
    language: "python",
    required: [["two", "2"], ["sum"]],
    extra: ["problem", "leetcode", "solution", "solve", "solving", "algorithm"],
  },
  {
    slug: "how-do-pointers-work-in-c",
    language: "c",
    required: [["pointer", "pointers"]],
    extra: ["memory", "address", "addresses", "variable", "variables"],
  },
  {
    slug: "what-is-a-vector-in-c",
    language: "cpp",
    required: [["vector", "vectors"]],
    extra: ["std", "container"],
  },
  {
    slug: "js-filter",
    language: "javascript",
    required: [["filter", "filtering", "filters"]],
    extra: ["array", "arrays", "numbers", "method", "list"],
  },
];

/** Words that don't change what's being asked. */
const FILLER = new Set(
  (
    "what whats s is are was how does do did why when explain explaining explanation teach me us a an the " +
    "in on of to for with and about please can could would you i im want wanna learn learning show tell " +
    "understand understanding basics basic simple simply intro introduction concept concepts work works " +
    "working use using used it its this that like way ways give example examples quick quickly step by " +
    "through walk eli5 plain english language programming code coding help need lesson video make create " +
    "beginner beginners kid new"
  ).split(" "),
);

/** Language names someone might type, mapped to the request's language ids. */
const LANGUAGE_WORDS: Record<string, CodeLanguage> = {
  python: "python", py: "python",
  javascript: "javascript", js: "javascript",
  typescript: "typescript", ts: "typescript",
  java: "java",
  c: "c",
  cpp: "cpp",
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/c\s*\+\+/g, " cpp ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The demo topic this request asks for, or null when the AI should write a fresh lesson. */
export function findDemoTopic(req: Pick<LessonRequest, "input" | "language" | "level" | "adjust">): DemoTopic | null {
  // Simpler / Go deeper must change the lesson, and pasted code must be explained as written.
  if (req.adjust || req.level !== "beginner") return null;
  if (req.input.length > 120 || looksLikeCode(req.input)) return null;

  const mentioned = new Set<CodeLanguage>();
  const topicWords: string[] = [];
  for (const word of words(req.input)) {
    if (LANGUAGE_WORDS[word]) mentioned.add(LANGUAGE_WORDS[word]);
    else if (!FILLER.has(word)) topicWords.push(word);
  }
  if (topicWords.length === 0) return null;

  for (const topic of DEMO_TOPICS) {
    // A language typed in the question wins over the dropdown ("pointers in C" with Python selected).
    if (mentioned.size > 0) {
      if (mentioned.size > 1 || !mentioned.has(topic.language)) continue;
    } else if (req.language !== "auto" && req.language !== topic.language) {
      continue;
    }
    const allowed = new Set([...topic.required.flat(), ...topic.extra]);
    if (!topicWords.every((w) => allowed.has(w))) continue;
    if (!topic.required.every((group) => group.some((w) => topicWords.includes(w)))) continue;
    return topic;
  }
  return null;
}
