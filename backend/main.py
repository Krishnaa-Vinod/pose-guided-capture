import base64
import json
import time

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from services.tracker import FaceTracker
from services.pose import PoseEstimator
from services.gating import GatingEngine
from services.coverage import CoverageTracker
from services.llm_prompter import LLMPrompter
from services.storage import CaptureStore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances (simplified for demo)
tracker = FaceTracker()
pose_estimator = PoseEstimator()
gating_engine = GatingEngine()
coverage_tracker = CoverageTracker()
llm_prompter = LLMPrompter()
storage = CaptureStore(
    root_dir="/mnt/NewVolume1/pose-guided-capture-demo/backend/enrollment",
    selected_root_dir="/mnt/NewVolume1/pose-guided-capture-demo/backend/selected-captures",
)

class QualityScorer:
    def __init__(self):
        self.prev_keypoints = None

    def reset(self):
        self.prev_keypoints = None

    def _extract_face_roi(self, landmarks, image_np):
        h, w = image_np.shape[:2]
        x_coords = [p.x for p in landmarks.landmark]
        y_coords = [p.y for p in landmarks.landmark]

        x_min = max(0, int((min(x_coords) - 0.04) * w))
        x_max = min(w, int((max(x_coords) + 0.04) * w))
        y_min = max(0, int((min(y_coords) - 0.06) * h))
        y_max = min(h, int((max(y_coords) + 0.06) * h))

        if x_max <= x_min or y_max <= y_min:
            return image_np

        roi = image_np[y_min:y_max, x_min:x_max]
        if roi.size == 0:
            return image_np
        return roi

    def _extract_keypoints(self, landmarks):
        key_indices = (1, 33, 263, 61, 291, 152)
        return np.array(
            [[landmarks.landmark[index].x, landmarks.landmark[index].y] for index in key_indices],
            dtype=np.float32,
        )

    def _compute_stability(self, landmarks):
        current = self._extract_keypoints(landmarks)
        if self.prev_keypoints is None:
            self.prev_keypoints = current
            return 0.75

        drift = float(np.linalg.norm(current - self.prev_keypoints, axis=1).mean())
        self.prev_keypoints = current
        return float(np.clip(1.0 - drift * 16.0, 0.0, 1.0))

    def _normalize_blur(self, gray_roi):
        lap_var = float(cv2.Laplacian(gray_roi, cv2.CV_64F).var())
        return float(np.clip(lap_var / 260.0, 0.0, 1.0))

    def _normalize_contrast(self, gray_roi):
        std_value = float(np.std(gray_roi))
        return float(np.clip(std_value / 64.0, 0.0, 1.0))

    def score(self, landmarks, image_np):
        if not landmarks:
            self.prev_keypoints = None
            return {
                "face_present": 0,
                "face_centered": 0,
                "face_scale": 0,
                "stability": 0,
                "brightness": 0,
                "contrast": 0,
                "blur_proxy": 0,
                "overall": 0,
            }
            
        nose = landmarks.landmark[1]
        dist_from_center = np.sqrt((nose.x - 0.5)**2 + (nose.y - 0.5)**2)
        centered = max(0, 1 - dist_from_center * 2)
        
        eye_dist = np.sqrt((landmarks.landmark[33].x - landmarks.landmark[263].x)**2 + 
                          (landmarks.landmark[33].y - landmarks.landmark[263].y)**2)
        eye_scale = min(1.0, eye_dist * 5.2)

        x_coords = [p.x for p in landmarks.landmark]
        y_coords = [p.y for p in landmarks.landmark]
        face_area = max(0.0, (max(x_coords) - min(x_coords)) * (max(y_coords) - min(y_coords)))
        area_scale = min(1.0, face_area * 9.0)
        scale = (eye_scale * 0.7) + (area_scale * 0.3)
        
        face_roi = self._extract_face_roi(landmarks, image_np)
        gray_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray_roi) / 255.0
        contrast = self._normalize_contrast(gray_roi)
        blur_proxy = self._normalize_blur(gray_roi)
        
        stability = self._compute_stability(landmarks)
        
        overall = (
            (centered * 0.24)
            + (scale * 0.18)
            + (brightness * 0.14)
            + (stability * 0.22)
            + (blur_proxy * 0.14)
            + (contrast * 0.08)
        )
        
        return {
            "face_present": 1.0,
            "face_centered": float(centered),
            "face_scale": float(scale),
            "brightness": float(brightness),
            "contrast": float(contrast),
            "stability": float(stability),
            "blur_proxy": float(blur_proxy),
            "overall": float(overall)
        }

