"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useState } from "react";
import SiteHeader from "@/components/ui/SiteHeader";
import { useRouter } from "next/navigation";
import LoadingSteps from "@/components/ui/LoadingSteps";
import { requestLesson } from "@/lib/ai/progress";
import { lessonUrl, saveGeneratedLesson } from "@/lib/lesson-session";

type CreateMode = "new-code" | "from-code";

const outputChoices = [
  { id: "code", title: "Code", detail: "A useful, ready-to-edit starting point", icon: "</>" },
  { id: "video", title: "Explainer video", detail: "See the idea unfold step by step", icon: "▶" },
  { id: "walkthrough", title: "Walkthrough", detail: "A friendly, line-by-line guide", icon: "↳" },
  { id: "quiz", title: "Quiz", detail: "A few questions to check your understanding", icon: "?" },
];

export default function GeneratePage() {
  const [mode, setMode] = useState<CreateMode>("new-code");
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState("Python");
  const [selected, setSelected] = useState<string[]>(["code", "walkthrough"]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ step: number; detail?: string; percent?: number }>({ step: 0 });
  const router = useRouter();

  function changeMode(nextMode: CreateMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setSelected(nextMode === "new-code" ? ["code", "walkthrough"] : ["video", "walkthrough", "quiz"]);
  }

  function toggleOutput(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setError("");
    setMessage("");
  }

  async function loadFile(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 2 * 1024 * 1024) {
      setError("That file is over 2 MB. Try a smaller code file or paste the relevant part below.");
      return;
    }
    try {
      const contents = await file.text();
      if (!contents.trim()) {
        setError("That file looks empty. Choose another file or paste some code.");
        return;
      }
      setSource(contents);
      setFileName(file.name);
    } catch {
      setError("We couldn’t read that file. Try a plain-text code file or paste your code instead.");
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    await loadFile(event.target.files?.[0]);
    event.target.value = "";
  }

  async function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    await loadFile(event.dataTransfer.files[0]);
  }

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setMessage("");
  if (mode === "new-code" && !prompt.trim()) {
    setError("Tell us what you’d like your code to do first.");
    return;
  }
  if (mode === "from-code" && !source.trim()) {
    setError("Add a code file or paste the snippet you want to explore.");
    return;
  }
  if (selected.length === 0) {
    setError("Choose at least one thing you’d like to make.");
    return;
  }

  if (loading) return;
  setLoading(true);
  setProgress({ step: 0 });
  try {
    const request = { input: mode === "new-code" ? prompt : source, mode, language };
    // Live progress: the steps under the button move as each stage of /api/lesson happens.
    const result = await requestLesson(request, (p) => setProgress({ step: p.step, detail: p.detail, percent: p.percent }));
    saveGeneratedLesson(result, request);
    router.push(lessonUrl(result));
  } catch (e) {
    setMessage("");
    setError((e as Error).message || "Couldn’t make the lesson. Try again.");
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="generate-shell">
      <SiteHeader />
      <section className="generate-intro">
        <span className="friendly-pill"><span /> YOUR CREATIVE WORKSPACE</span>
        <h1>Let’s make something <span>click.</span></h1>
        <p>Start with an idea or bring your own code. You pick what would help most.</p>
      </section>

      <section className="generator-card">
        <div className="generator-step-heading"><span className="step-chip">1</span><div><h2>Choose your starting point</h2><p>No wrong answers. You can change this anytime.</p></div></div>
        <div className="generator-mode-tabs" role="tablist" aria-label="What would you like to make?">
          <button type="button" role="tab" aria-selected={mode === "new-code"} className={mode === "new-code" ? "selected" : ""} onClick={() => changeMode("new-code")}>
            <span className="mode-icon">&lt;/&gt;</span><span><b>Generate new code</b><small>Describe what you’re building</small></span>
          </button>
          <button type="button" role="tab" aria-selected={mode === "from-code"} className={mode === "from-code" ? "selected" : ""} onClick={() => changeMode("from-code")}>
            <span className="mode-icon"><UploadIcon /></span><span><b>Explore my code</b><small>Upload a snippet and make it click</small></span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "new-code" ? (
            <div className="generator-input-area">
              <label className="field-label" htmlFor="code-prompt">WHAT SHOULD YOUR CODE DO?</label>
              <textarea id="code-prompt" className="prompt-textarea" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(""); setMessage(""); }} placeholder="For example: Make a tiny to-do list that lets me add and remove tasks..." rows={4} />
              <div className="prompt-tip"><span>💡</span> A little detail helps. Tell us what goes in, what should happen, and what comes out.</div>
            </div>
          ) : (
            <div className="generator-input-area">
              <label className={`upload-dropzone ${isDragging ? "drag-active" : ""}`} htmlFor="code-file" onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
                <input id="code-file" type="file" accept=".py,.js,.jsx,.ts,.tsx,.java,.c,.h,.cpp,.cc,.cs,.go,.rs,.rb,.php,.swift,.kt,.txt,.json,.html,.css" onChange={onFileChange} />
                <span className="upload-icon"><UploadIcon /></span>
                <span className="upload-copy"><b>{fileName || "Drop your code file here"}</b><small>or <span>choose a file</span> from your computer · up to 2 MB</small></span>
                <span className="upload-browse">Browse files</span>
              </label>
              <div className="paste-divider"><span /> OR PASTE YOUR CODE <span /></div>
              <textarea className="source-textarea" value={source} onChange={(event) => { setSource(event.target.value); setError(""); setMessage(""); }} placeholder={"def say_hello(name):\n    return f\"Hi, {name}!\""} rows={5} spellCheck={false} aria-label="Paste code to explore" />
            </div>
          )}

          <div className="language-row">
            <label htmlFor="language-select" className="field-label">LANGUAGE</label>
            <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option>Python</option><option>JavaScript</option><option>TypeScript</option><option>Java</option><option>C</option><option>C++</option>
            </select>
          </div>

          <div className="output-heading">
            <div className="generator-step-heading"><span className="step-chip">2</span><div><h2>What would you like to make?</h2><p>Choose as many as you like. We’ll tailor it to you.</p></div></div>
            <span className="selection-count">{selected.length} selected</span>
          </div>
          <div className="output-grid">
            {outputChoices.map((choice) => (
              <button type="button" key={choice.id} className={`output-option ${selected.includes(choice.id) ? "output-selected" : ""}`} aria-pressed={selected.includes(choice.id)} onClick={() => toggleOutput(choice.id)}>
                <span className="output-option-icon">{choice.id === "code" ? <CodeIcon /> : choice.id === "video" ? <span className="output-play">▶</span> : choice.icon}</span>
                <span className="output-option-copy"><b>{choice.title}</b><small>{choice.detail}</small></span>
                <span className="output-check">{selected.includes(choice.id) ? "✓" : ""}</span>
              </button>
            ))}
          </div>

          {error && <p className="generator-message generator-error" role="alert">{error}</p>}
          {message && <p className="generator-message generator-info" role="status">{message} <Link href="/lesson">Try the sample lesson →</Link></p>}
          <button className="button-primary generate-submit" type="submit" disabled={loading}>{loading ? "Making your lesson…" : mode === "new-code" ? "Create my code" : "Make my learning kit"} <ArrowIcon /></button>
          {loading && (
            <div className="generate-progress" role="status" aria-live="polite">
              <p>Making your lesson. This usually takes about a minute.</p>
              <LoadingSteps currentStepIndex={progress.step} detail={progress.detail} percent={progress.percent} />
            </div>
          )}
          <p className="generator-footnote">Your files stay in this browser. You’re always in control.</p>
        </form>
      </section>

      <div className="generate-help"><span className="help-chat-icon">?</span><p><b>Not sure where to start?</b> That’s what we’re here for. Try the <Link href="/lesson">sample lesson</Link> to see what’s possible.</p></div>
    </main>
  );
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>;
}

function CodeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-14-4 18" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
