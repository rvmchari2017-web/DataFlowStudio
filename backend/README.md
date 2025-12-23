# Backend (Python)

A minimal FastAPI backend that prints "Hello from the Python backend!" on startup and exposes `/hello`.

To run manually:

1. Create a virtual environment and activate it:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install requirements:

```bash
pip install -r backend/requirements.txt
```

3. Run:

```bash
uvicorn backend.app:app --reload --port 8000
```

Then open http://localhost:8000/hello
