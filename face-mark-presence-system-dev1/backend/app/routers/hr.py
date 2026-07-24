from calendar import monthrange
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import AttendanceDailySummary, User, UserRole
from app.services.day_status_engine import DayStatusEngine
from app.services.holiday_weekoff_service import HolidayWeekOffService, PolicyServiceError
from app.services.leave_service import LeaveService


router = APIRouter(prefix="/hr", tags=["hr"])


# ---- Holidays ----

class HolidayRequest(BaseModel):
    name: str
    holiday_date: date = Field(alias="holidayDate")
    holiday_type: str = Field(default="public", alias="holidayType")
    applies_to: str = Field(default="all", alias="appliesTo")
    department_id: str | None = Field(default=None, alias="departmentId")
    employment_type: str | None = Field(default=None, alias="employmentType")
    is_paid: bool = Field(default=True, alias="isPaid")
    work_compensation: str = Field(default="comp_off", alias="workCompensation")
    model_config = ConfigDict(populate_by_name=True)


@router.get("/holidays")
def list_holidays(
    year: int | None = None,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    svc = HolidayWeekOffService(db)
    return [svc.holiday_to_dict(h) for h in svc.list_holidays(year)]


@router.post("/holidays", status_code=status.HTTP_201_CREATED)
def create_holiday(payload: HolidayRequest, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc = HolidayWeekOffService(db)
    try:
        h = svc.create_holiday(payload.model_dump(by_alias=False))
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return svc.holiday_to_dict(h)


@router.patch("/holidays/{holiday_id}")
def update_holiday(
    holiday_id: UUID,
    payload: HolidayRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    svc = HolidayWeekOffService(db)
    try:
        h = svc.update_holiday(holiday_id, payload.model_dump(by_alias=False))
    except PolicyServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return svc.holiday_to_dict(h)


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(holiday_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc = HolidayWeekOffService(db)
    try:
        svc.delete_holiday(holiday_id)
    except PolicyServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


# ---- Week-off policies ----

class WeekOffPolicyRequest(BaseModel):
    name: str
    code: str
    policy_type: str = Field(default="fixed", alias="policyType")
    week_off_days: list[int] = Field(default_factory=list, alias="weekOffDays")
    is_paid: bool = Field(default=True, alias="isPaid")
    work_compensation: str = Field(default="comp_off", alias="workCompensation")
    is_default: bool = Field(default=False, alias="isDefault")
    model_config = ConfigDict(populate_by_name=True)


class WeekOffAssignRequest(BaseModel):
    user_id: str = Field(alias="userId")
    policy_id: str | None = Field(default=None, alias="policyId")
    model_config = ConfigDict(populate_by_name=True)


@router.get("/weekoff-policies")
def list_weekoff_policies(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc = HolidayWeekOffService(db)
    return [svc.weekoff_to_dict(p) for p in svc.list_weekoff_policies()]


@router.post("/weekoff-policies", status_code=status.HTTP_201_CREATED)
def create_weekoff_policy(
    payload: WeekOffPolicyRequest, _: User = Depends(get_current_admin), db: Session = Depends(get_db)
):
    svc = HolidayWeekOffService(db)
    try:
        p = svc.create_weekoff_policy(payload.model_dump(by_alias=False))
    except PolicyServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return svc.weekoff_to_dict(p)


@router.patch("/weekoff-policies/{policy_id}")
def update_weekoff_policy(
    policy_id: UUID,
    payload: WeekOffPolicyRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    svc = HolidayWeekOffService(db)
    try:
        p = svc.update_weekoff_policy(policy_id, payload.model_dump(by_alias=False))
    except PolicyServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return svc.weekoff_to_dict(p)


@router.post("/weekoff-policies/assign")
def assign_weekoff_policy(
    payload: WeekOffAssignRequest, _: User = Depends(get_current_admin), db: Session = Depends(get_db)
):
    svc = HolidayWeekOffService(db)
    try:
        user = svc.assign_weekoff_policy(
            UUID(payload.user_id),
            UUID(payload.policy_id) if payload.policy_id else None,
        )
    except PolicyServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "locked" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    return {
        "userId": str(user.id),
        "weekOffPolicyId": str(user.weekoff_policy_id) if user.weekoff_policy_id else None,
    }


# ---- Leave types (admin) ----

class LeaveTypeRequest(BaseModel):
    name: str
    code: str
    max_days_per_year: int = Field(default=12, alias="maxDaysPerYear")
    is_paid: bool = Field(default=True, alias="isPaid")
    carry_forward: bool = Field(default=False, alias="carryForward")
    allow_half_day: bool = Field(default=True, alias="allowHalfDay")
    requires_approval: bool = Field(default=True, alias="requiresApproval")
    max_consecutive_days: int | None = Field(default=None, alias="maxConsecutiveDays")
    document_after_days: int | None = Field(default=None, alias="documentAfterDays")
    is_comp_off: bool = Field(default=False, alias="isCompOff")
    model_config = ConfigDict(populate_by_name=True)


@router.get("/leave-types")
def list_leave_types(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc = LeaveService(db)
    return [svc.type_to_dict(t) for t in svc.list_types(include_inactive=True)]


@router.post("/leave-types", status_code=status.HTTP_201_CREATED)
def create_leave_type(
    payload: LeaveTypeRequest, _: User = Depends(get_current_admin), db: Session = Depends(get_db)
):
    svc = LeaveService(db)
    t = svc.upsert_type(payload.model_dump(by_alias=False))
    return svc.type_to_dict(t)


@router.patch("/leave-types/{type_id}")
def update_leave_type(
    type_id: UUID,
    payload: LeaveTypeRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    t = svc.upsert_type(payload.model_dump(by_alias=False), type_id=type_id)
    return svc.type_to_dict(t)


# ---- Day status ----

@router.post("/day-status/regenerate")
def regenerate_day_status(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    user_id: str | None = Query(default=None, alias="userId"),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    engine = DayStatusEngine(db)
    uid = UUID(user_id) if user_id else None
    return engine.regenerate_month(month, year, user_id=uid)


@router.get("/day-status/summary")
def day_status_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    user_id: str | None = Query(default=None, alias="userId"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_id and current_user.user_role == UserRole.admin:
        target = UUID(user_id)
    else:
        target = current_user.id
    return DayStatusEngine(db).monthly_summary(target, month, year)


@router.get("/day-status/timesheet")
def day_status_timesheet(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Bulk admin timesheet from attendance_daily_summaries (same truth as payroll)."""
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    engine = DayStatusEngine(db)

    # Ensure month is materialized for all employees
    engine.regenerate_month(month, year)

    rows = (
        db.query(AttendanceDailySummary)
        .options(joinedload(AttendanceDailySummary.user))
        .filter(
            AttendanceDailySummary.work_date >= start,
            AttendanceDailySummary.work_date <= end,
        )
        .order_by(AttendanceDailySummary.work_date.desc())
        .all()
    )

    out = []
    for r in rows:
        user = r.user
        worked_h = round((r.worked_minutes or 0) / 60, 2)
        expected_h = round((r.expected_minutes or 0) / 60, 2) or 8
        ot_h = round((r.overtime_minutes or 0) / 60, 2)
        incomplete = bool(r.check_in_at and not r.check_out_at)
        if incomplete:
            hours_status = "incomplete"
        elif ot_h > 0:
            hours_status = "overtime"
        elif worked_h and worked_h < expected_h * 0.9:
            hours_status = "under"
        else:
            hours_status = "normal"

        out.append(
            {
                "id": str(r.id),
                "userId": str(r.user_id),
                "userName": user.user_name if user else "Unknown",
                "employeeCode": user.employee_code if user else None,
                "employmentType": user.employment_type if user else None,
                "date": r.work_date.isoformat(),
                "checkIn": r.check_in_at.isoformat() if r.check_in_at else None,
                "checkOut": r.check_out_at.isoformat() if r.check_out_at else None,
                "workHours": worked_h if r.worked_minutes else None,
                "expectedHours": expected_h,
                "overtimeThreshold": expected_h,
                "overtimeHours": ot_h,
                "hoursStatus": hours_status,
                "dayStatus": r.attendance_status.value if r.attendance_status else None,
                "payableDayFraction": float(r.payable_day_fraction or 0),
                "lopDayFraction": float(r.lop_day_fraction or 0),
                "isHoliday": r.is_holiday,
                "isWeekOff": r.is_week_off,
            }
        )

    return {"month": month, "year": year, "rows": out}
