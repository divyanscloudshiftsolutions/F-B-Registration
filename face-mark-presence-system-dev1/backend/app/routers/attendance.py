from datetime import date, datetime, timezone
from uuid import UUID
import logging
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import Attendance, AttendanceMethod, AttendanceType, RecordStatus, User, UserRole
from app.schemas import AttendanceCreateRequest, AttendanceResponse, AttendanceUpdateRequest
from app.security import require_kiosk_token
from app.services import attendance_to_response
from app.services.attendance_policy_service import AttendancePolicyService
from app.services.day_status_engine import DayStatusEngine
from app.services.face_service import FaceRecognitionService, FaceRegistrationError
from app.services.payroll_service import assert_attendance_month_writable
from app.services.storage_service import save_file
from app.timeutil import get_app_timezone, local_day_bounds_utc, local_today, to_local_date, utc_now

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["attendance"])


class FaceCheckRequest(BaseModel):
    location: dict | None = None
    note: str | None = None


def _ensure_writable(db: Session, when: datetime | None = None) -> None:
    try:
        assert_attendance_month_writable(db, when or utc_now())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


def _refresh_day_status(
    db: Session,
    user_id: UUID,
    *timestamps: datetime | None,
    include_adjacent: bool = False,
) -> None:
    """Update attendance_daily_summaries for affected local dates. Raises on failure."""
    try:
        DayStatusEngine(db).refresh_for_timestamps(
            user_id,
            *timestamps,
            commit=False,
            include_adjacent=include_adjacent,
        )
    except Exception:
        logger.exception(
            "DayStatusEngine refresh failed for user_id=%s timestamps=%s",
            user_id,
            [ts.isoformat() if isinstance(ts, datetime) else ts for ts in timestamps if ts is not None],
        )
        raise


def _default_status(method: str) -> RecordStatus:
    return RecordStatus.pending if method == "manual" else RecordStatus.approved


def _local_day_bounds() -> tuple[datetime, datetime]:
    """Bound today's attendance window using APP_TIMEZONE calendar day."""
    return local_day_bounds_utc()


def _today_attendance_counts(db: Session, user_id: UUID) -> tuple[int, int]:
    start, end = _local_day_bounds()
    common = (
        Attendance.user_id == user_id,
        Attendance.timestamp >= start,
        Attendance.timestamp <= end,
        Attendance.status != RecordStatus.rejected,
    )
    checkins = (
        db.query(Attendance)
        .filter(*common, Attendance.type == AttendanceType.check_in)
        .count()
    )
    checkouts = (
        db.query(Attendance)
        .filter(*common, Attendance.type == AttendanceType.check_out)
        .count()
    )
    return checkins, checkouts


def _attendance_state(db: Session, user_id: UUID) -> str:
    """
    Returns:
      - can_checkin: no open session today (including first check-in of the day)
      - can_checkout: checked in today but not yet checked out
      - completed: check-in and check-out already recorded for today
    """
    checkins, checkouts = _today_attendance_counts(db, user_id)
    if checkins == 0:
        return "can_checkin"
    if checkins > checkouts:
        return "can_checkout"
    return "completed"


def _has_open_checkin(db: Session, user_id: UUID) -> bool:
    return _attendance_state(db, user_id) == "can_checkout"


def _already_completed_today(db: Session, user_id: UUID) -> bool:
    return _attendance_state(db, user_id) == "completed"


