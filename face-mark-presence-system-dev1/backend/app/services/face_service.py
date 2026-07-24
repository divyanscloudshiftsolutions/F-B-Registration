import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import cv2
import numpy as np
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.services.media_url import resolve_media_url
from app.models import EmployeeEnsembleEmbedding, FaceEmbedding, User, UserRole
from app.services.storage_service import save_file
from app.utils.image_quality import ImageQualityChecker

logger = logging.getLogger(__name__)

FACE_CASCADES = [
    cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml"),
    cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml"),
]

DETECTION_ATTEMPTS = [
    {"scaleFactor": 1.2, "minNeighbors": 5, "minSize": (60, 60)},
    {"scaleFactor": 1.1, "minNeighbors": 4, "minSize": (40, 40)},
    {"scaleFactor": 1.1, "minNeighbors": 3, "minSize": (30, 30)},
    {"scaleFactor": 1.05, "minNeighbors": 2, "minSize": (20, 20)},
]


class FaceRegistrationError(Exception):
    pass


class FaceQualityError(Exception):
    pass


class FaceRecognitionService:
    def __init__(self, db: Session):
        self.db = db
        self.quality_checker = ImageQualityChecker()
        self.min_samples = settings.min_face_samples
        self.max_samples = settings.max_face_samples
        self.match_threshold = settings.face_match_threshold
        self.match_margin = settings.face_match_margin
        self.version = settings.embedding_version

    def _detect_face(self, rgb_img: np.ndarray) -> tuple[int, int, int, int]:
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)

        for gray_img in (gray, cv2.equalizeHist(gray)):
            for cascade_idx, cascade in enumerate(FACE_CASCADES):
                if cascade.empty():
                    continue
                for attempt_idx, params in enumerate(DETECTION_ATTEMPTS):
                    faces = cascade.detectMultiScale(gray_img, **params)
                    if len(faces) == 0:
                        continue
                    if cascade_idx == 0 and attempt_idx == 0 and len(faces) > 1:
                        raise FaceRegistrationError("Multiple faces detected")
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    return (y, x + w, y + h, x)

        raise FaceRegistrationError("No face detected in image")

    def _embedding_from_face(self, rgb_img: np.ndarray, face_location: tuple) -> np.ndarray:
        top, right, bottom, left = face_location
        face = rgb_img[top:bottom, left:right]
        if face.size == 0:
            raise FaceRegistrationError("Invalid face region")
        resized = cv2.resize(face, (64, 64))
        gray = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)
        vec = gray.astype(np.float64).flatten()
        norm = np.linalg.norm(vec)
        if norm < 1e-8:
            raise FaceRegistrationError("Could not extract face features")
        return vec / norm

    def extract_face_embedding(self, image_bytes: bytes, validate_quality: bool = True) -> dict:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise FaceRegistrationError("Invalid image format")

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        face_location = self._detect_face(rgb_img)
        embedding = self._embedding_from_face(rgb_img, face_location)

        quality_result = {"passed": True, "score": 1.0}
        if validate_quality:
            quality_result = self.quality_checker.check_face_quality(rgb_img, face_location)
            if not quality_result["passed"]:
                raise FaceQualityError(quality_result["message"])

        top, right, bottom, left = face_location
        return {
            "embedding": embedding,
            "face_location": face_location,
            "quality_score": quality_result.get("score", 1.0),
            "face_size": (right - left, bottom - top),
        }

    def register_multiple_faces(
        self,
        user_id: uuid.UUID,
        image_batches: list[bytes],
        image_metadata: Optional[list[dict]] = None,
    ) -> dict:
        if len(image_batches) < self.min_samples:
            raise FaceRegistrationError(
                f"Minimum {self.min_samples} face samples required. Received: {len(image_batches)}"
            )
        if len(image_batches) > self.max_samples:
            raise FaceRegistrationError(f"Maximum {self.max_samples} face samples allowed.")

        user = self.db.query(User).filter(User.id == user_id, User.user_role == UserRole.user).first()
        if not user:
            raise FaceRegistrationError("Employee not found")

        self.db.query(FaceEmbedding).filter(
            FaceEmbedding.user_id == user_id,
            FaceEmbedding.is_active.is_(True),
        ).update({"is_active": False})

        successful = []
        failed = []
        embeddings_data = []
        profile_image_url: str | None = None

        for idx, image_bytes in enumerate(image_batches):
            try:
                result = self.extract_face_embedding(image_bytes, validate_quality=True)
                metadata = image_metadata[idx] if image_metadata and idx < len(image_metadata) else {}
                key = f"faces/{user_id}/sample_{idx}_{int(time.time() * 1000)}.jpg"
                image_url = save_file(key, image_bytes, "image/jpeg")
                if profile_image_url is None:
                    profile_image_url = image_url

                record = FaceEmbedding(
                    user_id=user_id,
                    embedding_vector=result["embedding"].astype(np.float64).tobytes(),
                    reference_image_url=image_url,
                    embedding_version=self.version,
                    is_active=True,
                    is_primary=(idx == 0),
                    image_quality_score=result["quality_score"],
                    face_angle=metadata.get("angle", "front"),
                    expression=metadata.get("expression", "neutral"),
                    metadata_json=metadata,
                )
                self.db.add(record)
                embeddings_data.append(result["embedding"])
                successful.append({"index": idx, "quality_score": result["quality_score"]})
            except (FaceQualityError, FaceRegistrationError) as exc:
                failed.append({"index": idx, "error": str(exc)})
            except Exception as exc:
                failed.append({"index": idx, "error": str(exc)})

        if len(successful) < self.min_samples:
            self.db.rollback()
            raise FaceRegistrationError(
                f"Only {len(successful)} of {len(image_batches)} images passed. Minimum: {self.min_samples}."
            )

        self._create_ensemble_embedding(user_id, embeddings_data, len(successful))
        if profile_image_url:
            user.user_image = profile_image_url
        self.db.commit()

        return {
            "success": True,
            "userId": str(user_id),
            "profileImageUrl": resolve_media_url(profile_image_url),
            "totalImagesSubmitted": len(image_batches),
            "successfulEmbeddings": len(successful),
            "failedEmbeddings": len(failed),
            "failedDetails": failed,
            "message": f"Successfully registered {len(successful)} face samples",
        }

    def _create_ensemble_embedding(self, user_id: uuid.UUID, embeddings: list[np.ndarray], count: int):
        ensemble_vector = np.mean(np.array(embeddings), axis=0)
        norm = np.linalg.norm(ensemble_vector)
        if norm > 1e-8:
            ensemble_vector = ensemble_vector / norm

        existing = (
            self.db.query(EmployeeEnsembleEmbedding)
            .filter(
                EmployeeEnsembleEmbedding.user_id == user_id,
                EmployeeEnsembleEmbedding.embedding_version == self.version,
            )
            .first()
        )
        if existing:
            existing.ensemble_vector = ensemble_vector.astype(np.float64).tobytes()
            existing.embedding_count = count
            existing.is_active = True
            existing.updated_at = datetime.now(timezone.utc)
        else:
            self.db.add(
                EmployeeEnsembleEmbedding(
                    user_id=user_id,
                    ensemble_vector=ensemble_vector.astype(np.float64).tobytes(),
                    embedding_count=count,
                    embedding_version=self.version,
                    is_active=True,
                )
            )

    def _confidence(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))

    def _scores_for_user(self, user_id: uuid.UUID, unknown: np.ndarray) -> list[float]:
        embeddings = (
            self.db.query(FaceEmbedding)
            .filter(FaceEmbedding.user_id == user_id, FaceEmbedding.is_active.is_(True))
            .all()
        )
        return [
            self._confidence(np.frombuffer(emb.embedding_vector, dtype=np.float64), unknown)
            for emb in embeddings
        ]

    def _sample_match_stats(self, user_id: uuid.UUID, unknown: np.ndarray) -> tuple[float, float]:
        scores = self._scores_for_user(user_id, unknown)
        if not scores:
            return 0.0, 0.0
        return float(np.median(scores)), float(max(scores))

    def _validate_match(self, user_id: uuid.UUID, unknown: np.ndarray, ensemble_confidence: float) -> bool:
        """Require strong ensemble score plus agreement across enrolled face samples."""
        if ensemble_confidence < self.match_threshold:
            return False
        median_score, peak_score = self._sample_match_stats(user_id, unknown)
        if median_score < self.match_threshold:
            logger.info(
                "Match rejected for %s: median sample score %.3f < %.3f",
                user_id,
                median_score,
                self.match_threshold,
            )
            return False
        if peak_score < self.match_threshold + 0.03:
            logger.info(
                "Match rejected for %s: peak sample score %.3f too low",
                user_id,
                peak_score,
            )
            return False
        return True

    def verify_user_face(self, user_id: uuid.UUID, image_bytes: bytes) -> dict:
        result = self.extract_face_embedding(image_bytes, validate_quality=False)
        unknown = result["embedding"]

        ensemble = (
            self.db.query(EmployeeEnsembleEmbedding)
            .filter(
                EmployeeEnsembleEmbedding.user_id == user_id,
                EmployeeEnsembleEmbedding.is_active.is_(True),
            )
            .first()
        )
        if not ensemble:
            raise FaceRegistrationError("Face not enrolled. Complete face registration first.")

        known = np.frombuffer(ensemble.ensemble_vector, dtype=np.float64)
        confidence = self._confidence(known, unknown)

        if not self._validate_match(user_id, unknown, confidence):
            raise FaceRegistrationError(
                f"Face verification failed (confidence {confidence:.2f} < {self.match_threshold})"
            )

        user = self.db.query(User).filter(User.id == user_id).first()
        return {
            "userId": str(user_id),
            "userName": user.user_name if user else "",
            "confidence": round(confidence, 4),
            "matchType": "ensemble",
            "verified": True,
        }

    def recognize_face(self, image_bytes: bytes) -> Optional[dict]:
        result = self.extract_face_embedding(image_bytes, validate_quality=False)
        unknown = result["embedding"]

        ensembles = (
            self.db.query(EmployeeEnsembleEmbedding, User)
            .join(User, EmployeeEnsembleEmbedding.user_id == User.id)
            .filter(
                EmployeeEnsembleEmbedding.is_active.is_(True),
                User.user_role == UserRole.user,
                or_(User.status == "Active", User.status.is_(None)),
            )
            .all()
        )
        if not ensembles:
            return None

        ranked: list[tuple[float, User]] = []
        for ensemble, user in ensembles:
            known = np.frombuffer(ensemble.ensemble_vector, dtype=np.float64)
            confidence = self._confidence(known, unknown)
            ranked.append((confidence, user))

        ranked.sort(key=lambda item: item[0], reverse=True)
        best_confidence, best_match = ranked[0]

        if best_confidence < self.match_threshold:
            logger.info(
                "No match: best confidence %.3f below threshold %.3f",
                best_confidence,
                self.match_threshold,
            )
            return None

        if len(ranked) > 1:
            second_confidence = ranked[1][0]
            if (best_confidence - second_confidence) < self.match_margin:
                logger.info(
                    "Ambiguous match rejected: best=%.3f second=%.3f margin=%.3f",
                    best_confidence,
                    second_confidence,
                    self.match_margin,
                )
                return None

        if not self._validate_match(best_match.id, unknown, best_confidence):
            return None

        return {
            "userId": str(best_match.id),
            "userName": best_match.user_name,
            "email": best_match.email,
            "confidence": round(best_confidence, 4),
            "matchType": "ensemble",
        }

    def _match_individual(self, user_id: uuid.UUID, unknown: np.ndarray) -> Optional[dict]:
        embeddings = (
            self.db.query(FaceEmbedding)
            .filter(FaceEmbedding.user_id == user_id, FaceEmbedding.is_active.is_(True))
            .all()
        )
        best_confidence = 0.0
        for emb in embeddings:
            known = np.frombuffer(emb.embedding_vector, dtype=np.float64)
            confidence = self._confidence(known, unknown)
            best_confidence = max(best_confidence, confidence)

        if best_confidence >= self.match_threshold:
            user = self.db.query(User).filter(User.id == user_id).first()
            return {
                "userId": str(user_id),
                "userName": user.user_name if user else "",
                "confidence": round(best_confidence, 4),
                "matchType": "individual",
                "verified": True,
            }
        return None

    def get_embedding_status(self, user_id: uuid.UUID) -> dict:
        count = (
            self.db.query(FaceEmbedding)
            .filter(FaceEmbedding.user_id == user_id, FaceEmbedding.is_active.is_(True))
            .count()
        )
        has_ensemble = (
            self.db.query(EmployeeEnsembleEmbedding)
            .filter(EmployeeEnsembleEmbedding.user_id == user_id, EmployeeEnsembleEmbedding.is_active.is_(True))
            .first()
            is not None
        )
        return {
            "userId": str(user_id),
            "sampleCount": count,
            "hasEnsemble": has_ensemble,
            "isEnrolled": count >= self.min_samples and has_ensemble,
            "minRequired": self.min_samples,
            "maxAllowed": self.max_samples,
        }
