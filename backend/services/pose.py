import numpy as np
import math

class PoseEstimator:
    def __init__(self, smoothing_alpha=0.45):
        self.smoothing_alpha = smoothing_alpha
        self.last_pose = None
        self.last_raw_pose = None

        self.is_calibrated = False
        self.neutral_offset = {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}
        self.calibration_samples = []
        self.calibration_frame_count = 0

        self.min_calibration_samples = 12
        self.max_calibration_frames = 90
        self.min_eye_distance_for_calibration = 0.07
        self.max_center_distance_for_calibration = 0.15
        self.max_pose_step_for_calibration = 2.8

    def reset(self):
        self.last_pose = None
        self.last_raw_pose = None

        self.is_calibrated = False
        self.neutral_offset = {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}
        self.calibration_samples = []
        self.calibration_frame_count = 0

    def get_calibration_state(self):
        return {
            "isCalibrated": bool(self.is_calibrated),
            "sampleCount": len(self.calibration_samples),
            "frameCount": int(self.calibration_frame_count),
            "offset": {
                "yaw": float(self.neutral_offset["yaw"]),
                "pitch": float(self.neutral_offset["pitch"]),
                "roll": float(self.neutral_offset["roll"]),
            },
        }

    def _finalize_calibration(self):
        if self.calibration_samples:
            samples_np = np.array(self.calibration_samples, dtype=np.float32)
            medians = np.median(samples_np, axis=0)
            self.neutral_offset = {
                "yaw": float(medians[0]),
                "pitch": float(medians[1]),
                "roll": float(medians[2]),
            }
        self.is_calibrated = True
        self.last_pose = None

    def _sample_is_eligible(self, landmarks, raw_pose):
        nose_tip = landmarks.landmark[1]
        left_eye = landmarks.landmark[33]
        right_eye = landmarks.landmark[263]

        center_distance = float(np.hypot(nose_tip.x - 0.5, nose_tip.y - 0.5))
        eye_distance = float(np.hypot(right_eye.x - left_eye.x, right_eye.y - left_eye.y))

        if center_distance > self.max_center_distance_for_calibration:
            return False

        if eye_distance < self.min_eye_distance_for_calibration:
            return False

        if self.last_raw_pose is not None:
            yaw_step = abs(raw_pose["yaw"] - self.last_raw_pose["yaw"])
            pitch_step = abs(raw_pose["pitch"] - self.last_raw_pose["pitch"])
            roll_step = abs(raw_pose["roll"] - self.last_raw_pose["roll"])
            if max(yaw_step, pitch_step, roll_step) > self.max_pose_step_for_calibration:
                return False

        return True

    def _update_calibration(self, landmarks, raw_pose):
        if self.is_calibrated:
            self.last_raw_pose = raw_pose
            return

        self.calibration_frame_count += 1
        if self._sample_is_eligible(landmarks, raw_pose):
            self.calibration_samples.append((raw_pose["yaw"], raw_pose["pitch"], raw_pose["roll"]))

        if len(self.calibration_samples) >= self.min_calibration_samples:
            self._finalize_calibration()
        elif self.calibration_frame_count >= self.max_calibration_frames:
            # Fallback finalization still uses whatever stable samples were collected.
            self._finalize_calibration()

        self.last_raw_pose = raw_pose

    def _apply_neutral_offset(self, pose):
        if not self.is_calibrated:
            return pose

        return {
            "yaw": pose["yaw"] - self.neutral_offset["yaw"],
            "pitch": pose["pitch"] - self.neutral_offset["pitch"],
            "roll": pose["roll"] - self.neutral_offset["roll"],
        }

    def _smooth_pose(self, pose):
        if self.last_pose is None:
            self.last_pose = pose
            return pose

        alpha = float(self.smoothing_alpha)
        smoothed = {
            "yaw": alpha * pose["yaw"] + (1.0 - alpha) * self.last_pose["yaw"],
            "pitch": alpha * pose["pitch"] + (1.0 - alpha) * self.last_pose["pitch"],
            "roll": alpha * pose["roll"] + (1.0 - alpha) * self.last_pose["roll"],
        }
        self.last_pose = smoothed
        return smoothed

    def estimate(self, landmarks, width, height):
        # Specific landmarks for yaw/pitch/roll calculation
        # 1: Nose tip
        # 33: Left eye outer
        # 263: Right eye outer
        # 61: Left mouth corner
        # 291: Right mouth corner
        # 152: Chin
        
        nose_tip = landmarks.landmark[1]
        chin = landmarks.landmark[152]
        left_eye = landmarks.landmark[33]
        right_eye = landmarks.landmark[263]
        # Basic geometric pose estimation
        # Yaw: Difference in distance from nose to eyes
        eye_dist = abs(right_eye.x - left_eye.x)
        nose_rel_x = (nose_tip.x - left_eye.x) / eye_dist if eye_dist != 0 else 0.5
        yaw = (nose_rel_x - 0.5) * 120 # Mapping to degrees

        # Pitch: Relative vertical position of nose between eyes and chin.
        # A 0.50 anchor keeps neutral near 0 and improves up-pose sensitivity.
        mid_eye_y = (left_eye.y + right_eye.y) / 2
        face_height = abs(chin.y - mid_eye_y)
        nose_rel_y = (nose_tip.y - mid_eye_y) / face_height if face_height != 0 else 0.5
        pitch = (0.50 - nose_rel_y) * 95  # positive is up

        # Roll: Angle between eyes
        dx = right_eye.x - left_eye.x
        dy = right_eye.y - left_eye.y
        roll = math.degrees(math.atan2(dy, dx))

        raw_pose = {
            "yaw": float(np.clip(yaw, -65.0, 65.0)),
            "pitch": float(np.clip(pitch, -55.0, 55.0)),
            "roll": float(np.clip(roll, -45.0, 45.0)),
        }
        self._update_calibration(landmarks, raw_pose)
        corrected_pose = self._apply_neutral_offset(raw_pose)
        smoothed_pose = self._smooth_pose(corrected_pose)

        return {
            "yaw": float(smoothed_pose["yaw"]),
            "pitch": float(smoothed_pose["pitch"]),
            "roll": float(smoothed_pose["roll"]),
        }
