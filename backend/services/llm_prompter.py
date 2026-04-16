import math
import time

import requests


class LLMPrompter:
    def __init__(self):
        self.ollama_url = "http://localhost:11434/api/generate"
        self.target_angles = {
            "left": -18.0,
            "center": 0.0,
            "right": 18.0,
            "up": 16.0,
            "down": -16.0,
        }
        self.update_interval_ms = 850
        self.explicit_retry_interval_ms = 7500
        self.history = []
        self.reset()

    def reset(self):
        self.history = []
        self.last_update_ms = 0
        self.last_prompt = "Center your face in the frame."
        self.last_prompt_reason = "phase:searching"
        self.last_target_bin = None
        self.guidance_phase = "sweep_lr"

        self.lr_seen = {"left": False, "right": False}
        self.ud_seen = {"up": False, "down": False}
        self.roll_seen = {"left": False, "right": False}

        self.current_target_bin = None
        self.target_started_ms = 0
        self.target_retry_count = 0

        self.last_deterministic_prompt = ""
        self.prompt_repeat_count = 0

    def decide(self, pose, quality, missing_bins, state):
        now = int(time.time() * 1000)

        if state == "completed":
            self.guidance_phase = "complete"
            self.last_target_bin = None
            return self._commit("Done! Enrollment complete.", "phase:complete", now)

        if now - self.last_update_ms < self.update_interval_ms:
            return self.last_prompt, self.last_prompt_reason

        if not pose or quality.get("face_present", 0) < 0.5:
            self.guidance_phase = "searching"
            self.last_target_bin = None
            return self._commit("Center your face in the frame.", "phase:searching", now)

        if quality.get("stability", 0) < 0.24:
            self.guidance_phase = "searching"
            return self._commit("Hold your head steady.", "phase:unstable", now)

        if self.guidance_phase == "sweep_lr":
            prompt, done = self._sweep_left_right(pose)
            reason = "phase:sweep_lr"
            if done:
                self.guidance_phase = "sweep_ud"
                prompt = "Great. Now move your chin up and down."
                reason = "phase:transition_ud"
            return self._commit(prompt, reason, now)

        if self.guidance_phase == "sweep_ud":
            prompt, done = self._sweep_up_down(pose)
            reason = "phase:sweep_ud"
            if done:
                self.guidance_phase = "sweep_roll"
                prompt = "Now tilt your head side to side."
                reason = "phase:transition_roll"
            return self._commit(prompt, reason, now)

        if self.guidance_phase == "sweep_roll":
            prompt, done = self._sweep_roll(pose)
            reason = "phase:sweep_roll"
            if done:
                self.guidance_phase = "target"
                prompt = "Sweep complete. I will guide angle-by-angle now."
                reason = "phase:transition_target"
            return self._commit(prompt, reason, now)

        self.guidance_phase = "target"
        target_bin = self.pick_target_bin(pose, missing_bins)

        if not target_bin:
            self.last_target_bin = None
            return self._commit("Hold steady. Capturing complete.", "phase:target:none", now)

        self.last_target_bin = target_bin
        deterministic_prompt, reason = self._target_prompt(pose, quality, target_bin, missing_bins, now)

        if deterministic_prompt == self.last_deterministic_prompt:
            self.prompt_repeat_count += 1
        else:
            self.prompt_repeat_count = 0
        self.last_deterministic_prompt = deterministic_prompt

        final_prompt = deterministic_prompt
        if self._should_use_llm_rephrase(deterministic_prompt):
            llm_prompt = self._rephrase_with_llm(deterministic_prompt, target_bin, pose, quality)
            cleaned = self._clean_instruction(llm_prompt, deterministic_prompt)
            if cleaned != deterministic_prompt:
                final_prompt = cleaned
                reason = f"{reason}:llm"

        return self._commit(final_prompt, reason, now)

    def _commit(self, prompt, reason, now):
        self.last_prompt = prompt
        self.last_prompt_reason = reason
        self.last_update_ms = now

        self.history.append(prompt)
        if len(self.history) > 8:
            self.history.pop(0)

        return prompt, reason

    def _sweep_left_right(self, pose):
        yaw = float(pose.get("yaw", 0.0))
        if yaw <= -14:
            self.lr_seen["left"] = True
        if yaw >= 14:
            self.lr_seen["right"] = True

        if self.lr_seen["left"] and self.lr_seen["right"]:
            return "Left-right sweep complete.", True

        if not self.lr_seen["left"] and not self.lr_seen["right"]:
            return "Rotate your head left slowly.", False
        if not self.lr_seen["right"]:
            return "Now rotate your head to the right.", False
        return "Now rotate your head to the left.", False

    def _sweep_up_down(self, pose):
        pitch = float(pose.get("pitch", 0.0))
        if pitch >= 13:
            self.ud_seen["up"] = True
        if pitch <= -13:
            self.ud_seen["down"] = True

        if self.ud_seen["up"] and self.ud_seen["down"]:
            return "Up-down sweep complete.", True

        if not self.ud_seen["up"] and not self.ud_seen["down"]:
            return "Lift your chin up slowly.", False
        if not self.ud_seen["down"]:
            return "Now lower your chin down.", False
        return "Now lift your chin up.", False

    def _sweep_roll(self, pose):
        roll = float(pose.get("roll", 0.0))
        if roll <= -8:
            self.roll_seen["left"] = True
        if roll >= 8:
            self.roll_seen["right"] = True

        if self.roll_seen["left"] and self.roll_seen["right"]:
            return "Head-tilt sweep complete.", True

        if not self.roll_seen["left"] and not self.roll_seen["right"]:
            return "Tilt your head toward your left shoulder.", False
        if not self.roll_seen["right"]:
            return "Now tilt toward your right shoulder.", False
        return "Now tilt toward your left shoulder.", False

    def pick_target_bin(self, pose, missing_bins):
        if not missing_bins:
            return None
        if not pose:
            return missing_bins[0]

        yaw_now = float(pose.get("yaw", 0.0))
        pitch_now = float(pose.get("pitch", 0.0))
        scored = []

        for key in missing_bins:
            yaw_label, pitch_label = key.split("_")
            target_yaw = self.target_angles[yaw_label]
            target_pitch = self.target_angles[pitch_label]

            yaw_dist = abs(yaw_now - target_yaw)
            pitch_dist = abs(pitch_now - target_pitch)
            max_dist = max(yaw_dist, pitch_dist)

            corner_penalty = 1.15 if yaw_label != "center" and pitch_label != "center" else 1.0
            continuity_bonus = -2.0 if key == self.current_target_bin else 0.0
            score = (max_dist * corner_penalty) + continuity_bonus
            scored.append((score, key))

        scored.sort(key=lambda item: item[0])
        return scored[0][1]

    def _target_prompt(self, pose, quality, target_bin, missing_bins, now):
        if self.current_target_bin != target_bin:
            self.current_target_bin = target_bin
            self.target_started_ms = now
            self.target_retry_count = 0

        if target_bin not in missing_bins:
            self.target_started_ms = now
            self.target_retry_count = 0

        elapsed = now - self.target_started_ms
        if elapsed >= self.explicit_retry_interval_ms and self.target_retry_count < 2:
            self.target_retry_count += 1
            self.target_started_ms = now
            explicit_prompt = f"Go to {self._humanize_bin(target_bin)} now."
            return explicit_prompt, f"phase:target:explicit:{target_bin}:retry{self.target_retry_count}"

        quality_hint = self._quality_priority_instruction(quality)
        if quality_hint:
            return quality_hint, f"phase:target:quality:{target_bin}"

        yaw_label, pitch_label = target_bin.split("_")
        yaw = float(pose.get("yaw", 0.0))
        pitch = float(pose.get("pitch", 0.0))
        target_yaw = self.target_angles[yaw_label]
        target_pitch = self.target_angles[pitch_label]

        yaw_delta = target_yaw - yaw
        pitch_delta = target_pitch - pitch
        yaw_abs = abs(yaw_delta)
        pitch_abs = abs(pitch_delta)
        max_dist = max(yaw_abs, pitch_abs)

        if max_dist <= 3.2:
            return "Perfect. Hold this angle for capture.", f"phase:target:hold:{target_bin}:{max_dist:.1f}"

        if yaw_abs >= pitch_abs:
            if yaw_delta < 0:
                prompt = "Turn your head left." if yaw_abs > 10 else "A bit more left."
            else:
                prompt = "Turn your head right." if yaw_abs > 10 else "A bit more right."
        else:
            if pitch_delta > 0:
                prompt = "Lift your chin up." if pitch_abs > 9 else "Tilt up a little more."
            else:
                prompt = "Lower your chin." if pitch_abs > 9 else "Chin down slightly."

        return prompt, f"phase:target:track:{target_bin}:{max_dist:.1f}"

    def _quality_priority_instruction(self, quality):
        if quality.get("face_centered", 0) < 0.40:
            return "Center your face in the ring."
        if quality.get("face_scale", 0) < 0.33:
            return "Move a little closer."
        if quality.get("brightness", 0) < 0.17:
            return "Face a brighter light source."
        if quality.get("blur_proxy", 0) < 0.12:
            return "Hold still so the camera can focus."
        if quality.get("stability", 0) < 0.34:
            return "Keep your head steady."
        return None

    def _should_use_llm_rephrase(self, deterministic_prompt):
        if deterministic_prompt.startswith("Go to "):
            return False
        if "Hold this angle" in deterministic_prompt:
            return False
        return self.prompt_repeat_count >= 2

    def _rephrase_with_llm(self, fallback_prompt, target_bin, pose, quality):
        action_words = "turn, tilt, move, rotate, hold, chin, head"
        llm_prompt = f"""Rephrase this instruction naturally while keeping the same action intent.
Instruction: {fallback_prompt}
Target bin: {target_bin}
Pose yaw={pose.get('yaw', 0):.1f}, pitch={pose.get('pitch', 0):.1f}, roll={pose.get('roll', 0):.1f}
Quality overall={quality.get('overall', 0):.2f}

Rules:
- 4 to 10 words
- include at least one action word from: {action_words}
- no praise-only language
- return only the instruction text
"""

        try:
            response = requests.post(
                self.ollama_url,
                json={
                    "model": "gemma3",
                    "prompt": llm_prompt,
                    "stream": False,
                    "options": {
                        "num_predict": 20,
                        "temperature": 0.45,
                    },
                },
                timeout=1.5,
            )
            response.raise_for_status()
            return response.json().get("response", "").strip().replace('"', "")
        except Exception:
            return fallback_prompt

    def _clean_instruction(self, text, fallback):
        if not text:
            return fallback

        cleaned = text.strip().strip('"').replace("\n", " ")
        lowered = cleaned.lower()

        banned = [
            "you're doing great",
            "you are doing great",
            "great job",
            "nice work",
            "excellent",
            "awesome",
        ]
        if any(phrase in lowered for phrase in banned):
            return fallback

        action_words = ("turn", "tilt", "move", "rotate", "hold", "chin", "head", "face", "go")
        if not any(word in lowered for word in action_words):
            return fallback

        word_count = len(cleaned.split())
        if word_count < 3 or word_count > 12:
            return fallback

        if ":" in cleaned:
            cleaned = cleaned.split(":")[-1].strip()

        if not cleaned.endswith((".", "!")):
            cleaned += "."

        return cleaned

    def _humanize_bin(self, target_bin):
        yaw_label, pitch_label = target_bin.split("_")
        parts = []
        if yaw_label != "center":
            parts.append(yaw_label)
        if pitch_label != "center":
            parts.append(pitch_label)
        if not parts:
            parts.append("center")
        return "-".join(parts)
