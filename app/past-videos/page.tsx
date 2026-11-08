import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import { listSavedLessons } from "@/lib/lessons";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function PastVideosPage() {
  let lessons: Awaited<ReturnType<typeof listSavedLessons>> = [];
  let unavailable = false;
  try {
    if (process.env.DATABASE_URL) lessons = await listSavedLessons();
    else unavailable = true;
  } catch (error) {
    console.error("Could not load saved lessons:", error);
    unavailable = true;
  }

  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <section className="mx-auto w-[min(1000px,calc(100%_-_40px))] py-12 sm:py-16">
        <span className="page-eyebrow">YOUR LIBRARY</span>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">Past videos</h1>
          </div>
          <Link className="button-primary" href="/generate">Make a lesson</Link>
        </div>

        {unavailable ? (
          <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)]">
            <h2 className="text-lg font-semibold">Connect your database to save lessons</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Set <code>DATABASE_URL</code> in <code>.env.local</code>, then restart the app. New lessons will appear here.</p>
          </div>
        ) : lessons.length === 0 ? (
          <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
            <h2 className="text-lg font-semibold text-[var(--ink)]">No saved lessons yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Generate a lesson and it will show up here.</p>
            <Link className="mt-5 inline-flex button-primary" href="/generate">Create your first lesson</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {lessons.map(({ id, lesson, videoSrc, createdAt }) => (
              <article className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]" key={id}>
                {videoSrc ? (
                  <video className="aspect-video w-full bg-black object-cover" controls preload="metadata" src={videoSrc} />
                ) : (
                  <div className="grid aspect-video place-items-center bg-[var(--line)]/30 text-sm text-[var(--muted)]">Video unavailable for this lesson</div>
                )}
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                    <span>{lesson.codeLanguage}</span><span aria-hidden="true">·</span><span>{lesson.level}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">{lesson.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">{lesson.summary}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <time className="text-xs text-[var(--muted)]" dateTime={createdAt}>{formatDate(createdAt)}</time>
                    <Link className="text-sm font-semibold text-[var(--ink)] underline underline-offset-4" href={`/past-videos/${id}`}>Open lesson</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