@router.post("/checkin", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def face_checkin(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_writable(db)
    if _has_open_checkin(db, current_user.id):
        raise HTTPException(status_code=400, detail="Already checked in. Please check out first.")

    content = await file.read()
    service = FaceRecognitionService(db)
    try:
        verify = service.verify_user_face(current_user.id, content)
    except FaceRegistrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    key = f"attendance-photos/{current_user.id}_{int(time.time() * 1000)}.jpg"
    image_url = save_file(key, content, "image/jpeg")

    record = Attendance(
        user_id=current_user.id,
        user_name=current_user.user_name,
        user_email=current_user.email,
        timestamp=utc_now(),
        type=AttendanceType.check_in,
        method=AttendanceMethod.face,
        status=RecordStatus.approved,
        image_url=image_url,
        face_confidence=verify.get("confidence"),
        note="Face verified check-in",
    )
    db.add(record)
    AttendancePolicyService(db).apply_checkin_flags(record)
    db.flush()
    _refresh_day_status(db, current_user.id, record.timestamp, include_adjacent=True)
    db.commit()
    db.refresh(record)
    return attendance_to_response(record)


@router.post("/checkout", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def face_checkout(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_writable(db)
    if not _has_open_checkin(db, current_user.id):
        raise HTTPException(status_code=400, detail="No open check-in found for today.")

    content = await file.read()
    service = FaceRecognitionService(db)
    try:
        verify = service.verify_user_face(current_user.id, content)
    except FaceRegistrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    key = f"attendance-photos/{current_user.id}_{int(time.time() * 1000)}.jpg"
    image_url = save_file(key, content, "image/jpeg")

    record = Attendance(
        user_id=current_user.id,
        user_name=current_user.user_name,
        user_email=current_user.email,
        timestamp=utc_now(),
        type=AttendanceType.check_out,
        method=AttendanceMethod.face,
        status=RecordStatus.approved,
        image_url=image_url,
        face_confidence=verify.get("confidence"),
        note="Face verified check-out",
    )
    db.add(record)
    AttendancePolicyService(db).apply_checkout_flags(record)
    db.flush()
    _refresh_day_status(db, current_user.id, record.timestamp, include_adjacent=True)
    db.commit()
    db.refresh(record)
    return attendance_to_response(record)


@router.post("/quick")
async def quick_face_attendance(
    file: UploadFile = File(...),
    employee_code: str | None = Form(None),
    db: Session = Depends(get_db),
    _: None = Depends(require_kiosk_token),
):
    """Kiosk endpoint: recognize face and auto check-in or check-out.

    Requires header X-Kiosk-Token matching server KIOSK_API_TOKEN.
    Optional employee_code: when provided, face match must belong to that employee.
    """
    _ensure_writable(db)
    content = await file.read()
    face_service = FaceRecognitionService(db)

    try:
        match = face_service.recognize_face(content)
    except FaceRegistrationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Face not recognized. Please complete face registration first.",
        )

    user_id = UUID(match["userId"])
    user = db.query(User).filter(User.id == user_id, User.user_role == UserRole.user).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if employee_code and employee_code.strip():
        code = employee_code.strip().upper()
        if not user.employee_code or user.employee_code.strip().upper() != code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Face does not match the entered Employee ID.",
            )

    state = _attendance_state(db, user_id)
    if state == "completed":
        start, end = _local_day_bounds()
        last_checkout = (
            db.query(Attendance)
            .filter(
                Attendance.user_id == user_id,
                Attendance.timestamp >= start,
                Attendance.timestamp <= end,
                Attendance.status != RecordStatus.rejected,
                Attendance.type == AttendanceType.check_out,
            )
            .order_by(Attendance.timestamp.desc())
            .first()
        )
        checkout_hint = ""
        if last_checkout:
            ts = last_checkout.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            checkout_at = ts.astimezone(get_app_timezone()).strftime("%I:%M %p")
            checkout_hint = f" Check-out was already recorded at {checkout_at}."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{user.user_name} has already completed attendance for today.{checkout_hint}",
        )

    is_checkout = state == "can_checkout"
    attendance_type = AttendanceType.check_out if is_checkout else AttendanceType.check_in
    action = "check-out" if is_checkout else "check-in"

    key = f"attendance-photos/{user_id}_{int(time.time() * 1000)}.jpg"
    image_url = save_file(key, content, "image/jpeg")

    record = Attendance(
        user_id=user.id,
        user_name=user.user_name,
        user_email=user.email,
        timestamp=utc_now(),
        type=attendance_type,
        method=AttendanceMethod.face,
        status=RecordStatus.approved,
        image_url=image_url,
        face_confidence=match.get("confidence"),
        note=f"Quick kiosk {action}",
    )
    db.add(record)
    policy_service = AttendancePolicyService(db)
    if is_checkout:
        policy_service.apply_checkout_flags(record)
    else:
        policy_service.apply_checkin_flags(record)
    db.flush()
    _refresh_day_status(db, user.id, record.timestamp, include_adjacent=True)
    db.commit()
    db.refresh(record)

    return {
        "action": action,
        "userId": str(user.id),
        "userName": user.user_name,
        "userEmail": user.email,
        "confidence": match.get("confidence"),
        "matchType": match.get("matchType"),
        "timestamp": record.timestamp.isoformat(),
        "message": f"{action.replace('-', ' ').title()} recorded for {user.user_name}",
        "record": attendance_to_response(record),
    }


@router.get("/today", response_model=list[AttendanceResponse])
def today_attendance(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    start, end = local_day_bounds_utc()
    records = db.query(Attendance).filter(Attendance.timestamp >= start, Attendance.timestamp <= end).all()
    return [attendance_to_response(r) for r in records]


@router.get("", response_model=list[AttendanceResponse])
def list_attendance(
    email: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Attendance)

    if current_user.user_role == UserRole.user:
        query = query.filter(Attendance.user_email == current_user.email)
    elif email:
        query = query.filter(Attendance.user_email == email)

    records = query.order_by(Attendance.timestamp.desc()).all()
    return [attendance_to_response(record) for record in records]


@router.get("/month", response_model=list[AttendanceResponse])
def list_current_month_attendance(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from calendar import monthrange

    today = local_today()
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year, today.month, monthrange(today.year, today.month)[1])
    start, _ = local_day_bounds_utc(month_start)
    _, end = local_day_bounds_utc(month_end)

    records = (
        db.query(Attendance)
        .filter(Attendance.timestamp >= start, Attendance.timestamp <= end)
        .order_by(Attendance.timestamp.desc())
        .all()
    )
    return [attendance_to_response(record) for record in records]


@router.get("/email/{email}", response_model=list[AttendanceResponse])
def list_attendance_by_email(
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_role == UserRole.user and current_user.email != email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access another user's attendance")

    records = (
        db.query(Attendance)
        .filter(Attendance.user_email == email)
        .order_by(Attendance.timestamp.desc())
        .all()
    )
    return [attendance_to_response(record) for record in records]


@router.get("/{record_id}", response_model=AttendanceResponse)
def get_attendance(record_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(Attendance).filter(Attendance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    if current_user.user_role == UserRole.user and record.user_email != current_user.email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this record")

    return attendance_to_response(record)


@router.post("", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def create_attendance(
    payload: AttendanceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = UUID(payload.user_id) if payload.user_id else current_user.id
    if current_user.user_role == UserRole.user and user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create attendance for another user")

    ts = payload.timestamp or utc_now()
    _ensure_writable(db, ts)

    record = Attendance(
        user_id=user_id,
        user_name=payload.user_name or current_user.user_name,
        user_email=payload.user_email or current_user.email,
        timestamp=ts,
        type=AttendanceType(payload.type),
        method=AttendanceMethod(payload.method),
        status=RecordStatus(payload.status) if payload.status else _default_status(payload.method),
        location=payload.location.model_dump() if payload.location else None,
        note=payload.note,
        image_url=payload.image_url,
    )
    db.add(record)
    db.flush()
    # PENDING punches are ignored by DayStatusEngine; still refresh so ADS stays consistent.
    _refresh_day_status(db, user_id, record.timestamp, include_adjacent=True)
    db.commit()
    db.refresh(record)
    return attendance_to_response(record)


@router.patch("/{record_id}", response_model=AttendanceResponse)
def update_attendance(
    record_id: UUID,
    payload: AttendanceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(Attendance).filter(Attendance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    _ensure_writable(db, record.timestamp)

    if current_user.user_role == UserRole.user:
        if record.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's record")
        if payload.status is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users cannot change approval status")

    if payload.user_id and record.user_id != UUID(payload.user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="UserId does not match with the record")

    # AttendanceUpdateRequest does not allow changing timestamp (no A→B date move in current API).
    affected_ts = record.timestamp

    if payload.status is not None:
        record.status = RecordStatus(payload.status)
    if payload.note is not None:
        record.note = payload.note
    if payload.type is not None:
        record.type = AttendanceType(payload.type)
    if payload.method is not None:
        record.method = AttendanceMethod(payload.method)
    if payload.location is not None:
        record.location = payload.location.model_dump()
    if payload.image_url is not None:
        record.image_url = payload.image_url

    db.flush()
    _refresh_day_status(db, record.user_id, affected_ts, include_adjacent=True)
    db.commit()
    db.refresh(record)
    return attendance_to_response(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(record_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    record = db.query(Attendance).filter(Attendance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
    _ensure_writable(db, record.timestamp)

    user_id = record.user_id
    affected_ts = record.timestamp
    db.delete(record)
    db.flush()
    _refresh_day_status(db, user_id, affected_ts, include_adjacent=True)
    db.commit()
