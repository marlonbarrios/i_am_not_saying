/**
 * Local dev server: serves /api (OpenAI) and proxies the rest to Vite.
 * Use: npm run dev
 * Then open http://localhost:5173 — /api/chat and /api/audio will work.
 */
import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY;
const isPlaceholder = !apiKey || /^sk-your[-_]?(key[-_]?)?here$/i.test(apiKey) || apiKey.includes('your-key-here') || apiKey.includes('your_openai');
if (isPlaceholder) {
  console.warn('\n⚠️  OpenAI API key missing or still a placeholder.');
  console.warn('   Edit your .env file and set OPENAI_API_KEY to your real key from:');
  console.warn('   https://platform.openai.com/account/api-keys\n');
}

const app = express();
app.use(express.json());

// Mount Vercel-style API routes so they work when running Vite (npm run dev)
app.all('/api/chat', async (req, res) => {
  const { default: handler } = await import('./api/chat.js');
  return handler(req, res);
});
app.all('/api/audio', async (req, res) => {
  const { default: handler } = await import('./api/audio.js');
  return handler(req, res);
});

// Vite dev server for the frontend
const vite = await createViteServer({ server: { middlewareMode: true } });
app.use(vite.middlewares);

function tryListen(port) {
  const server = app.listen(port, () => {
    console.log(`Dev server at http://localhost:${server.address().port} (API at /api/chat, /api/audio)`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
}
tryListen(5173);
