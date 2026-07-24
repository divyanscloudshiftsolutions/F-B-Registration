from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import RecordStatus, User, UserRole, WeekOffRequest
from app.schemas import WeekOffCreateRequest, WeekOffResponse, WeekOffUpdateRequest
from app.services import weekoff_to_response
from app.services.day_status_engine import DayStatusEngine
from app.services.payroll_service import assert_attendance_month_writable
from app.timeutil import to_local_date

router = APIRouter(prefix="/weekoffs", tags=["weekoffs"])


def _ensure_writable_for_date(db: Session, when) -> None:
    work_date = to_local_date(when) if not isinstance(when, date) else when
    try:
        assert_attendance_month_writable(db, work_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


def _refresh_weekoff_day(db: Session, user_id: UUID, when) -> None:
    work_date = to_local_date(when) if not isinstance(when, date) else when
    DayStatusEngine(db).refresh_user_days(user_id, [work_date], commit=False)


@router.get("", response_model=list[WeekOffResponse])
def list_weekoffs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(WeekOffRequest)
    if current_user.user_role == UserRole.user:
        query = query.filter(WeekOffRequest.user_id == current_user.id)
    records = query.order_by(WeekOffRequest.created_at.desc()).all()
    return [weekoff_to_response(record) for record in records]


@router.get("/{record_id}", response_model=WeekOffResponse)
def get_weekoff(record_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(WeekOffRequest).filter(WeekOffRequest.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Week-off request not found")
    if current_user.user_role == UserRole.user and record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this request")
    return weekoff_to_response(record)


@router.post("", response_model=WeekOffResponse, status_code=status.HTTP_201_CREATED)
def create_weekoff(
    payload: WeekOffCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = UUID(payload.user_id) if payload.user_id else current_user.id
    if current_user.user_role == UserRole.user and user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create week-off for another user")

    status_value = RecordStatus(payload.status) if payload.status else RecordStatus.pending
    # Only approved week-off requests affect DayStatus; pending create does not need lock/refresh.
    if status_value == RecordStatus.approved:
        _ensure_writable_for_date(db, payload.date)

    record = WeekOffRequest(
        user_id=user_id,
        user_email=payload.user_email or current_user.email,
        date=payload.date,
        reason=payload.reason,
        status=status_value,
    )
    db.add(record)
    db.flush()
    if status_value == RecordStatus.approved:
        _refresh_weekoff_day(db, user_id, record.date)
    db.commit()
    db.refresh(record)
    return weekoff_to_response(record)


@router.patch("/{record_id}", response_model=WeekOffResponse)
def update_weekoff(
    record_id: UUID,
    payload: WeekOffUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(WeekOffRequest).filter(WeekOffRequest.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Week-off request not found")

    if current_user.user_role == UserRole.user:
        if record.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's request")
        if payload.status is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users cannot change approval status")

    old_date = record.date
    old_status = record.status
    new_date = payload.date if payload.date is not None else old_date
    new_status = RecordStatus(payload.status) if payload.status is not None else old_status

    affects_ads = (
        old_status == RecordStatus.approved
        or new_status == RecordStatus.approved
    )
    if affects_ads:
        _ensure_writable_for_date(db, old_date)
        _ensure_writable_for_date(db, new_date)

    if payload.status is not None:
        record.status = new_status
    if payload.reason is not None:
        record.reason = payload.reason
    if payload.date is not None:
        record.date = new_date

    db.flush()
    if affects_ads:
        _refresh_weekoff_day(db, record.user_id, old_date)
        if to_local_date(new_date) != to_local_date(old_date):
            _refresh_weekoff_day(db, record.user_id, new_date)
    db.commit()
    db.refresh(record)
    return weekoff_to_response(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weekoff(record_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    record = db.query(WeekOffRequest).filter(WeekOffRequest.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Week-off request not found")
    if record.status == RecordStatus.approved:
        _ensure_writable_for_date(db, record.date)
    user_id = record.user_id
    when = record.date
    was_approved = record.status == RecordStatus.approved
    db.delete(record)
    db.flush()
    if was_approved:
        _refresh_weekoff_day(db, user_id, when)
    db.commit()
