# HackCamp Full-Stack Starter

A small website starter with a React front end, Vite dev server, Tailwind CSS, and a Node.js/Express API.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). The Express API runs on port 3001, and Vite proxies `/api` requests to it.

## Included

- Responsive React workspace with a working notes form
- Tailwind CSS v4 through its Vite plugin
- Express endpoints: `GET /api/health`, `GET /api/notes`, `POST /api/notes`, and `DELETE /api/notes/:id`
- `npm run build` to create the production front-end bundle in `dist/`
- `npm start` to run the API server

Notes are held in memory and reset when the server restarts. Add a database and authentication before using this as a production app. In production, serve the built `dist/` directory through a static host or add static-file serving to Express.