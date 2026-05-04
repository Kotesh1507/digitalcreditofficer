# Digital Credit Officer — Full Stack

```
dco-full/
├── backend/        ← Python (Flask + Socket.IO)
└── frontend/       ← React (Vite + Tailwind + Socket.IO client)
```

## Quick start

### Backend
```bash
cd backend
cp .env.example .env          # fill in TAVUS_API_KEY + TAVUS_PERSONA_ID
pip install -r requirements.txt
python app.py                  # runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
cp .env.example .env           # optional — defaults to localhost:5000
npm install
npm run dev                    # runs on http://localhost:5173
```

Open http://localhost:5173 in Chrome.

## How to demo
1. Open the app — idle screen with drop zone
2. Tap "Use demo packet" (or drop any file)
3. Watch the 90-second automated run — trace, tiles, memo write themselves
4. Avatar speaks at each key finding via the live Tavus session
5. After completion — tap stress test buttons, Q&A chips, or type a question
6. Hit Reset to restart for the next visitor

## Environment variables

### backend/.env
| Variable | Required | Notes |
|----------|----------|-------|
| `TAVUS_API_KEY` | Yes | From platform.tavus.io → Settings |
| `TAVUS_PERSONA_ID` | Yes | Persona with your RAG docs loaded |
| `TAVUS_REPLICA_ID` | No | Leave blank for persona default |
| `LEAD_CAPTURE_URL` | No | URL the QR code points to |

### frontend/.env
| Variable | Notes |
|----------|-------|
| `VITE_SERVER_URL` | Defaults to http://localhost:5000 |
| `VITE_LEAD_CAPTURE_URL` | Defaults to https://yourdomain.com/pilot |
