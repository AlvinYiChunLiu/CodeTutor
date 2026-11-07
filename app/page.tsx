"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import InputForm, { type LessonInput } from "@/components/ui/InputForm";
import LoadingSteps from "@/components/ui/LoadingSteps";
import SiteHeader from "@/components/ui/SiteHeader";
import { Lesson as LessonSchema } from "@/lib/schema";

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function CodeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-14-4 18" /></svg>;
}

function BookIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Zm0 0V19a3 3 0 0 1 2.5-1H20M8 7h8m-8 4h7" /></svg>;
}

export default function Home() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSubmitting) return;

    const timer = window.setInterval(() => {
      setCurrentStepIndex((step) => Math.min(step + 1, 4));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [isSubmitting]);

  async function handleSubmit(input: LessonInput) {
    setError("");
    setCurrentStepIndex(0);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          && typeof result.error === "string"
          ? result.error
          : `Lesson generation failed (${response.status}). Please try again.`;
        throw new Error(message);
      }

      const lessonData = typeof result === "object" && result !== null && "lesson" in result
        ? result.lesson
        : result;
      const parsedLesson = LessonSchema.safeParse(lessonData);
      if (!parsedLesson.success) {
        throw new Error("The lesson response was invalid. Please try again.");
      }

      window.sessionStorage.setItem("codetutor-generated-lesson", JSON.stringify(parsedLesson.data));
      router.push("/lesson");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
    return (
      <main className="main-shell">
        <SiteHeader />
        <section className="mx-auto w-[min(560px,calc(100%_-_40px))] py-20">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-[var(--ink)] shadow-sm">
            <h1 className="mb-2 text-2xl font-bold">Creating your lesson</h1>
            <p className="mb-8 text-sm text-[var(--muted)]">We’re putting together a lesson just for you.</p>
            <LoadingSteps currentStepIndex={currentStepIndex} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="main-shell">
      <SiteHeader />
      <section className="main-hero">
        <div className="main-hero-copy">
          <span className="friendly-pill"><span /> YOUR FRIENDLY CODE SIDEKICK</span>
          <h1>Big code ideas,<br />made <span>easy to get.</span></h1>
          <p>Bring your code or a curious question. We’ll help turn it into bite-sized explanations, visual lessons, and practice that feels good.</p>
          <div className="hero-actions">
            <Link className="button-primary" href="/generate">Let’s make something <ArrowIcon /></Link>
            <Link className="button-secondary" href="/lesson"><span className="small-play">▶</span> Explore a sample</Link>
          </div>
          <div className="main-trust"><span className="trust-check">✓</span> No silly questions. Learn at your own pace.</div>
        </div>
        <div className="hero-art" aria-label="Illustration of code becoming a lesson">
          <div className="art-glow" />
          <div className="art-sticker sticker-top">YOU’VE GOT THIS!</div>
          <div className="art-code-card">
            <div className="art-card-bar"><span /><span /><span /><b>tiny_example.py</b></div>
            <pre><span className="code-purple">def</span> <span className="code-blue">say_hello</span>(name):{"\n"}  message = <span className="code-orange">f&quot;Hi, {"{name}"}!&quot;</span>{"\n"}  <span className="code-purple">return</span> message</pre>
          </div>
          <div className="art-connector"><i /><i /><i /></div>
          <div className="art-lesson-card">
            <span className="art-label">YOUR CODE, EXPLAINED</span>
            <div className="art-lesson-icon"><BookIcon /></div>
            <strong>Say hello, one step at a time</strong>
            <span className="art-duration">3 friendly chapters <b>·</b> 4 min</span>
            <div className="art-progress"><span /></div>
          </div>
          <div className="art-sticker sticker-bottom"><span>✓</span> LOOK AT YOU GO</div>
          <span className="art-orbit orbit-a" /><span className="art-orbit orbit-b" />
        </div>
      </section>

      <section className="mx-auto w-[min(760px,calc(100%_-_40px))] py-12" aria-labelledby="create-lesson-heading">
        <div className="mb-6 text-center">
          <span className="page-eyebrow">YOUR TURN</span>
          <h2 id="create-lesson-heading" className="mt-2 text-3xl font-bold tracking-tight text-[var(--ink)]">
            Make a lesson from your question
          </h2>
        </div>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
        <InputForm onSubmit={handleSubmit} />
      </section>

      <section className="gallery-section">
        <div className="gallery-heading">
          <div>
            <span className="page-eyebrow">A LITTLE INSPIRATION</span>
            <h2>Explore the learning gallery</h2>
            <p>Pick a starting point. You can make your own next.</p>
          </div>
          <Link className="text-link" href="/lesson">See a full lesson <ArrowIcon /></Link>
        </div>
        <div className="gallery-grid">
          <Link className="gallery-card gallery-featured" href="/lesson">
            <div className="gallery-visual visual-recursion"><span>n!</span><div className="recursion-steps"><i>3</i><b>×</b><i>2</i><b>×</b><i>1</i><b>=</b><strong>6</strong></div></div>
            <div className="gallery-card-copy"><div><span className="gallery-tag">VISUAL LESSON</span><span className="gallery-time">4 MIN</span></div><h3>Recursion, without the headache</h3><p>Follow each function call and see how the answer comes back.</p><span className="gallery-open">Try this lesson <ArrowIcon /></span></div>
          </Link>
          <Link className="gallery-card" href="/generate">
            <div className="gallery-visual visual-code"><CodeIcon /><span>input</span><i>→</i><b>aha!</b></div>
            <div className="gallery-card-copy"><div><span className="gallery-tag">CODE WALKTHROUGH</span><span className="gallery-time">YOUR PACE</span></div><h3>Make tricky code feel simple</h3><p>Upload a snippet and choose how you want to understand it.</p><span className="gallery-open">Bring your own code <ArrowIcon /></span></div>
          </Link>
          <Link className="gallery-card" href="/generate">
            <div className="gallery-visual visual-practice"><span className="practice-number">01</span><div className="practice-line" /><div className="practice-line short" /><div className="practice-choice"><b>A</b><span>Give it a try</span><i>✓</i></div></div>
            <div className="gallery-card-copy"><div><span className="gallery-tag">PRACTICE & QUIZZES</span><span className="gallery-time">JUST FOR YOU</span></div><h3>Learn it, then lock it in</h3><p>Turn your code into a quick quiz, flashcards, or a mini challenge.</p><span className="gallery-open">Make a practice set <ArrowIcon /></span></div>
          </Link>
        </div>
      </section>

      <section className="main-bottom-cta">
        <div className="cta-code-icon"><CodeIcon /></div>
        <div><h2>Got a code question?</h2><p>Paste it, upload it, or just tell us what you’re curious about.</p></div>
        <Link className="button-primary" href="/generate">Start creating <ArrowIcon /></Link>
      </section>
      <footer className="site-footer"><Link className="app-brand" href="/"><span className="app-brand-mark"><CodeIcon /></span><span>codetutor<span className="brand-period">.</span></span></Link><span>Code questions are always welcome here.</span><Link href="/lesson">Explore a lesson</Link></footer>
    </main>
  );
}
