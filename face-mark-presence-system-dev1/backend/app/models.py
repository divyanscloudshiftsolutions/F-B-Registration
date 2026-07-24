import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import BYTEA, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class AttendanceType(str, enum.Enum):
    check_in = "check-in"
    check_out = "check-out"
    week_off = "week-off"


class AttendanceMethod(str, enum.Enum):
    face = "face"
    manual = "manual"
    geolocation = "geolocation"


class RecordStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class PayrollStatus(str, enum.Enum):
    """Employee payroll row status (legacy + V1)."""

    draft = "draft"
    processed = "processed"  # legacy alias of calculated
    calculated = "calculated"
    under_review = "under_review"
    ready = "ready"
    review = "review"
    missing_salary = "missing_salary"
    approved = "approved"
    paid = "paid"
    cancelled = "cancelled"
    excluded = "excluded"


class PayrollRunStatus(str, enum.Enum):
    draft = "draft"
    calculated = "calculated"
    under_review = "under_review"
    approved = "approved"
    paid = "paid"
    cancelled = "cancelled"


class SalaryCalcBasis(str, enum.Enum):
    calendar_days = "calendar_days"
    working_days = "working_days"
    fixed_30 = "fixed_30"
    attendance_hours = "attendance_hours"


class PayrollComponentType(str, enum.Enum):
    earning = "earning"
    deduction = "deduction"


class RosterStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class HolidayType(str, enum.Enum):
    public = "public"
    company = "company"
    optional = "optional"


class HolidayAppliesTo(str, enum.Enum):
    all = "all"
    department = "department"
    employment_type = "employment_type"


class HolidayWorkCompensation(str, enum.Enum):
    normal = "normal"
    ot = "ot"
    rate_1_5x = "1.5x"
    rate_2x = "2x"
    comp_off = "comp_off"


class WeekOffPolicyType(str, enum.Enum):
    fixed = "fixed"
    rotational = "rotational"


class LeaveDuration(str, enum.Enum):
    full_day = "full_day"
    first_half = "first_half"
    second_half = "second_half"


