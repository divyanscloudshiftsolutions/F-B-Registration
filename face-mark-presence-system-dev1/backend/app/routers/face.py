import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import FaceEmbedding, User, UserRole
from app.services.face_service import FaceQualityError, FaceRecognitionService, FaceRegistrationError

router = APIRouter(prefix="/face", tags=["face"])

ANGLES = ["front", "right", "left", "up", "down", "front-smile", "right-smile", "left-smile"]


def _ensure_face_access(current_user: User, user_id: UUID) -> None:
    if current_user.user_role == UserRole.admin:
        return
    if current_user.user_role == UserRole.user and current_user.id == user_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access another user's face data")


@router.post("/register-multiple/{user_id}")
async def register_multiple_faces(
    user_id: UUID,
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_face_access(current_user, user_id)

    image_batches = []
    metadata = []
    for idx, file in enumerate(files):
        content = await file.read()
        image_batches.append(content)
        metadata.append({"angle": ANGLES[idx % len(ANGLES)], "expression": "neutral", "filename": file.filename})

    service = FaceRecognitionService(db)
    try:
        return service.register_multiple_faces(user_id, image_batches, metadata)
    except FaceRegistrationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/verify/{user_id}")
async def verify_face(
    user_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_face_access(current_user, user_id)

    content = await file.read()
    service = FaceRecognitionService(db)
    try:
        return service.verify_user_face(user_id, content)
    except FaceRegistrationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/recognize")
async def recognize_face(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    service = FaceRecognitionService(db)
    try:
        result = service.recognize_face(content)
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching face found")
        return result
    except FaceRegistrationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/embedding-status/{user_id}")
def embedding_status(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_face_access(current_user, user_id)
    return FaceRecognitionService(db).get_embedding_status(user_id)


@router.post("/regenerate-ensemble/{user_id}")
def regenerate_ensemble(
    user_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    embeddings = db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user_id, FaceEmbedding.is_active.is_(True)).all()
    if len(embeddings) < 3:
        raise HTTPException(status_code=400, detail="Not enough active embeddings")
    import numpy as np

    data = [np.frombuffer(e.embedding_vector, dtype=np.float64) for e in embeddings]
    service = FaceRecognitionService(db)
    service._create_ensemble_embedding(user_id, data, len(data))
    db.commit()
    return {"success": True, "userId": str(user_id)}
