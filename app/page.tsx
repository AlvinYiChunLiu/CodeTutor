"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const languages = ["Python", "JavaScript", "TypeScript", "Java", "C", "C++"];

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"code" | "concept">("code");
  const [language, setLanguage] = useState("Python");
  const [level, setLevel] = useState("Beginner");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [showSampleLink, setShowSampleLink] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setShowSampleLink(false);

    if (!source.trim()) {
      setError(mode === "code" ? "Paste a code snippet to get started." : "Add a topic you want to understand.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "code" ? { code: source } : { topic: source }),
          language: language.toLowerCase(),
          level: level.toLowerCase(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 501) {
          setError("Lesson generation isn't connected yet. Explore the sample lesson in the meantime.");
          setShowSampleLink(true);
          return;
        }
        throw new Error(result?.error ?? "We couldn't create your lesson. Please try again.");
      }
      setError("Lesson generation is connected, but the lesson viewer is not available yet.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="home-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="CodeTutor home">
          <span className="brand-mark"><SparkIcon /></span>
          <span>codetutor<span className="brand-period">.</span></span>
        </Link>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <Link className="nav-demo-link" href="/lesson">Explore a lesson <ArrowIcon /></Link>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL CODE EXPLAINER</div>
          <h1>Code makes sense<br />when you <span>see it.</span></h1>
          <p className="hero-description">
            Turn a tricky snippet or a new concept into a visual, step-by-step lesson made for the way you learn.
          </p>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>J</span><span>M</span><span>A</span><span>K</span>
            </div>
            <span>Made for curious minds, not just coders.</span>
          </div>
        </div>

        <div className="lesson-card" id="create">
          <div className="card-heading">
            <div>
              <span className="card-kicker">LET'S MAKE IT CLICK</span>
              <h2>What are you learning?</h2>
            </div>
            <span className="card-spark"><SparkIcon /></span>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Lesson input type">
            <button type="button" role="tab" aria-selected={mode === "code"} className={mode === "code" ? "active" : ""} onClick={() => { setMode("code"); setError(""); }}>
              <span className="tab-code-icon">&lt;/&gt;</span> Explain my code
            </button>
            <button type="button" role="tab" aria-selected={mode === "concept"} className={mode === "concept" ? "active" : ""} onClick={() => { setMode("concept"); setError(""); }}>
              <SparkIcon /> Teach me a concept
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="input-label" htmlFor="lesson-source">
              {mode === "code" ? "PASTE A CODE SNIPPET" : "WHAT DO YOU WANT TO LEARN?"}
            </label>
            {mode === "code" ? (
              <div className="code-input-wrap">
                <div className="code-window-bar"><span /><span /><span /><small>your-code.py</small></div>
                <textarea
                  id="lesson-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder={"def greet(name):\n    return f\"Hello, {name}!\""}
                  rows={5}
                  spellCheck={false}
                  aria-describedby={error ? "form-error" : undefined}
                />
              </div>
            ) : (
              <div className="concept-input-wrap">
                <SparkIcon />
                <input
                  id="lesson-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="e.g. Recursion, promises, binary search..."
                  aria-describedby={error ? "form-error" : undefined}
                />
              </div>
            )}

            <div className="form-options">
              <label>
                <span>LANGUAGE</span>
                <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  {languages.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>LEVEL</span>
                <select value={level} onChange={(event) => setLevel(event.target.value)}>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                </select>
              </label>
            </div>

            {error && <p className="form-error" id="form-error" role="alert">{error} {showSampleLink && <Link href="/lesson">Open sample lesson →</Link>}</p>}
            <button className="create-button" type="submit" disabled={loading}>
              {loading ? "Building your lesson..." : "Create my lesson"}
              {!loading && <ArrowIcon />}
            </button>
            <p className="privacy-note"><span className="lock-icon">⌑</span> Your snippet is the starting point for your lesson.</p>
          </form>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="how-heading">
          <span className="section-eyebrow">A BETTER WAY TO GET IT</span>
          <h2>From “huh?” to <span>“aha!”</span></h2>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <span className="step-icon step-icon-code">&lt;/&gt;</span>
            <h3>Bring the confusing bit</h3>
            <p>Paste code you’re stuck on, or name a concept you want to finally understand.</p>
          </article>
          <article className="step-card">
            <span className="step-number">02</span>
            <span className="step-icon"><SparkIcon /></span>
            <h3>Get the visual story</h3>
            <p>See each idea broken down into bite-size chapters, diagrams, and plain language.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <span className="step-icon step-icon-check">✓</span>
            <h3>Make it stick</h3>
            <p>Follow along at your own pace, then try a quick practice question to lock it in.</p>
          </article>
        </div>
      </section>

      <footer className="home-footer">
        <Link className="brand footer-brand" href="/"><span className="brand-mark"><SparkIcon /></span><span>codetutor<span className="brand-period">.</span></span></Link>
        <span>Big ideas, made a little smaller.</span>
        <Link href="/lesson" className="footer-sample">Try the sample lesson <ArrowIcon /></Link>
      </footer>
    </main>
  );
}
