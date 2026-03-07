# Machine Forgetting

Generative text and voice piece: generate AI text (Samuel Beckett–style), then draw it in space with your hand or mouse. Letters fade over time; audio plays in sync as you draw.

**Features:**
- **Hand tracking** (MediaPipe): pinch thumb + index to draw—no mouse needed.
- **Mouse**: click and drag to draw.
- **T** = toggle camera as background so you see yourself drawing on the live video.
- **Space** = generate new text (and TTS). Volume follows vertical position; speed follows movement.

---

## Run locally

```bash
npm run dev
```

Opens the app with the API at **http://localhost:5173** (or 5174, 5175… if 5173 is in use).  
For Vercel-style local dev before deploy: `npm run start` (vercel dev).

---

## Setup

1. Copy `.env.example` to `.env`
2. Set **`OPENAI_API_KEY`** in `.env` to your [OpenAI API key](https://platform.openai.com/api-keys)

---

## Controls

| Action | Result |
|--------|--------|
| **Space** | Generate new text + audio |
| **Click and drag** or **pinch (thumb + index)** | Draw text in space; audio plays in sync |
| **T** | Toggle camera as background (draw on top of live video) |
| **Backspace / Delete** | Clear drawing |
| **S** | Save canvas as PNG |
| **Arrow Up/Down** | Angle distortion |

---

## Deploy

Build: `npm run build`. Deploy the `dist/` folder and the `api/` serverless functions (e.g. Vercel). Set `OPENAI_API_KEY` in the host’s environment variables.

---

## Console messages

- **MediaPipe** (OpenGL, TensorFlow Lite, etc.): normal hand-tracking logs; safe to ignore.
- **Port in use**: dev server will try the next port (5174, 5175…). Use the URL printed in the terminal.
- **API 404**: use `npm run dev` (custom server with API) or `npm run start` (vercel dev).
