# DataFlowStudio

A minimal example app with a Python backend and a TypeScript frontend.

## Structure

- `backend/` — Python (FastAPI) backend — prints "Hello" at startup and exposes `/hello`.
- `frontend/` — TypeScript + React (Vite) frontend — fetches `/hello` and displays the message.

## Run (one command)

From the repository root run:

```bash
bash run.sh
# or
npm start
```

This script will create a Python virtual environment, install backend and frontend deps if needed, then run both servers concurrently:

- Backend: http://localhost:8000 (GET `/hello`)
- Frontend: http://localhost:5173

Enjoy! ✅