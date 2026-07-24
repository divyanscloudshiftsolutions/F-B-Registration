from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import User, UserRole
from app.services.leave_service import LeaveService

router = APIRouter(prefix="/leaves", tags=["leaves"])


class LeaveApplyRequest(BaseModel):
    leave_type_id: str = Field(alias="leaveTypeId")
    start_date: date = Field(alias="startDate")
    end_date: date = Field(alias="endDate")
    reason: str = Field(min_length=1)
    duration: str = Field(default="full_day")
    attachment_url: str | None = Field(default=None, alias="attachmentUrl")
    model_config = ConfigDict(populate_by_name=True)


class LeaveActionRequest(BaseModel):
    approved: bool
    rejection_reason: str | None = Field(default=None, alias="rejectionReason")
    model_config = ConfigDict(populate_by_name=True)


@router.get("/types")
def list_leave_types(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    svc = LeaveService(db)
    return [svc.type_to_dict(t) for t in svc.list_types()]


@router.get("/balance/{user_id}")
def get_leave_balance(
    user_id: UUID,
    year: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_role == UserRole.user and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    svc = LeaveService(db)
    return [svc.balance_to_dict(b) for b in svc.get_balances(user_id, year)]


@router.post("/apply")
def apply_leave(
    payload: LeaveApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_role != UserRole.user:
        raise HTTPException(status_code=403, detail="Employee access required")
    try:
        req = LeaveService(db).apply_leave(
            current_user.id,
            {
                "leave_type_id": UUID(payload.leave_type_id),
                "start_date": payload.start_date,
                "end_date": payload.end_date,
                "reason": payload.reason,
                "duration": payload.duration,
                "attachment_url": payload.attachment_url,
            },
        )
        return LeaveService(db).request_to_dict(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/requests")
def list_leave_requests(
    status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = None if current_user.user_role == UserRole.admin else current_user.id
    svc = LeaveService(db)
    return [svc.request_to_dict(r) for r in svc.list_requests(user_id, status=status)]


@router.put("/{request_id}/approve")
def approve_leave(
    request_id: UUID,
    payload: LeaveActionRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        req = LeaveService(db).approve_or_reject(
            request_id, payload.approved, admin.id, payload.rejection_reason
        )
        return LeaveService(db).request_to_dict(req)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/carry-forward")
def carry_forward_leave(
    from_year: int = Query(..., alias="fromYear"),
    to_year: int | None = Query(default=None, alias="toYear"),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return LeaveService(db).carry_forward_balances(from_year, to_year)
