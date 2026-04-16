# Face Enrollment Visualizer

Modular React + TypeScript demo of a guided face enrollment loop inspired by realtime capture systems.

The UI is split in two synchronized panels:
- Left panel: user-facing phone scene with webcam preview, prompts, progress ring, and completion screen.
- Right panel: hidden pipeline view with landmark overlay, pose telemetry, gate reasoning, coverage bins, accepted strip, rejection log, and final virtual-folder gallery.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- MediaPipe Face Landmarker (`@mediapipe/tasks-vision`)
- Canvas overlays
- In-memory session capture store
- Vitest utility tests

## Run

```bash
npm install
npm run dev
```

## Build and Test

```bash
npm run build
npm run test
```

## Architecture Summary

Core logic is modular and swappable through interfaces:

- `FaceTracker`: MediaPipe adapter returning landmarks + bounds.
- `PoseEstimator`: landmark-geometry yaw/pitch/roll estimator.
- `QualityScorer`: centered/scale/stability/brightness/blur scoring.
- `GateEngine`: two-stage decision (eligibility then usefulness).
- `CoverageTracker`: pose-bin coverage map driving progress.
- `PromptPolicy`: priority-based prompt selection with reasons.
- `EnrollmentStateMachine`: explicit states (`idle`, `tracking`, `completed`, etc.).
- `CaptureStore`: accepted frame storage and replacement by better quality.
- `EnrollmentPipeline`: deterministic orchestrator for all realtime modules.

The app intentionally does not implement identity recognition/authentication or any backend persistence.
