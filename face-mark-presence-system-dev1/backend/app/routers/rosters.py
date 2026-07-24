from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import User, UserRole
from app.services.roster_service import RosterService, RosterServiceError, monday_of
from app.timeutil import local_today

router = APIRouter(prefix="/rosters", tags=["rosters"])


class ShiftCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    code: str = Field(min_length=1)
    start_time: str = Field(default="09:00", alias="startTime")
    end_time: str = Field(default="18:00", alias="endTime")
    color: str = Field(default="#3b82f6")
    is_active: bool = Field(default=True, alias="isActive")
    sort_order: int = Field(default=0, alias="sortOrder")
    model_config = ConfigDict(populate_by_name=True)


class ShiftUpdateRequest(BaseModel):
    name: str | None = None
    code: str | None = None
    start_time: str | None = Field(default=None, alias="startTime")
    end_time: str | None = Field(default=None, alias="endTime")
    color: str | None = None
    is_active: bool | None = Field(default=None, alias="isActive")
    sort_order: int | None = Field(default=None, alias="sortOrder")
    model_config = ConfigDict(populate_by_name=True)


class AssignmentItem(BaseModel):
    user_id: str = Field(alias="userId")
    work_date: date = Field(alias="workDate")
    shift_id: str | None = Field(default=None, alias="shiftId")
    is_week_off: bool = Field(default=False, alias="isWeekOff")
    notes: str | None = None
    model_config = ConfigDict(populate_by_name=True)


class BulkAssignmentsRequest(BaseModel):
    assignments: list[AssignmentItem]


class ApplyWeekShiftRequest(BaseModel):
    user_id: str = Field(alias="userId")
    shift_id: str | None = Field(default=None, alias="shiftId")
    is_week_off: bool = Field(default=False, alias="isWeekOff")
    skip_dates: list[date] = Field(default_factory=list, alias="skipDates")
    model_config = ConfigDict(populate_by_name=True)


# ---- Shifts ----


@router.get("/shifts")
def list_shifts(
    active_only: bool = Query(default=True, alias="activeOnly"),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    return [service.shift_to_dict(s) for s in service.list_shifts(active_only=active_only)]


@router.post("/shifts", status_code=status.HTTP_201_CREATED)
def create_shift(
    payload: ShiftCreateRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        shift = service.create_shift(payload.model_dump(by_alias=False))
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return service.shift_to_dict(shift)


@router.patch("/shifts/{shift_id}")
def update_shift(
    shift_id: UUID,
    payload: ShiftUpdateRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        shift = service.update_shift(shift_id, payload.model_dump(by_alias=False, exclude_unset=True))
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return service.shift_to_dict(shift)


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift(
    shift_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        service.delete_shift(shift_id)
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---- Weekly roster ----


@router.get("/week")
def get_week_roster(
    week_start: date | None = Query(default=None, alias="weekStart"),
    department_id: UUID | None = Query(default=None, alias="departmentId"),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    start = monday_of(week_start or local_today())
    roster = service.get_or_create_week(start, created_by=current_user.id)
    return service.build_week_response(roster, department_id=department_id)


@router.put("/week/{roster_id}/assignments")
def save_assignments(
    roster_id: UUID,
    payload: BulkAssignmentsRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        items = [a.model_dump(by_alias=False) for a in payload.assignments]
        roster = service.upsert_assignments(roster_id, items)
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = 409 if "locked" in detail.lower() else 400
        raise HTTPException(status_code=code, detail=detail) from exc
    return service.build_week_response(roster)


@router.post("/week/{roster_id}/apply-week")
def apply_week_shift(
    roster_id: UUID,
    payload: ApplyWeekShiftRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        roster = service.apply_shift_to_employee_week(
            roster_id=roster_id,
            user_id=UUID(payload.user_id),
            shift_id=UUID(payload.shift_id) if payload.shift_id else None,
            is_week_off=payload.is_week_off,
            skip_dates=payload.skip_dates,
        )
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = 409 if "locked" in detail.lower() else 400
        raise HTTPException(status_code=code, detail=detail) from exc
    return service.build_week_response(roster)


@router.post("/week/{roster_id}/publish")
def publish_roster(
    roster_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        roster = service.publish(roster_id)
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = 409 if "locked" in detail.lower() else 400
        raise HTTPException(status_code=code, detail=detail) from exc
    return service.build_week_response(roster)


@router.post("/week/{roster_id}/unpublish")
def unpublish_roster(
    roster_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        roster = service.unpublish(roster_id)
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = 409 if "locked" in detail.lower() else 400
        raise HTTPException(status_code=code, detail=detail) from exc
    return service.build_week_response(roster)


@router.post("/week/copy-previous")
def copy_previous_week(
    week_start: date = Query(..., alias="weekStart"),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = RosterService(db)
    try:
        roster = service.copy_from_previous(week_start, created_by=current_user.id)
    except RosterServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return service.build_week_response(roster)


@router.get("/my-week")
def my_week_roster(
    week_start: date | None = Query(default=None, alias="weekStart"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Employee view of their own published roster for a week."""
    if current_user.user_role != UserRole.user:
        raise HTTPException(status_code=403, detail="Employee access required")

    service = RosterService(db)
    start = monday_of(week_start or local_today())
    roster = service.get_or_create_week(start)
    full = service.build_week_response(roster)
    mine = next((e for e in full["employees"] if e["userId"] == str(current_user.id)), None)
    return {
        "weekStart": full["weekStart"],
        "weekEnd": full["weekEnd"],
        "status": full["status"],
        "dates": full["dates"],
        "employee": mine,
    }
