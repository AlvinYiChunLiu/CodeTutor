import express from "express";
import { randomUUID } from "node:crypto";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: "10kb" }));

let notes = [
  {
    id: randomUUID(),
    text: "Make space for the ideas that arrive between everything else.",
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    text: "A good starting point is still a starting point.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "hackcamp-api" });
});

app.get("/api/notes", (_request, response) => {
  response.json({ notes });
});

app.post("/api/notes", (request, response) => {
  const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";
  if (!text) return response.status(400).json({ error: "Note text is required." });
  if (text.length > 240) return response.status(400).json({ error: "Notes must be 240 characters or fewer." });

  const note = { id: randomUUID(), text, createdAt: new Date().toISOString() };
  notes = [note, ...notes];
  response.status(201).json({ note });
});

app.delete("/api/notes/:id", (request, response) => {
  const remainingNotes = notes.filter((note) => note.id !== request.params.id);
  if (remainingNotes.length === notes.length) {
    return response.status(404).json({ error: "Note not found." });
  }

  notes = remainingNotes;
  response.status(204).end();
});

app.listen(port, () => {
  console.log(`HackCamp API listening on http://localhost:${port}`);
});