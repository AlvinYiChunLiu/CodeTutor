"use client";

import { FormEvent, useState } from "react";

export type LessonLanguage = "JavaScript" | "Python" | "TypeScript" | "Java" | "C++";
export type LessonMode = "Explainer" | "Walkthrough" | "Debugger";
export type LessonDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type LessonInput = {
  prompt: string;
  language: LessonLanguage;
  mode: LessonMode;
  difficulty: LessonDifficulty;
};

type InputFormProps = {
  onSubmit: (input: LessonInput) => void;
};

const MAX_PROMPT_LENGTH = 4000;

const languages: LessonLanguage[] = ["JavaScript", "Python", "TypeScript", "Java", "C++"];
const modes: LessonMode[] = ["Explainer", "Walkthrough", "Debugger"];
const difficulties: LessonDifficulty[] = ["Beginner", "Intermediate", "Advanced"];

function isLessonLanguage(value: string): value is LessonLanguage {
  return languages.some((languageOption) => languageOption === value);
}

function isLessonDifficulty(value: string): value is LessonDifficulty {
  return difficulties.some((difficultyOption) => difficultyOption === value);
}

export default function InputForm({ onSubmit }: InputFormProps) {
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<LessonLanguage>("JavaScript");
  const [mode, setMode] = useState<LessonMode>("Explainer");
  const [difficulty, setDifficulty] = useState<LessonDifficulty>("Beginner");
  const isPromptInvalid = !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPromptInvalid) return;

    onSubmit({ prompt, language, mode, difficulty });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)] shadow-sm sm:p-8"
    >
      <div>
        <label htmlFor="lesson-prompt" className="mb-2 block text-sm font-semibold">
          What would you like to learn?
        </label>
        <div className="relative">
          <textarea
            id="lesson-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Paste code or describe a concept you’d like to understand..."
            rows={7}
            aria-describedby="prompt-character-count"
            className="block min-h-44 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 pb-9 text-sm leading-6 text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
          />
          <span
            id="prompt-character-count"
            aria-live="polite"
            className={`absolute bottom-3 right-4 text-xs tabular-nums ${
              prompt.length > MAX_PROMPT_LENGTH ? "font-semibold text-red-600" : "text-[var(--muted)]"
            }`}
          >
            {prompt.length} / {MAX_PROMPT_LENGTH}
          </span>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Lesson style</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Lesson style">
          {modes.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2 ${
                mode === option
                  ? "border-[var(--blue)] bg-[var(--blue-pale)] text-[var(--blue-strong)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--blue)] hover:text-[var(--ink)]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lesson-language" className="mb-2 block text-sm font-semibold">
            Language
          </label>
          <select
            id="lesson-language"
            value={language}
            onChange={(event) => {
              if (isLessonLanguage(event.target.value)) setLanguage(event.target.value);
            }}
            className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
          >
            {languages.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="lesson-difficulty" className="mb-2 block text-sm font-semibold">
            Difficulty
          </label>
          <select
            id="lesson-difficulty"
            value={difficulty}
            onChange={(event) => {
              if (isLessonDifficulty(event.target.value)) setDifficulty(event.target.value);
            }}
            className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
          >
            {difficulties.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPromptInvalid}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--blue-strong)] px-5 text-sm font-bold text-[var(--paper)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
      >
        Generate Lesson
      </button>
    </form>
  );
}