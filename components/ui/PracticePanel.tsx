"use client";

/**
 * Practice after a lesson: get a problem from /api/practice, write an answer,
 * get it graded by /api/grade (verdict, score, feedback, the line to look at, a hint).
 * Uses the lesson's own practice problem when it already has one (the sample lessons).
 */
import { useRef, useState, type KeyboardEvent } from "react";
import type { CodeLanguage, Lesson, Practice } from "@/lib/schema";

type GradeResult = {
  verdict: "correct" | "almost" | "incorrect";
  score: number;
  feedback: string;
  line?: number;
  nextHint?: string;
};

const VERDICT = {
  correct: { label: "Correct", icon: "✓" },
  almost: { label: "Almost there", icon: "~" },
  incorrect: { label: "Not yet", icon: "×" },
} as const;

const LINE_HEIGHT = 22; // px, must match .practice-editor line-height in globals.css
const EDITOR_PADDING = 12; // px, must match .practice-editor padding-top
const INDENT = "    ";
const LANGUAGE_OPTIONS: { value: CodeLanguage; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

export default function PracticePanel({ lesson }: { lesson: Lesson }) {
  const [practice, setPractice] = useState<Practice | null>(lesson.practice ?? null);
  const [language, setLanguage] = useState<CodeLanguage>(lesson.codeLanguage);
  const [answer, setAnswer] = useState(lesson.practice?.starterCode ?? "");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState<"problem" | "grading" | null>(null);
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [asked, setAsked] = useState<string[]>(lesson.practice ? [lesson.practice.question] : []);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const displayedCode = showSolution && practice ? practice.solution : answer;
  const lineCount = Math.max(displayedCode.split("\n").length, 5);

  async function getProblem() {
    setBusy("problem");
    setError("");
    try {
      const { practice: next } = await postJson<{ practice: Practice }>("/api/practice", { lesson, language, avoid: asked });
      setPractice(next);
      setAnswer(next.starterCode ?? "");
      setAsked((list) => [...list, next.question].slice(-10));
      setResult(null);
      setShowHint(false);
      setShowSolution(false);
      setAttempts(0);
      setTimeout(() => editorRef.current?.focus(), 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function changeLanguage(nextLanguage: CodeLanguage) {
    if (nextLanguage === language || busy) return;
    setBusy("problem");
    setError("");
    try {
      const { practice: next } = await postJson<{ practice: Practice }>("/api/practice", {
        lesson,
        language: nextLanguage,
        avoid: asked,
      });
      setLanguage(nextLanguage);
      setPractice(next);
      setAnswer(next.starterCode ?? "");
      setAsked((list) => [...list, next.question].slice(-10));
      setResult(null);
      setShowHint(false);
      setShowSolution(false);
      setAttempts(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function checkAnswer() {
    if (!practice || !answer.trim() || busy || showSolution) return;
    setBusy("grading");
    setError("");
    try {
      const { result: graded } = await postJson<{ result: GradeResult }>("/api/grade", {
        practice,
        answer,
        language,
        level: lesson.level,
      });
      setResult(graded);
      setAttempts((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter checks the answer; Tab and Enter behave like a code editor.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void checkAnswer();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      const before = answer.slice(0, start);
      const currentLine = before.slice(before.lastIndexOf("\n") + 1);
      const currentIndent = currentLine.match(/^[\t ]*/)?.[0] ?? "";
      const trimmedLine = currentLine.trimEnd();
      const isPython = language === "python";
      const opensBlock = isPython
        ? /:\s*(?:#.*)?$/.test(trimmedLine)
      : /[{(\[]\s*$/.test(trimmedLine);
      const closingToken = !isPython && answer.slice(end).match(/^[\t ]*([})\]])/)?.[1];
      const nextIndent = opensBlock
        ? currentIndent + INDENT
        : closingToken && currentIndent.endsWith(INDENT)
          ? currentIndent.slice(0, -INDENT.length)
          : currentIndent;
      const after = answer.slice(end);
      const pairBlock = opensBlock && closingToken;
      const insertion = pairBlock
        ? `\n${currentIndent + INDENT}\n${currentIndent}`
        : `\n${nextIndent}`;
      const next = `${before}${insertion}${after}`;
      setAnswer(next);
      const caret = pairBlock ? start + 1 + currentIndent.length + INDENT.length : start + insertion.length;
      requestAnimationFrame(() => el.setSelectionRange(caret, caret));
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      const next = `${answer.slice(0, start)}${INDENT}${answer.slice(end)}`;
      setAnswer(next);
      requestAnimationFrame(() => el.setSelectionRange(start + INDENT.length, start + INDENT.length));
    } else if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: start } = el;
      const lineStart = answer.lastIndexOf("\n", start - 1) + 1;
      const leadingWhitespace = answer.slice(lineStart).match(/^[\t ]*/)?.[0] ?? "";
      const removed = leadingWhitespace.startsWith(INDENT) ? INDENT : leadingWhitespace.startsWith("\t") ? "\t" : "";
      if (removed) {
        const next = `${answer.slice(0, lineStart)}${answer.slice(lineStart + removed.length)}`;
        setAnswer(next);
        const caret = Math.max(lineStart, start - removed.length);
        requestAnimationFrame(() => el.setSelectionRange(caret, caret));
      }
    }
  }

  function jumpToErrorLine(line: number) {
    const editor = editorRef.current;
    if (!editor) return;
    const start = answer.split("\n").slice(0, line - 1).reduce((total, current) => total + current.length + 1, 0);
    const end = answer.indexOf("\n", start);
    editor.focus();
    editor.setSelectionRange(start, end === -1 ? answer.length : end);
    editor.scrollTop = Math.max(0, EDITOR_PADDING + (line - 1) * LINE_HEIGHT - LINE_HEIGHT * 2);
  }

  const verdict = result ? VERDICT[result.verdict] : null;

  return (
    <section className="practice-card practice-panel" aria-labelledby="practice-heading">
      <div className="practice-card-icon" aria-hidden="true">✓</div>
      <div className="practice-copy">
        <span className="section-eyebrow">YOUR TURN</span>
        <h2 id="practice-heading">Ready to try one?</h2>

        {!practice ? (
          <>
            <p>Practice what you just learned with a short exercise made for this lesson.</p>
            <div className="practice-actions">
              <button type="button" className="button-primary" onClick={getProblem} disabled={busy !== null}>
                {busy === "problem" ? "Making your problem…" : "Give me a practice problem"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="practice-question">{practice.question}</p>

            <div className="practice-editor-wrap">
              <div className="practice-editor-bar">
                <label htmlFor="practice-language">Language</label>
                <select
                  id="practice-language"
                  className="practice-language-select"
                  value={language}
                  disabled={busy !== null}
                  onChange={(event) => void changeLanguage(event.target.value as CodeLanguage)}
                >
                  {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span>{showSolution ? "Reference solution · view only" : "Your answer"}</span>
              </div>
              <div className="practice-editor-body">
                {!showSolution && result?.line && result.verdict !== "correct" && result.line <= lineCount && (
                  <div
                    className="practice-line-flag"
                    style={{ top: EDITOR_PADDING + (result.line - 1) * LINE_HEIGHT - (editorRef.current?.scrollTop ?? 0) }}
                    aria-hidden="true"
                  />
                )}
                <div className="practice-gutter" ref={gutterRef} aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <span key={i} className={!showSolution && result?.line === i + 1 && result.verdict !== "correct" ? "practice-gutter-flag" : ""}>
                      {i + 1}
                    </span>
                  ))}
                </div>
                <textarea
                  ref={editorRef}
                  className={`practice-editor ${showSolution ? "practice-editor-solution" : ""}`}
                  value={displayedCode}
                  readOnly={showSolution}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    if (result) setResult(null);
                  }}
                  onKeyDown={onKeyDown}
                  onScroll={(e) => {
                    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                  }}
                  rows={lineCount}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Your answer"
                  placeholder="Write your code here…"
                />
              </div>
            </div>

            <div className="practice-actions">
              <button type="button" className="button-primary" onClick={checkAnswer} disabled={!answer.trim() || busy !== null || showSolution}>
                {busy === "grading" ? "Checking…" : "Check my answer"}
              </button>
              {practice.hint && (
                <button type="button" className="button-secondary" onClick={() => setShowHint((v) => !v)} aria-expanded={showHint}>
                  {showHint ? "Hide hint" : "Show a hint"}
                </button>
              )}
              {attempts > 0 && (
                <button type="button" className="button-secondary" onClick={() => setShowSolution((v) => !v)} aria-expanded={showSolution}>
                  {showSolution ? "Back to my code" : "Show solution in editor"}
                </button>
              )}
              <button type="button" className="practice-link" onClick={getProblem} disabled={busy !== null}>
                {busy === "problem" ? "Making a new one…" : "New problem"}
              </button>
              <span className="practice-shortcut">⌘/Ctrl + Enter to check</span>
            </div>

            {showHint && practice.hint && (
              <div className="practice-note">
                <b>Hint</b>
                <p>{practice.hint}</p>
              </div>
            )}

            <div aria-live="polite">
              {result && verdict && (
                <div className={`practice-result practice-result-${result.verdict}`}>
                  <div className="practice-result-head">
                    <span className="practice-verdict-icon" aria-hidden="true">{verdict.icon}</span>
                    <b>{verdict.label}</b>
                    <span className="practice-score">{result.score}/100</span>
                  </div>
                  <div className="practice-score-bar" aria-hidden="true">
                    <span style={{ width: `${result.score}%` }} />
                  </div>
                  <p>{result.feedback}</p>
                  {result.line && result.line <= answer.split("\n").length && result.verdict !== "correct" && (
                    <>
                      <p className="practice-result-code">
                        <b>Your line {result.line}:</b>{" "}
                        <code>{answer.split("\n")[result.line - 1] || "(blank line)"}</code>
                      </p>
                      <button type="button" className="practice-jump-line" onClick={() => {
                        if (result.line) jumpToErrorLine(result.line);
                      }}>
                        Jump to line {result.line}
                      </button>
                    </>
                  )}
                  {result.nextHint && result.verdict !== "correct" && (
                    <p className="practice-result-hint"><b>Next step for your code:</b> {result.nextHint}</p>
                  )}
                </div>
              )}
            </div>

          </>
        )}

        {error && <p className="practice-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
