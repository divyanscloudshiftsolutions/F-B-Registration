from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.services.media_url import resolve_documents_urls, resolve_media_url
from app.models import Attendance, User, UserRole, WeekOffRequest
from app.schemas import (
    AdminResponse,
    AttendanceResponse,
    EmployeeResponse,
    EmployeeSalaryInput,
    UserResponse,
    WeekOffResponse,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        userId=str(user.id),
        email=user.email,
        userName=user.user_name,
        userRole=user.user_role.value,
        userImage=resolve_media_url(user.user_image),
    )


def employee_to_response(user: User) -> EmployeeResponse:
    active_salary = next((s for s in (user.salary_structures or []) if s.is_active), None)
    has_salary = active_salary is not None

    salary = None
    if active_salary:
        salary = EmployeeSalaryInput(
            basicSalary=float(active_salary.basic_salary),
            hra=float(active_salary.hra),
            da=float(active_salary.da),
            conveyance=float(active_salary.conveyance),
            medicalAllowance=float(active_salary.medical_allowance),
            specialAllowance=float(active_salary.special_allowance),
            overtimeRate=float(active_salary.overtime_rate) if active_salary.overtime_rate else None,
            effectiveFrom=active_salary.effective_from,
        )

    return EmployeeResponse(
        userId=str(user.id),
        email=user.email,
        userName=user.user_name,
        userRole=user.user_role.value,
        userImage=resolve_media_url(user.user_image),
        phone=user.phone,
        employeeCode=user.employee_code,
        departmentId=str(user.department_id) if user.department_id else None,
        departmentName=user.department.name if user.department else None,
        joiningDate=user.joining_date.isoformat() if user.joining_date else None,
        terminationDate=user.termination_date.isoformat() if user.termination_date else None,
        designation=user.designation,
        employmentType=user.employment_type,
        status=user.status or "Active",
        aadhaarNumber=user.aadhaar_number,
        panNumber=user.pan_number,
        uanNumber=user.uan_number,
        esiNumber=user.esi_number,
        bankAccountNumber=user.bank_account_number,
        bankIfsc=user.bank_ifsc,
        bankName=user.bank_name,
        documents=resolve_documents_urls(user.documents_metadata or {}),
        hasSalaryStructure=has_salary,
        salary=salary,
        createdAt=user.created_at.isoformat() if user.created_at else None,
    )


def admin_to_response(user: User) -> AdminResponse:
    avatar = resolve_media_url(user.user_image) or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.email}"
    return AdminResponse(id=str(user.id), name=user.user_name, email=user.email, avatar=avatar, role="admin")


def attendance_to_response(record: Attendance) -> AttendanceResponse:
    return AttendanceResponse(
        id=str(record.id),
        userId=str(record.user_id),
        userName=record.user_name,
        userEmail=record.user_email,
        timestamp=record.timestamp.isoformat(),
        type=record.type.value,
        method=record.method.value,
        status=record.status.value,
        location=record.location,
        note=record.note,
        imageUrl=resolve_media_url(record.image_url),
        faceConfidence=float(record.face_confidence) if record.face_confidence is not None else None,
        workHours=float(record.work_hours) if record.work_hours is not None else None,
        dayStatus=record.day_status,
    )


def weekoff_to_response(record: WeekOffRequest) -> WeekOffResponse:
    return WeekOffResponse(
        id=str(record.id),
        userId=str(record.user_id),
        userEmail=record.user_email,
        date=record.date.isoformat(),
        reason=record.reason,
        status=record.status.value,
        createdAt=record.created_at.isoformat(),
    )
