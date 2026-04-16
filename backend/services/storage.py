import json
import os
import time

import cv2


class CaptureStore:
    def __init__(self, root_dir="enrollment", selected_root_dir="selected-captures"):
        self.root_dir = root_dir
        self.selected_root_dir = selected_root_dir
        os.makedirs(self.root_dir, exist_ok=True)
        os.makedirs(self.selected_root_dir, exist_ok=True)

    def _ensure_session_pose_dir(self, base_dir, session_id, pose_key):
        pose_dir = os.path.join(base_dir, session_id, pose_key)
        os.makedirs(pose_dir, exist_ok=True)
        return pose_dir

    def _metadata_path(self, session_id):
        session_dir = os.path.join(self.selected_root_dir, session_id)
        os.makedirs(session_dir, exist_ok=True)
        return os.path.join(session_dir, "metadata.json")

    def _write_selected_metadata(self, session_id, pose_key, metadata):
        metadata_path = self._metadata_path(session_id)
        payload = {}

        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
            except Exception:
                payload = {}

        payload[pose_key] = metadata

        with open(metadata_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

        return metadata_path

    def save_selected_frame(self, image_np, pose_key, session_id, best_quality, pose=None, quality=None):
        pose_dir = self._ensure_session_pose_dir(self.selected_root_dir, session_id, pose_key)
        filepath = os.path.join(pose_dir, "best.jpg")
        cv2.imwrite(filepath, image_np, [int(cv2.IMWRITE_JPEG_QUALITY), 97])

        saved_at_ms = int(time.time() * 1000)
        relative_path = os.path.relpath(filepath, self.selected_root_dir)

        metadata = {
            "relativePath": relative_path,
            "bestQuality": float(best_quality),
            "savedAtMs": saved_at_ms,
            "pose": pose,
            "quality": quality,
        }
        metadata_path = self._write_selected_metadata(session_id, pose_key, metadata)

        return {
            "path": filepath,
            "relativePath": relative_path,
            "savedAtMs": saved_at_ms,
            "metadataPath": metadata_path,
        }

    def _clear_dir(self, base_dir):
        import shutil

        if not os.path.isdir(base_dir):
            return

        for item in os.listdir(base_dir):
            if item == ".gitkeep":
                continue
            item_path = os.path.join(base_dir, item)
            try:
                if os.path.isfile(item_path):
                    os.remove(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
            except Exception as e:
                print(f"Error clearing {item_path}: {e}")

    def clear_selected(self):
        self._clear_dir(self.selected_root_dir)

    def clear_enrollment(self):
        self._clear_dir(self.root_dir)

    def clear(self):
        self.clear_enrollment()
        self.clear_selected()
