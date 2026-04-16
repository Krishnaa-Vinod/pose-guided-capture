# pose-guided-capture-demo

![Enrollment UI - main view](images/Screenshot%20from%202026-04-16%2000-00-44.png)

Pose-guided face enrollment demo with:

- `backend/`: FastAPI + MediaPipe processing and guidance pipeline
- `face-enrollment-visualizer/`: React + Vite webcam UI

## What this demo does

- Streams webcam frames from frontend to backend over WebSocket.
- Estimates head pose (`yaw`, `pitch`, `roll`) in real time.
- Guides the user through a 3x3 pose coverage grid.
- Saves best frames per pose in `backend/selected-captures/<session_id>/...`.
- Clears previous session captures when a new session starts or reset is triggered.
- Applies neutral-pose calibration so a straight face is less likely to be misclassified as `up`.

## Project structure

- `backend/main.py`: WebSocket pipeline orchestration and response payload.
- `backend/services/pose.py`: pose estimation + neutral calibration.
- `backend/services/coverage.py`: pose binning and progress tracking.
- `backend/services/storage.py`: selected-capture persistence and session cleanup.
- `face-enrollment-visualizer/src/`: frontend UI and remote session hook.

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+
- Webcam access in browser

Optional:

- Ollama running with a compatible model for LLM prompt rephrasing (guidance still works without it using deterministic prompts).

## Reproduce from scratch

1. Clone and open the repo

```bash
git clone <your-repo-url>
cd pose-guided-capture-demo
```

2. Set up backend environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

3. Start backend

```bash
cd backend
source .venv/bin/activate
python main.py
```

Backend runs at `http://localhost:8000`.

4. Start frontend (new terminal)

```bash
cd face-enrollment-visualizer
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Usage flow

1. Open the frontend in browser and allow webcam permission.
2. Keep your head straight and still for about 1-2 seconds (neutral calibration).
3. Follow on-screen guidance to cover each pose target.
4. Watch progress until enrollment reaches complete.

## Capture output behavior

- Active session best captures are saved under:

```text
backend/selected-captures/<session_id>/<pose_key>/best.jpg
backend/selected-captures/<session_id>/metadata.json
```

- On a new session start or reset event:
- old `backend/selected-captures/*` contents are cleared (except `.gitkeep`)
- session starts fresh

## Verification commands

Run these after setup to validate reproducibility:

```bash
# Backend syntax check
cd backend
python -m compileall .

# Frontend build check
cd ../face-enrollment-visualizer
npm run build
```

## Troubleshooting

- Straight pose looks like `up`:
- Hold still in center until calibration finishes.
- Ensure your full face is visible and well-lit.
- No captures saved:
- Check backend logs and confirm gate acceptance is happening.
- Verify output folder is `backend/selected-captures`.
- WebSocket not connecting:
- Ensure backend is running on port `8000` and frontend is using that URL.

## Screenshots



![Enrollment UI - progress view](images/Screenshot%20from%202026-04-16%2000-01-12.png)