class DayAttendanceStatus(str, enum.Enum):
    present = "PRESENT"
    absent = "ABSENT"
    paid_leave = "PAID_LEAVE"
    unpaid_leave = "UNPAID_LEAVE"
    holiday = "HOLIDAY"
    worked_holiday = "WORKED_HOLIDAY"
    week_off = "WEEK_OFF"
    worked_week_off = "WORKED_WEEK_OFF"
    half_present_half_paid_leave = "HALF_PRESENT_HALF_PAID_LEAVE"
    half_present_half_lop = "HALF_PRESENT_HALF_LOP"
    late = "LATE"
    half_day = "HALF_DAY"
    early_departure = "EARLY_DEPARTURE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=UserRole.user,
        nullable=False,
    )
    user_image = mapped_column(Text, nullable=True)
    phone = mapped_column(String(20), nullable=True)
    employee_code = mapped_column(String(50), unique=True, nullable=True)
    department_id = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    designation = mapped_column(String(100), nullable=True)
    joining_date = mapped_column(Date, nullable=True)
    termination_date = mapped_column(Date, nullable=True)
    employment_type = mapped_column(String(30), default="Full-time", nullable=True)
    status = mapped_column(String(20), default="Active", nullable=True)
    aadhaar_number = mapped_column(String(12), nullable=True)
    pan_number = mapped_column(String(10), nullable=True)
    uan_number = mapped_column(String(20), nullable=True)
    esi_number = mapped_column(String(20), nullable=True)
    bank_account_number = mapped_column(String(30), nullable=True)
    bank_ifsc = mapped_column(String(11), nullable=True)
    bank_name = mapped_column(String(100), nullable=True)
    documents_metadata = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    attendance_records: Mapped[list["Attendance"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    weekoff_requests: Mapped[list["WeekOffRequest"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    face_embeddings: Mapped[list["FaceEmbedding"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ensemble_embeddings: Mapped[list["EmployeeEnsembleEmbedding"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    leave_requests: Mapped[list["LeaveRequest"]] = relationship(back_populates="user", foreign_keys="LeaveRequest.user_id")
    leave_balances: Mapped[list["LeaveBalance"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    salary_structures: Mapped[list["SalaryStructure"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payroll_records: Mapped[list["PayrollRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    roster_assignments: Mapped[list["RosterAssignment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    weekoff_policy_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("weekoff_policies.id", ondelete="SET NULL"), nullable=True
    )
    department: Mapped["Department"] = relationship(back_populates="employees")
    weekoff_policy: Mapped["WeekOffPolicy | None"] = relationship(back_populates="employees")
    daily_summaries: Mapped[list["AttendanceDailySummary"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    comp_off_balances: Mapped[list["CompOffBalance"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    description = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employees: Mapped[list["User"]] = relationship(back_populates="department")


class EmploymentType(Base):
    __tablename__ = "employment_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    attendance_policy: Mapped["AttendancePolicy"] = relationship(
        back_populates="employment_type", uselist=False
    )


class DocumentType(Base):
    __tablename__ = "document_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AttendancePolicy(Base):
    __tablename__ = "attendance_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employment_type_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("employment_types.id", ondelete="CASCADE"), unique=True, nullable=True
    )
    shift_start_time: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    shift_end_time: Mapped[str] = mapped_column(String(5), default="18:00", nullable=False)
    late_grace_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    half_day_hours: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("4.0"), nullable=False)
    full_day_hours: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("8.0"), nullable=False)
    overtime_after_hours: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("8.0"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employment_type: Mapped["EmploymentType"] = relationship(back_populates="attendance_policy")


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    embedding_vector: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    reference_image_url: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_version: Mapped[str] = mapped_column(String(20), default="opencv_v1")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    image_quality_score = mapped_column(Numeric(4, 2), nullable=True)
    face_angle = mapped_column(String(20), nullable=True)
    expression = mapped_column(String(20), nullable=True)
    metadata_json = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="face_embeddings")


class EmployeeEnsembleEmbedding(Base):
    __tablename__ = "employee_ensemble_embeddings"
    __table_args__ = (UniqueConstraint("user_id", "embedding_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ensemble_vector: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    embedding_count: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding_version: Mapped[str] = mapped_column(String(20), default="opencv_v1")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="ensemble_embeddings")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    type: Mapped[AttendanceType] = mapped_column(
        Enum(AttendanceType, values_callable=lambda x: [e.value for e in x], native_enum=False),
        nullable=False,
    )
    method: Mapped[AttendanceMethod] = mapped_column(
        Enum(AttendanceMethod, values_callable=lambda x: [e.value for e in x], native_enum=False),
        nullable=False,
    )
    status: Mapped[RecordStatus] = mapped_column(
        Enum(RecordStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=RecordStatus.pending,
        nullable=False,
    )
    location = mapped_column(JSONB, nullable=True)
    note = mapped_column(Text, nullable=True)
    image_url = mapped_column(Text, nullable=True)
    face_confidence = mapped_column(Numeric(5, 4), nullable=True)
    work_hours = mapped_column(Numeric(5, 2), nullable=True)
    day_status = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="attendance_records")


class WeekOffRequest(Base):
    __tablename__ = "weekoff_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RecordStatus] = mapped_column(
        Enum(RecordStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=RecordStatus.pending,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="weekoff_requests")


class LeaveType(Base):
    __tablename__ = "leave_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    max_days_per_year: Mapped[int] = mapped_column(Integer, default=12)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True)
    carry_forward: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_half_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_consecutive_days = mapped_column(Integer, nullable=True)
    document_after_days = mapped_column(Integer, nullable=True)
    is_comp_off: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    leave_requests: Mapped[list["LeaveRequest"]] = relationship(back_populates="leave_type")
    balances: Mapped[list["LeaveBalance"]] = relationship(back_populates="leave_type")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_days: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    duration: Mapped[LeaveDuration] = mapped_column(
        Enum(LeaveDuration, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=LeaveDuration.full_day,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_url = mapped_column(Text, nullable=True)
    status: Mapped[LeaveStatus] = mapped_column(
        Enum(LeaveStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=LeaveStatus.pending,
        nullable=False,
    )
    approved_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejection_reason = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="leave_requests", foreign_keys=[user_id])
    leave_type: Mapped["LeaveType"] = relationship(back_populates="leave_requests")


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (UniqueConstraint("user_id", "leave_type_id", "year"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id"), index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_days: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    used_days: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    pending_days: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)

    user: Mapped["User"] = relationship(back_populates="leave_balances")
    leave_type: Mapped["LeaveType"] = relationship(back_populates="balances")


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    basic_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    hra: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    da: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    conveyance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    medical_allowance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    special_allowance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    hourly_rate = mapped_column(Numeric(8, 2), nullable=True)
    overtime_rate = mapped_column(Numeric(8, 2), nullable=True)
    pf_deduction_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=12)
    pt_deduction_amount: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=200)
    tds_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="salary_structures")


class PayrollRun(Base):
    """Monthly payroll cycle: Draft → Calculated → Review → Approved → Paid."""

    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("month", "year"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PayrollRunStatus] = mapped_column(
        Enum(PayrollRunStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=PayrollRunStatus.draft,
        nullable=False,
    )
    salary_calc_basis: Mapped[SalaryCalcBasis] = mapped_column(
        Enum(SalaryCalcBasis, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=SalaryCalcBasis.fixed_30,
        nullable=False,
    )
    attendance_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    employee_count: Mapped[int] = mapped_column(Integer, default=0)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    calculated_at = mapped_column(DateTime(timezone=True), nullable=True)
    calculated_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    paid_at = mapped_column(DateTime(timezone=True), nullable=True)
    paid_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payment_date = mapped_column(Date, nullable=True)
    payment_method = mapped_column(String(50), nullable=True)
    payment_reference = mapped_column(String(120), nullable=True)
    notes = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employees: Mapped[list["PayrollRecord"]] = relationship(back_populates="payroll_run")


class PayrollRecord(Base):
    """Per-employee payroll line for a month (also linked to a PayrollRun)."""

    __tablename__ = "payroll_records"
    __table_args__ = (UniqueConstraint("user_id", "month", "year"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    salary_structure_id = mapped_column(UUID(as_uuid=True), ForeignKey("salary_structures.id"), nullable=True)
    payroll_run_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    calendar_days: Mapped[int] = mapped_column(Integer, default=0)
    working_days: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    days_present: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    days_absent: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    days_leave_paid: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    days_leave_unpaid: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    week_off_days: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    holiday_days: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)
    expected_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    worked_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    overtime_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    basic_pay: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    hra_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    da_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    overtime_pay: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_earnings: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    pf_employee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    pt_deduction: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tds_deduction: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    lop_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    other_deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    other_earnings: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[PayrollStatus] = mapped_column(
        Enum(PayrollStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=PayrollStatus.draft,
        nullable=False,
    )
    flags = mapped_column(JSONB, default=list)
    payslip_url = mapped_column(Text, nullable=True)
    processed_at = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="payroll_records")
    payroll_run: Mapped["PayrollRun | None"] = relationship(back_populates="employees")
    components: Mapped[list["PayrollComponent"]] = relationship(
        back_populates="payroll_record", cascade="all, delete-orphan"
    )
    adjustments: Mapped[list["PayrollAdjustment"]] = relationship(
        back_populates="payroll_record", cascade="all, delete-orphan"
    )


class PayrollComponent(Base):
    __tablename__ = "payroll_components"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_records.id", ondelete="CASCADE"), index=True
    )
    component_type: Mapped[PayrollComponentType] = mapped_column(
        Enum(PayrollComponentType, values_callable=lambda x: [e.value for e in x], native_enum=False),
        nullable=False,
    )
    component_code: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    calculation_source: Mapped[str] = mapped_column(String(40), default="system")

    payroll_record: Mapped["PayrollRecord"] = relationship(back_populates="components")


class PayrollAdjustment(Base):
    __tablename__ = "payroll_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_records.id", ondelete="CASCADE"), index=True
    )
    component_type: Mapped[PayrollComponentType] = mapped_column(
        Enum(PayrollComponentType, values_callable=lambda x: [e.value for e in x], native_enum=False),
        nullable=False,
    )
    component_code: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payroll_record: Mapped["PayrollRecord"] = relationship(back_populates="adjustments")


class ShiftTemplate(Base):
    """Reusable shift definitions used in weekly rosters."""

    __tablename__ = "shift_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")
    end_time: Mapped[str] = mapped_column(String(5), nullable=False, default="18:00")
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#3b82f6")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    assignments: Mapped[list["RosterAssignment"]] = relationship(back_populates="shift")


class WeeklyRoster(Base):
    """One roster document per calendar week (Monday–Sunday)."""

    __tablename__ = "weekly_rosters"
    __table_args__ = (UniqueConstraint("week_start", name="uq_weekly_rosters_week_start"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[RosterStatus] = mapped_column(
        Enum(RosterStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=RosterStatus.draft,
        nullable=False,
    )
    notes = mapped_column(Text, nullable=True)
    created_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    published_at = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    assignments: Mapped[list["RosterAssignment"]] = relationship(
        back_populates="roster", cascade="all, delete-orphan"
    )


class RosterAssignment(Base):
    """Per-employee, per-day shift assignment within a weekly roster."""

    __tablename__ = "roster_assignments"
    __table_args__ = (UniqueConstraint("roster_id", "user_id", "work_date", name="uq_roster_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    roster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weekly_rosters.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    shift_id = mapped_column(UUID(as_uuid=True), ForeignKey("shift_templates.id", ondelete="SET NULL"), nullable=True)
    is_week_off: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    roster: Mapped["WeeklyRoster"] = relationship(back_populates="assignments")
    user: Mapped["User"] = relationship(back_populates="roster_assignments")
    shift: Mapped["ShiftTemplate | None"] = relationship(back_populates="assignments")

class Holiday(Base):
    __tablename__ = 'holidays'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    holiday_type: Mapped[HolidayType] = mapped_column(
        Enum(HolidayType, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=HolidayType.public,
        nullable=False,
    )
    applies_to: Mapped[HolidayAppliesTo] = mapped_column(
        Enum(HolidayAppliesTo, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=HolidayAppliesTo.all,
        nullable=False,
    )
    department_id = mapped_column(UUID(as_uuid=True), ForeignKey('departments.id', ondelete='SET NULL'), nullable=True)
    employment_type = mapped_column(String(50), nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    work_compensation: Mapped[HolidayWorkCompensation] = mapped_column(
        Enum(HolidayWorkCompensation, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=HolidayWorkCompensation.comp_off,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WeekOffPolicy(Base):
    __tablename__ = 'weekoff_policies'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    policy_type: Mapped[WeekOffPolicyType] = mapped_column(
        Enum(WeekOffPolicyType, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=WeekOffPolicyType.fixed,
        nullable=False,
    )
    week_off_days = mapped_column(JSONB, default=list)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    work_compensation: Mapped[HolidayWorkCompensation] = mapped_column(
        Enum(HolidayWorkCompensation, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=HolidayWorkCompensation.comp_off,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employees: Mapped[list['User']] = relationship(back_populates='weekoff_policy')


class CompOffBalance(Base):
    __tablename__ = 'comp_off_balances'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False
    )
    earned_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(4, 1), default=1, nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default='worked_week_off')
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='available')
    used_leave_request_id = mapped_column(UUID(as_uuid=True), ForeignKey('leave_requests.id'), nullable=True)
    notes = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped['User'] = relationship(back_populates='comp_off_balances')


class AttendanceDailySummary(Base):
    __tablename__ = 'attendance_daily_summaries'
    __table_args__ = (UniqueConstraint('user_id', 'work_date', name='uq_daily_summary_user_date'),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_working_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    attendance_status: Mapped[DayAttendanceStatus] = mapped_column(
        Enum(DayAttendanceStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        nullable=False,
    )
    expected_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    worked_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    present_fraction: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    paid_leave_fraction: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    unpaid_leave_fraction: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    payable_day_fraction: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    lop_day_fraction: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    holiday_id = mapped_column(UUID(as_uuid=True), ForeignKey('holidays.id', ondelete='SET NULL'), nullable=True)
    is_week_off: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    leave_request_id = mapped_column(UUID(as_uuid=True), ForeignKey('leave_requests.id', ondelete='SET NULL'), nullable=True)
    leave_type_id = mapped_column(UUID(as_uuid=True), ForeignKey('leave_types.id', ondelete='SET NULL'), nullable=True)
    check_in_at = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_at = mapped_column(DateTime(timezone=True), nullable=True)
    notes = mapped_column(Text, nullable=True)
    calculation_version: Mapped[str] = mapped_column(String(20), default='v1', nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped['User'] = relationship(back_populates='daily_summaries')


class OvertimeApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class OvertimeApproval(Base):
    """Admin-approved OT minutes used by payroll (not raw DayStatus OT)."""

    __tablename__ = "overtime_approvals"
    __table_args__ = (UniqueConstraint("user_id", "work_date", name="uq_ot_approval_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    calculated_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    approved_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[OvertimeApprovalStatus] = mapped_column(
        Enum(OvertimeApprovalStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=OvertimeApprovalStatus.pending,
        nullable=False,
    )
    notes = mapped_column(Text, nullable=True)
    reviewed_by = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