scorer = QualityScorer()

@app.websocket("/ws/enrollment")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    coverage_tracker.reset()
    pose_estimator.reset()
    scorer.reset()
    llm_prompter.reset()
    storage.clear_selected()
    storage.clear_enrollment()
    session_id = f"session_{int(time.time() * 1000)}"
    
    try:
        while True:
            # Receive data from client
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("type") == "reset":
                coverage_tracker.reset()
                pose_estimator.reset()
                scorer.reset()
                llm_prompter.reset()
                storage.clear_selected()
                storage.clear_enrollment()
                session_id = f"session_{int(time.time() * 1000)}"
                continue

            frame_data = payload.get("frame")
            if not frame_data or "," not in frame_data:
                continue

            # Decode base64 frame
            encoded_data = frame_data.split(',', 1)[1]
            try:
                nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            except Exception:
                continue

            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                continue

            h, w, _ = img.shape

            # Pipeline
            landmarks = tracker.process_frame(img)
            pose = pose_estimator.estimate(landmarks, w, h) if landmarks else None
            quality = scorer.score(landmarks, img)
            calibration_state = pose_estimator.get_calibration_state()
            
            pose_bin_key = coverage_tracker.get_bin_key(pose["yaw"], pose["pitch"]) if pose else "center_center"

            if pose and not calibration_state["isCalibrated"]:
                gate = {
                    "eligibilityPassed": False,
                    "accepted": False,
                    "failures": ["Calibrating neutral pose"],
                    "qualityFailures": [],
                    "decisionReason": "Calibrating neutral pose",
                }
            else:
                gate = gating_engine.evaluate(quality, pose_bin_key)
            
            # Update coverage if accepted
            if gate["accepted"] and pose:
                should_save, progress = coverage_tracker.update(pose_bin_key, quality["overall"], encoded_data)
                if should_save:
                    selected_info = storage.save_selected_frame(
                        img,
                        pose_bin_key,
                        session_id,
                        quality["overall"],
                        pose=pose,
                        quality=quality,
                    )
                    coverage_tracker.set_selected_metadata(
                        pose_bin_key,
                        selected_path=selected_info["relativePath"],
                        saved_at_ms=selected_info["savedAtMs"],
                    )
            else:
                progress = coverage_tracker.get_progress()

            state = 'completed' if progress >= 1.0 else 'tracking'
            
            missing_bins = coverage_tracker.get_missing_bins()
            if pose and not calibration_state["isCalibrated"]:
                prompt_text = "Hold still and face forward for calibration."
                prompt_reason = f"calibrating:{calibration_state['sampleCount']}/{pose_estimator.min_calibration_samples}"
            else:
                prompt_text, prompt_reason = llm_prompter.decide(pose, quality, missing_bins, state)
            selected_captures = coverage_tracker.get_selected_captures()

            # Response
            response = {
                "state": state,
                "sessionLabel": session_id,
                "progress": progress,
                "pose": pose,
                "poseCalibration": calibration_state,
                "targetBin": llm_prompter.last_target_bin,
                "guidance": {
                    "phase": llm_prompter.guidance_phase,
                    "targetBin": llm_prompter.last_target_bin,
                    "targetRetryCount": llm_prompter.target_retry_count,
                },
                "quality": quality,
                "gate": {
                    "accepted": gate["accepted"],
                    "decisionReason": gate["decisionReason"],
                    "failures": gate.get("failures", []),
                    "qualityFailures": gate.get("qualityFailures", []),
                },
                "prompt": {
                    "text": prompt_text,
                    "reason": prompt_reason
                },
                "selectedCaptures": selected_captures,
                "coverageBins": [
                    {
                        "key": k,
                        "filled": v["filled"],
                        "bestQuality": v["bestQuality"],
                        "image": v.get("image"),
                        "selectedPath": v.get("selectedPath"),
                        "savedAtMs": v.get("savedAtMs"),
                    }
                    for k, v in coverage_tracker.bins.items()
                ],
                "landmarks": [{"x": p.x, "y": p.y} for p in landmarks.landmark[:468]] if landmarks else []
            }
            
            await websocket.send_text(json.dumps(response))

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
