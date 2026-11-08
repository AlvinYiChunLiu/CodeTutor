/**
 * npm run demo:test — which requests use a ready-made demo lesson, and which go to the AI.
 * No API keys needed.
 */
import { findDemoTopic } from "../lib/ai/demo-topics";
import { LessonRequest } from "../lib/ai/request";

// [what someone types, dropdown language, expected demo slug or null (= the AI writes it)]
const cases: [string, string, string | null][] = [
  ["What is recursion?", "Python", "recursion"],
  ["explain recursion", "auto", "recursion"],
  ["How does recursion work?", "Python", "recursion"],
  ["recursion with factorial", "Python", "recursion"],
  ["explain recursion with fibonacci", "Python", null],
  ["What is recursion?", "Java", null],
  ["What is recursion in Python?", "Java", "recursion"],
  ["Explain bubble sort", "Python", "explain-bubble-sort"],
  ["how does the bubble sort algorithm work", "auto", "explain-bubble-sort"],
  ["explain sorting", "Python", null],
  ["bubble sort vs quicksort", "Python", null],
  ["How does async/await work?", "JavaScript", "how-does-async-await-work"],
  ["How does async await work in JS?", "Python", "how-does-async-await-work"],
  ["How does async/await work?", "Python", null],
  ["two sum problem", "Python", "two-sum"],
  ["Solve Two Sum", "auto", "two-sum"],
  ["How do pointers work in C?", "Python", "how-do-pointers-work-in-c"],
  ["what are pointers", "C", "how-do-pointers-work-in-c"],
  ["pointers in C++", "C++", null],
  ["What is a vector in C++?", "Python", "what-is-a-vector-in-c"],
  ["vectors", "cpp", "what-is-a-vector-in-c"],
  ["how do I filter an array in javascript", "auto", "js-filter"],
  ["explain loops", "Python", null],
  ["What is a promise?", "JavaScript", null],
  ["def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)", "Python", null],
];

let failed = 0;
for (const [input, language, expected] of cases) {
  const req = LessonRequest.parse({ input, language, mode: "new-code" });
  const got = findDemoTopic(req)?.slug ?? null;
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${JSON.stringify(input).padEnd(48)} [${language}] → ${got ?? "AI"}${ok ? "" : `   (expected ${expected ?? "AI"})`}`);
}

// Simpler / Go deeper always go to the AI, even for a demo topic.
const adjusted = findDemoTopic(LessonRequest.parse({ input: "What is recursion?", language: "Python", adjust: "simpler" }));
if (adjusted) failed++;
console.log(`${adjusted ? "✗" : "✓"} "What is recursion?" + Explain simpler → ${adjusted ? adjusted.slug : "AI"}`);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
