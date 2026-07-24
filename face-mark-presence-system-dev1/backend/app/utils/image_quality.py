import cv2
import numpy as np


class ImageQualityChecker:
    MIN_FACE_SIZE = 60
    MIN_BRIGHTNESS = 50
    MAX_BRIGHTNESS = 230
    MIN_CONTRAST = 30
    MIN_SHARPNESS = 20

    def check_face_quality(self, image: np.ndarray, face_location: tuple) -> dict:
        top, right, bottom, left = face_location
        face_region = image[top:bottom, left:right]
        issues = []
        details = {}

        face_height = bottom - top
        face_width = right - left
        details["face_size"] = (face_width, face_height)
        if face_height < self.MIN_FACE_SIZE or face_width < self.MIN_FACE_SIZE:
            issues.append("Face too small")

        if face_region.size == 0:
            return {"passed": False, "score": 0.0, "message": "Invalid face region", "details": details}

        gray = cv2.cvtColor(face_region, cv2.COLOR_RGB2GRAY) if len(face_region.shape) == 3 else face_region
        brightness = float(np.mean(gray))
        details["brightness"] = brightness
        if brightness < self.MIN_BRIGHTNESS:
            issues.append("Image too dark")
        elif brightness > self.MAX_BRIGHTNESS:
            issues.append("Image too bright")

        contrast = float(np.std(gray))
        details["contrast"] = contrast
        if contrast < self.MIN_CONTRAST:
            issues.append("Low contrast")

        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = float(laplacian.var())
        details["sharpness"] = sharpness
        if sharpness < self.MIN_SHARPNESS:
            issues.append("Image blurry")

        score = 1.0
        if issues:
            score = max(0.3, 1.0 - len(issues) * 0.2)

        passed = len(issues) == 0 and score >= 0.6
        return {
            "passed": passed,
            "score": round(score, 2),
            "message": "; ".join(issues) if issues else "Quality check passed",
            "details": details,
        }
