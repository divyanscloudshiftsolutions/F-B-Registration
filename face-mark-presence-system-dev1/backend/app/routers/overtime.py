from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import User
from app.services.overtime_service import OvertimeService

router = APIRouter(prefix="/overtime", tags=["overtime"])


class OtReviewRequest(BaseModel):
    approved: bool
    approved_minutes: int | None = Field(default=None, alias="approvedMinutes")
    notes: str | None = None
    model_config = ConfigDict(populate_by_name=True)


@router.post("/sync")
def sync_overtime(
    month: int = Query(...),
    year: int = Query(...),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return OvertimeService(db).sync_month(month, year)


@router.get("")
def list_overtime(
    month: int = Query(...),
    year: int = Query(...),
    status: str | None = None,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return OvertimeService(db).list_month(month, year, status=status)


@router.put("/{approval_id}/review")
def review_overtime(
    approval_id: UUID,
    payload: OtReviewRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return OvertimeService(db).review(
            approval_id,
            approved=payload.approved,
            approved_minutes=payload.approved_minutes,
            admin_id=admin.id,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
