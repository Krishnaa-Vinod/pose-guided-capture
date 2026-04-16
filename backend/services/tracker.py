import mediapipe as mp
import numpy as np
import cv2

class FaceTracker:
    def __init__(self):
        if not hasattr(mp, "solutions"):
            raise RuntimeError(
                "Incompatible mediapipe install: expected mp.solutions.FaceMesh. "
                "Use backend requirements (mediapipe==0.10.21)."
            )
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.65,
            min_tracking_confidence=0.65
        )

    def process_frame(self, image_np):
        # Convert the BGR image to RGB
        image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(image_rgb)
        
        if not results.multi_face_landmarks:
            return None
            
        return results.multi_face_landmarks[0]

    def get_bounds(self, landmarks, width, height):
        # Calculate bounding box from landmarks
        x_coords = [p.x for p in landmarks.landmark]
        y_coords = [p.y for p in landmarks.landmark]
        
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)
        
        return {
            "minX": min_x,
            "minY": min_y,
            "maxX": max_x,
            "maxY": max_y,
            "width": max_x - min_x,
            "height": max_y - min_y,
            "centerX": (min_x + max_x) / 2,
            "centerY": (min_y + max_y) / 2,
            "area": (max_x - min_x) * (max_y - min_y)
        }
