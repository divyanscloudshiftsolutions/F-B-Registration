"""Seed default admin, employee, org data, leave types, and salary."""

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import (
    AttendancePolicy,
    Department,
    DocumentType,
    EmploymentType,
    LeaveBalance,
    LeaveType,
    SalaryStructure,
    User,
    UserRole,
)
from app.services import get_user_by_email, hash_password
from app.services.attendance_policy_service import DEFAULTS_BY_CODE, DEFAULT_POLICY

SEED_USERS = [
    {
        "email": "admin@presentsir.com",
        "password": "Admin@123",
        "user_name": "System Admin",
        "user_role": UserRole.admin,
        "user_image": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
    },
    {
        "email": "employee@presentsir.com",
        "password": "Employee@123",
        "user_name": "John Employee",
        "user_role": UserRole.user,
        "user_image": "https://api.dicebear.com/7.x/avataaars/svg?seed=employee",
        "employee_code": "EMP-PS-01001",
        "joining_date": date(2024, 1, 15),
        "phone": "9876543210",
        "pan_number": "ABCDE1234F",
        "aadhaar_number": "123456789012",
    },
]

LEAVE_TYPES = [
    {"name": "Sick Leave", "code": "SL", "max_days_per_year": 12, "is_paid": True},
    {"name": "Casual Leave", "code": "CL", "max_days_per_year": 12, "is_paid": True},
    {"name": "Earned Leave", "code": "EL", "max_days_per_year": 15, "is_paid": True, "carry_forward": True},
    {"name": "Unpaid Leave", "code": "UL", "max_days_per_year": 30, "is_paid": False},
]

EMPLOYMENT_TYPES = [
    {"name": "Full-time", "code": "full-time", "sort_order": 1},
    {"name": "Part-time", "code": "part-time", "sort_order": 2},
    {"name": "Contract", "code": "contract", "sort_order": 3},
    {"name": "Intern", "code": "intern", "sort_order": 4},
]

DOCUMENT_TYPES = [
    {"key": "aadhaar", "label": "Aadhaar Card", "is_required": True, "sort_order": 1},
    {"key": "pan_card", "label": "PAN Card", "is_required": True, "sort_order": 2},
    {"key": "offer_letter", "label": "Offer Letter", "is_required": False, "sort_order": 3},
    {"key": "bank_passbook", "label": "Bank Passbook / Cancelled Cheque", "is_required": False, "sort_order": 4},
    {"key": "photo_id", "label": "Photo ID", "is_required": False, "sort_order": 5},
]


def seed_config() -> None:
    db = SessionLocal()
    try:
        for i, et in enumerate(EMPLOYMENT_TYPES):
            existing = db.query(EmploymentType).filter(EmploymentType.code == et["code"]).first()
            if not existing:
                existing = EmploymentType(**et, is_active=True)
                db.add(existing)
                db.flush()
            if not db.query(AttendancePolicy).filter(AttendancePolicy.employment_type_id == existing.id).first():
                defaults = DEFAULTS_BY_CODE.get(existing.code, DEFAULT_POLICY).copy()
                db.add(AttendancePolicy(employment_type_id=existing.id, **defaults))

        for dt in DOCUMENT_TYPES:
            if not db.query(DocumentType).filter(DocumentType.key == dt["key"]).first():
                db.add(DocumentType(**dt, is_active=True))

        if not db.query(AttendancePolicy).filter(AttendancePolicy.employment_type_id.is_(None)).first():
            db.add(AttendancePolicy())

        db.commit()
    finally:
        db.close()


def seed_users() -> None:
    db = SessionLocal()
    try:
        dept = db.query(Department).filter(Department.code == "IT").first()
        if not dept:
            dept = Department(name="Information Technology", code="IT", description="IT Department")
            db.add(dept)
            db.flush()

        for lt in LEAVE_TYPES:
            if not db.query(LeaveType).filter(LeaveType.code == lt["code"]).first():
                db.add(LeaveType(**lt))

        db.commit()

        for entry in SEED_USERS:
            existing = get_user_by_email(db, entry["email"])
            if existing:
                print(f"Skipped (exists): {entry['email']}")
                if entry["user_role"] == UserRole.user and not existing.department_id:
                    existing.department_id = dept.id
                    existing.employee_code = entry.get("employee_code")
                    existing.joining_date = entry.get("joining_date")
                    existing.phone = entry.get("phone")
                    existing.pan_number = entry.get("pan_number")
                    existing.aadhaar_number = entry.get("aadhaar_number")
                    db.commit()
                continue

            user = User(
                email=entry["email"],
                password_hash=hash_password(entry["password"]),
                user_name=entry["user_name"],
                user_role=entry["user_role"],
                user_image=entry.get("user_image"),
                department_id=dept.id if entry["user_role"] == UserRole.user else None,
                employee_code=entry.get("employee_code"),
                joining_date=entry.get("joining_date"),
                phone=entry.get("phone"),
                pan_number=entry.get("pan_number"),
                aadhaar_number=entry.get("aadhaar_number"),
                status="Active",
            )
            db.add(user)
            db.flush()

            if entry["user_role"] == UserRole.user:
                LeaveService(db).ensure_balances_for_user(user)
                if not db.query(SalaryStructure).filter(SalaryStructure.user_id == user.id).first():
                    db.add(
                        SalaryStructure(
                            user_id=user.id,
                            effective_from=date.today(),
                            basic_salary=Decimal("25000"),
                            hra=Decimal("10000"),
                            da=Decimal("5000"),
                            conveyance=Decimal("1600"),
                            medical_allowance=Decimal("1250"),
                            special_allowance=Decimal("7150"),
                            overtime_rate=Decimal("200"),
                            is_active=True,
                        )
                    )
            print(f"Created {entry['user_role'].value}: {entry['email']}")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_config()
    seed_users()
