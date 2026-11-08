"use client";

/**
 * Practice after a lesson: get a problem from /api/practice, write an answer,
 * get it graded by /api/grade (verdict, score, feedback, the line to look at, a hint).
 * Uses the lesson's own practice problem when it already has one (the sample lessons).
 */
import { useRef, useState, type KeyboardEvent } from "react";
import type { Lesson, Practice } from "@/lib/schema";

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

export default function PracticePanel({ lesson }: { lesson: Lesson }) {
  const [practice, setPractice] = useState<Practice | null>(lesson.practice ?? null);
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

  const lineCount = Math.max(answer.split("\n").length, 5);

  async function getProblem() {
    setBusy("problem");
    setError("");
    try {
      const { practice: next } = await postJson<{ practice: Practice }>("/api/practice", { lesson, avoid: asked });
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

  async function checkAnswer() {
    if (!practice || !answer.trim() || busy) return;
    setBusy("grading");
    setError("");
    try {
      const { result: graded } = await postJson<{ result: GradeResult }>("/api/grade", {
        practice,
        answer,
        language: lesson.codeLanguage,
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
    // Cmd/Ctrl + Enter checks the answer; Tab inserts spaces instead of leaving the box.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void checkAnswer();
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      const next = `${answer.slice(0, start)}    ${answer.slice(end)}`;
      setAnswer(next);
      requestAnimationFrame(() => el.setSelectionRange(start + 4, start + 4));
    }
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
                <span>{lesson.codeLanguage}</span>
                <span>Your answer</span>
              </div>
              <div className="practice-editor-body">
                {result?.line && result.verdict !== "correct" && result.line <= lineCount && (
                  <div
                    className="practice-line-flag"
                    style={{ top: EDITOR_PADDING + (result.line - 1) * LINE_HEIGHT - (editorRef.current?.scrollTop ?? 0) }}
                    aria-hidden="true"
                  />
                )}
                <div className="practice-gutter" ref={gutterRef} aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <span key={i} className={result?.line === i + 1 && result.verdict !== "correct" ? "practice-gutter-flag" : ""}>
                      {i + 1}
                    </span>
                  ))}
                </div>
                <textarea
                  ref={editorRef}
                  className="practice-editor"
                  value={answer}
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
              <button type="button" className="button-primary" onClick={checkAnswer} disabled={!answer.trim() || busy !== null}>
                {busy === "grading" ? "Checking…" : "Check my answer"}
              </button>
              {practice.hint && (
                <button type="button" className="button-secondary" onClick={() => setShowHint((v) => !v)} aria-expanded={showHint}>
                  {showHint ? "Hide hint" : "Show a hint"}
                </button>
              )}
              {attempts > 0 && (
                <button type="button" className="button-secondary" onClick={() => setShowSolution((v) => !v)} aria-expanded={showSolution}>
                  {showSolution ? "Hide solution" : "Show solution"}
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
                  {result.line && result.verdict !== "correct" && <p className="practice-result-line">Look at line {result.line}.</p>}
                  {result.nextHint && result.verdict !== "correct" && (
                    <p className="practice-result-hint"><b>Try this:</b> {result.nextHint}</p>
                  )}
                </div>
              )}
            </div>

            {showSolution && (
              <div className="practice-answer">
                <span>ONE POSSIBLE SOLUTION</span>
                <pre>{practice.solution}</pre>
              </div>
            )}
          </>
        )}

        {error && <p className="practice-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
