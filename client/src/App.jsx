import { useEffect, useState } from "react";

const dateLabel = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

async function request(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

function App() {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([request("/api/notes"), request("/api/health")])
      .then(([noteData]) => {
        if (!active) return;
        setNotes(noteData.notes);
        setApiOnline(true);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function addNote(event) {
    event.preventDefault();
    if (!draft.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const result = await request("/api/notes", {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });
      setNotes((current) => [result.note, ...current]);
      setDraft("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id) {
    setError("");
    try {
      await request(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((current) => current.filter((note) => note.id !== id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="Margin home">
          <span className="brand-mark">m<span>.</span></span>
          <span className="brand-name">margin</span>
        </a>

        <div className="workspace-label">YOUR SPACE</div>
        <nav aria-label="Main navigation" className="nav-list">
          <a className="nav-item" href="#workspace"><span className="nav-icon">◫</span>Overview</a>
          <a className="nav-item active" href="#notes" aria-current="page"><span className="nav-icon">▤</span>Notes<span className="nav-count">{notes.length}</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="api-card">
            <div className="api-card-top"><span className={`status-dot ${apiOnline ? "online" : ""}`} /><span>{apiOnline ? "API connected" : "API offline"}</span></div>
            <div className="api-caption">Express server · port 3001</div>
          </div>
          <div className="profile-row">
            <div className="avatar">H</div>
            <div><div className="profile-name">HackCamp</div><div className="profile-plan">Starter workspace</div></div>
            <span className="profile-menu" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <main id="workspace" className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Notes</strong></div>
          <div className="today-label">{dateLabel.format(new Date())}</div>
        </header>

        <section id="notes" className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />PERSONAL SPACE</div>
              <h1>Your notes<span className="heading-period">.</span></h1>
              <p className="page-subtitle">A little room for what’s on your mind.</p>
            </div>
            <div className="note-total"><span className="total-number">{notes.length.toString().padStart(2, "0")}</span><span className="total-label">NOTES<br />IN YOUR SPACE</span></div>
          </div>

          <form className="compose" onSubmit={addNote}>
            <label className="compose-label" htmlFor="note-draft">CAPTURE A THOUGHT</label>
            <textarea
              id="note-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Start with a sentence..."
              maxLength={240}
              rows={3}
            />
            <div className="compose-footer">
              <span className="character-count">{draft.length} / 240</span>
              <button className="add-button" type="submit" disabled={!draft.trim() || saving}>
                <span>{saving ? "Adding" : "Add note"}</span><span className="button-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
          </form>

          <div className="list-heading"><h2>Recent notes</h2><span>{notes.length} TOTAL</span></div>
          {error && <div className="error-message" role="alert">{error}</div>}
          <div className="notes-list" aria-live="polite">
            {loading ? (
              <div className="empty-state">Connecting to your workspace...</div>
            ) : notes.length ? (
              notes.map((note, index) => (
                <article className="note-row" key={note.id}>
                  <span className="note-index">{String(index + 1).padStart(2, "0")}</span>
                  <p className="note-text">{note.text}</p>
                  <time className="note-time" dateTime={note.createdAt}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(note.createdAt))}</time>
                  <button className="delete-button" type="button" onClick={() => deleteNote(note.id)} aria-label={`Delete note: ${note.text}`}>×</button>
                </article>
              ))
            ) : (
              <div className="empty-state">Nothing here yet. Your first note can start above.</div>
            )}
          </div>
          <footer className="page-footer"><span>MADE FOR THE THINGS WORTH KEEPING</span><span>01 — 01</span></footer>
        </section>
      </main>
    </div>
  );
}

export default App;