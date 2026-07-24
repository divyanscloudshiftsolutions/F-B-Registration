"""Payroll Management: Review → Calculate → Approve → Pay.

Attendance feeds payroll via DayStatusEngine monthly snapshots.
Approved payroll runs are locked against silent attendance edits.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO, StringIO
from uuid import UUID, uuid4

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import (
    Attendance,
    AttendanceDailySummary,
    DayAttendanceStatus,
    Holiday,
    HolidayWorkCompensation,
    LeaveRequest,
    LeaveStatus,
    PayrollAdjustment,
    PayrollComponent,
    PayrollComponentType,
    PayrollRecord,
    PayrollRun,
    PayrollRunStatus,
    PayrollStatus,
    RecordStatus,
    SalaryCalcBasis,
    SalaryStructure,
    User,
    UserRole,
    WeekOffPolicy,
)
from app.services.day_status_engine import DayStatusEngine
from app.services.media_url import resolve_media_url
from app.services.storage_service import save_file
from app.timeutil import to_local_date

Q = Decimal("0.01")
LOCKED_RUN_STATUSES = {PayrollRunStatus.approved, PayrollRunStatus.paid}


def is_attendance_month_locked(db: Session, when: date | datetime) -> bool:
    """True when the payroll run for that calendar month is locked (approved/paid or attendance_locked)."""
    if isinstance(when, datetime):
        when = to_local_date(when) or when.date()
    run = (
        db.query(PayrollRun)
        .filter(PayrollRun.month == when.month, PayrollRun.year == when.year)
        .first()
    )
    if not run:
        return False
    return bool(run.attendance_locked) or run.status in LOCKED_RUN_STATUSES


def assert_attendance_month_writable(db: Session, when: date | datetime) -> None:
    if is_attendance_month_locked(db, when):
        if isinstance(when, datetime):
            when = to_local_date(when) or when.date()
        raise ValueError(
            f"Attendance for {when.month:02d}/{when.year} is locked because payroll is approved/paid. "
            "Reopen payroll before editing attendance."
        )


def premium_extra_factor(compensation: HolidayWorkCompensation | None) -> Decimal:
    """Extra multiplier beyond the normal payable day already included in monthly package.

    normal / ot / comp_off → 0 extra cash (OT uses approval pipeline; comp_off earns leave)
    1.5x → +0.5 × daily_rate
    2x → +1.0 × daily_rate
    """
    if compensation == HolidayWorkCompensation.rate_1_5x:
        return Decimal("0.5")
    if compensation == HolidayWorkCompensation.rate_2x:
        return Decimal("1")
    return Decimal("0")


class PayrollService:
    def __init__(self, db: Session):
        self.db = db

    # ── salary structure ──────────────────────────────────────────────

    def assign_salary_structure(self, user_id: UUID, data: dict) -> SalaryStructure:
        self.db.query(SalaryStructure).filter(
            SalaryStructure.user_id == user_id,
            SalaryStructure.is_active.is_(True),
        ).update({"is_active": False})

        structure = SalaryStructure(
            user_id=user_id,
            effective_from=data.get("effective_from") or date.today(),
            basic_salary=Decimal(str(data["basic_salary"])),
            hra=Decimal(str(data.get("hra", 0))),
            da=Decimal(str(data.get("da", 0))),
            conveyance=Decimal(str(data.get("conveyance", 0))),
            medical_allowance=Decimal(str(data.get("medical_allowance", 0))),
            special_allowance=Decimal(str(data.get("special_allowance", 0))),
            hourly_rate=Decimal(str(data["hourly_rate"])) if data.get("hourly_rate") else None,
            overtime_rate=Decimal(str(data["overtime_rate"])) if data.get("overtime_rate") else None,
            pf_deduction_percent=Decimal(str(data.get("pf_deduction_percent", settings.pf_percentage))),
            pt_deduction_amount=Decimal(str(data.get("pt_deduction_amount", settings.pt_amount))),
            tds_percent=Decimal(str(data.get("tds_percent", 0))),
            is_active=True,
        )
        self.db.add(structure)
        self.db.commit()
        self.db.refresh(structure)
        return structure

    # ── runs ──────────────────────────────────────────────────────────

    def get_or_create_run(
        self,
        month: int,
        year: int,
        salary_calc_basis: SalaryCalcBasis | None = None,
    ) -> PayrollRun:
        run = (
            self.db.query(PayrollRun)
            .filter(PayrollRun.month == month, PayrollRun.year == year)
            .first()
        )
        if run:
            return run
        run = PayrollRun(
            id=uuid4(),
            month=month,
            year=year,
            status=PayrollRunStatus.draft,
            salary_calc_basis=salary_calc_basis or SalaryCalcBasis.fixed_30,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def list_runs(self, limit: int = 24) -> list[PayrollRun]:
        return (
            self.db.query(PayrollRun)
            .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
            .limit(limit)
            .all()
        )

    def update_run_settings(self, run_id: UUID, salary_calc_basis: SalaryCalcBasis) -> PayrollRun:
        run = self._get_run(run_id)
        if run.status in LOCKED_RUN_STATUSES:
            raise ValueError("Cannot change settings on an approved/paid payroll run")
        run.salary_calc_basis = salary_calc_basis
        self.db.commit()
        self.db.refresh(run)
        return run

    # ── pre-check ─────────────────────────────────────────────────────

    def precheck(self, month: int, year: int) -> dict:
        from app.models import OvertimeApproval, OvertimeApprovalStatus

        employees = self._active_employees(month, year)
        with_salary = 0
        missing_salary: list[dict] = []
        for emp in employees:
            structure = self._active_structure(emp.id)
            if structure:
                with_salary += 1
            else:
                missing_salary.append(
                    {"userId": str(emp.id), "userName": emp.user_name, "employeeCode": emp.employee_code}
                )

        pending_leaves = (
            self.db.query(LeaveRequest)
            .filter(LeaveRequest.status == LeaveStatus.pending)
            .count()
        )
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        pending_attendance = (
            self.db.query(Attendance)
            .filter(
                Attendance.status == RecordStatus.pending,
                Attendance.timestamp >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
                Attendance.timestamp
                <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc),
            )
            .count()
        )
        pending_ot = (
            self.db.query(OvertimeApproval)
            .filter(
                OvertimeApproval.work_date >= start,
                OvertimeApproval.work_date <= end,
                OvertimeApproval.status == OvertimeApprovalStatus.pending,
            )
            .count()
        )

        checks = [
            {"level": "ok", "message": f"{len(employees)} payroll-eligible employees found"},
            {
                "level": "ok" if with_salary == len(employees) else "warn",
                "message": f"{with_salary} employees have salary configured",
            },
            {
                "level": "ok",
                "message": f"Attendance period {start.isoformat()} → {end.isoformat()}",
            },
            {
                "level": "ok" if pending_leaves == 0 else "warn",
                "message": (
                    "No pending leave requests"
                    if pending_leaves == 0
                    else f"{pending_leaves} pending leave request(s)"
                ),
            },
            {
                "level": "ok" if pending_attendance == 0 else "warn",
                "message": (
                    "No pending attendance approvals"
                    if pending_attendance == 0
                    else f"{pending_attendance} pending attendance record(s) (excluded from day status until approved)"
                ),
            },
            {
                "level": "ok" if pending_ot == 0 else "warn",
                "message": (
                    "No pending OT approvals"
                    if pending_ot == 0
                    else f"{pending_ot} pending OT approval(s) — unapproved OT will not be paid"
                ),
            },
        ]
        if missing_salary:
            checks.append(
                {
                    "level": "warn",
                    "message": f"{len(missing_salary)} employees missing salary configuration",
                }
            )

        return {
            "month": month,
            "year": year,
            "employeeCount": len(employees),
            "withSalary": with_salary,
            "missingSalary": missing_salary,
            "pendingLeaves": pending_leaves,
            "pendingAttendance": pending_attendance,
            "pendingOt": pending_ot,
            "canCalculate": with_salary > 0,
            "checks": checks,
        }

    # ── preview / dashboard ───────────────────────────────────────────

    def dashboard(self, month: int, year: int) -> dict:
        run = self.get_or_create_run(month, year)
        employees = self._serialize_employees(run, include_preview=True)
        history = [self._run_to_dict(r, include_employees=False) for r in self.list_runs()]
        precheck = self.precheck(month, year)

        gross = float(run.gross_amount or 0)
        deductions = float(run.total_deductions or 0)
        net = float(run.net_amount or 0)
        if run.status == PayrollRunStatus.draft and employees:
            # Preview totals from eligible salary packages when not yet calculated
            preview_gross = sum(e.get("grossEarnings") or e.get("monthlySalary") or 0 for e in employees)
            preview_ded = sum(e.get("totalDeductions") or 0 for e in employees)
            preview_net = sum(e.get("netPay") or e.get("monthlySalary") or 0 for e in employees)
            if not gross:
                gross, deductions, net = preview_gross, preview_ded, preview_net

        return {
            "run": self._run_to_dict(run, include_employees=False),
            "kpis": {
                "employeeCount": len(employees) or precheck["employeeCount"],
                "grossPayroll": gross,
                "totalDeductions": deductions,
                "netPayable": net,
                "status": run.status.value,
            },
            "cycle": self._cycle_steps(run),
            "precheck": precheck,
            "employees": employees,
            "history": history,
        }

    # ── calculate ─────────────────────────────────────────────────────

    def calculate_run(
        self,
        run_id: UUID,
        admin_id: UUID | None = None,
        eligible_only: bool = True,
    ) -> PayrollRun:
        run = self._get_run(run_id)
        if run.status in LOCKED_RUN_STATUSES:
            raise ValueError("Payroll is locked. Reopen before recalculating.")

        engine = DayStatusEngine(self.db)
        engine.regenerate_month(run.month, run.year)
        run.attendance_locked = True

        employees = self._active_employees(run.month, run.year)
        calculated: list[PayrollRecord] = []

        for emp in employees:
            structure = self._active_structure(emp.id)
            record = self._get_or_create_record(emp.id, run)
            record.payroll_run_id = run.id

            if not structure:
                if eligible_only:
                    record.status = PayrollStatus.missing_salary
                    record.flags = ["missing_salary"]
                    continue
                continue

            summary = engine.monthly_summary(emp.id, run.month, run.year)
            self._apply_calculation(record, emp, structure, summary, run.salary_calc_basis)
            record.status = PayrollStatus.review if self._needs_review(record) else PayrollStatus.ready
            calculated.append(record)

        self._refresh_run_totals(run)
        run.status = PayrollRunStatus.calculated
        run.calculated_at = datetime.now(timezone.utc)
        run.calculated_by = admin_id
        self.db.commit()
        self.db.refresh(run)
        return run

    def recalculate_employee(self, record_id: UUID, admin_id: UUID | None = None) -> PayrollRecord:
        record = self._get_record(record_id)
        run = record.payroll_run or self.get_or_create_run(record.month, record.year)
        if run.status in LOCKED_RUN_STATUSES:
            raise ValueError("Payroll is locked. Reopen before recalculating.")

        structure = self._active_structure(record.user_id)
        if not structure:
            raise ValueError("Employee has no salary structure")

        engine = DayStatusEngine(self.db)
        engine.regenerate_month(record.month, record.year, user_id=record.user_id)
        summary = engine.monthly_summary(record.user_id, record.month, record.year)
        emp = self.db.query(User).filter(User.id == record.user_id).first()
        self._apply_calculation(record, emp, structure, summary, run.salary_calc_basis)
        record.status = PayrollStatus.review if self._needs_review(record) else PayrollStatus.ready
        record.payroll_run_id = run.id
        self._refresh_run_totals(run)
        if run.status == PayrollRunStatus.draft:
            run.status = PayrollRunStatus.calculated
            run.calculated_at = datetime.now(timezone.utc)
            run.calculated_by = admin_id
        self.db.commit()
        self.db.refresh(record)
        return record

    # ── adjustments ───────────────────────────────────────────────────

    def add_adjustment(
        self,
        record_id: UUID,
        *,
        component_type: str,
        component_code: str,
        label: str,
        amount: float,
        reason: str,
        created_by: UUID | None,
    ) -> PayrollAdjustment:
        record = self._get_record(record_id)
        run = record.payroll_run
        if run and run.status in LOCKED_RUN_STATUSES:
            raise ValueError("Cannot adjust an approved/paid payroll")

        adj = PayrollAdjustment(
            id=uuid4(),
            payroll_record_id=record.id,
            component_type=PayrollComponentType(component_type),
            component_code=component_code.upper(),
            label=label,
            amount=Decimal(str(amount)).quantize(Q),
            reason=reason,
            created_by=created_by,
        )
        self.db.add(adj)
        self.db.flush()

        # Rebuild money from structure + adjustments without wiping attendance snapshot
        structure = self._active_structure(record.user_id)
        if structure:
            engine = DayStatusEngine(self.db)
            summary = engine.monthly_summary(record.user_id, record.month, record.year)
            emp = self.db.query(User).filter(User.id == record.user_id).first()
            basis = run.salary_calc_basis if run else SalaryCalcBasis.fixed_30
            self._apply_calculation(record, emp, structure, summary, basis)

        if run:
            self._refresh_run_totals(run)
        self.db.commit()
        self.db.refresh(adj)
        return adj

    # ── workflow ──────────────────────────────────────────────────────

    def submit_for_review(self, run_id: UUID) -> PayrollRun:
        run = self._get_run(run_id)
        if run.status not in {PayrollRunStatus.calculated, PayrollRunStatus.draft}:
            raise ValueError("Payroll must be calculated before review")
        if run.employee_count == 0:
            raise ValueError("No calculated employees")
        run.status = PayrollRunStatus.under_review
        for rec in self._run_records(run):
            if rec.status in {PayrollStatus.ready, PayrollStatus.calculated, PayrollStatus.processed}:
                rec.status = PayrollStatus.under_review
        self.db.commit()
        self.db.refresh(run)
        return run

    def approve_run(self, run_id: UUID, admin_id: UUID | None = None) -> PayrollRun:
        run = self._get_run(run_id)
        if run.status not in {PayrollRunStatus.calculated, PayrollRunStatus.under_review}:
            raise ValueError("Payroll must be calculated or under review to approve")
        run.status = PayrollRunStatus.approved
        run.approved_at = datetime.now(timezone.utc)
        run.approved_by = admin_id
        run.attendance_locked = True
        for rec in self._run_records(run):
            if rec.status not in {PayrollStatus.missing_salary, PayrollStatus.excluded}:
                rec.status = PayrollStatus.approved
                emp = rec.user or self.db.query(User).filter(User.id == rec.user_id).first()
                structure = self._active_structure(rec.user_id)
                if emp and structure:
                    rec.payslip_url = self._generate_payslip_pdf(emp, rec, structure)
        self.db.commit()
        self.db.refresh(run)
        return run

    def mark_paid(
        self,
        run_id: UUID,
        *,
        payment_date: date | None,
        payment_method: str | None,
        payment_reference: str | None,
        admin_id: UUID | None = None,
    ) -> PayrollRun:
        run = self._get_run(run_id)
        if run.status != PayrollRunStatus.approved:
            raise ValueError("Payroll must be approved before marking paid")
        run.status = PayrollRunStatus.paid
        run.paid_at = datetime.now(timezone.utc)
        run.paid_by = admin_id
        run.payment_date = payment_date or date.today()
        run.payment_method = payment_method or "Bank Transfer"
        run.payment_reference = payment_reference
        for rec in self._run_records(run):
            if rec.status == PayrollStatus.approved:
                rec.status = PayrollStatus.paid
        self.db.commit()
        self.db.refresh(run)
        return run

    def reopen_run(self, run_id: UUID) -> PayrollRun:
        run = self._get_run(run_id)
        if run.status == PayrollRunStatus.paid:
            raise ValueError("Paid payroll cannot be reopened. Create adjustments in the next cycle.")
        if run.status != PayrollRunStatus.approved:
            raise ValueError("Only approved payroll can be reopened")
        run.status = PayrollRunStatus.under_review
        run.approved_at = None
        run.approved_by = None
        run.attendance_locked = False
        for rec in self._run_records(run):
            if rec.status == PayrollStatus.approved:
                rec.status = PayrollStatus.under_review
        self.db.commit()
        self.db.refresh(run)
        return run

    def export_xlsx(self, run_id: UUID) -> bytes:
        from openpyxl import Workbook

        run = self._get_run(run_id)
        records = (
            self.db.query(PayrollRecord)
            .options(joinedload(PayrollRecord.user))
            .filter(PayrollRecord.payroll_run_id == run.id)
            .all()
        )
        wb = Workbook()
        ws = wb.active
        ws.title = f"{run.year}-{run.month:02d}"
        ws.append(
            [
                "Employee",
                "EmployeeCode",
                "Present",
                "PaidLeave",
                "LOP",
                "OTHours",
                "Gross",
                "Deductions",
                "Net",
                "Status",
            ]
        )
        for r in records:
            name = r.user.user_name if r.user else str(r.user_id)
            code = (r.user.employee_code if r.user else "") or ""
            ws.append(
                [
                    name,
                    code,
                    float(r.days_present or 0),
                    float(r.days_leave_paid or 0),
                    float(r.days_absent or 0),
                    float(r.overtime_hours or 0),
                    float(r.total_earnings or 0),
                    float(r.total_deductions or 0),
                    float(r.net_salary or 0),
                    r.status.value,
                ]
            )
        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()

    # ── export / employee slips ───────────────────────────────────────

    def export_csv(self, run_id: UUID) -> str:
        run = self._get_run(run_id)
        records = (
            self.db.query(PayrollRecord)
            .options(joinedload(PayrollRecord.user))
            .filter(PayrollRecord.payroll_run_id == run.id)
            .all()
        )
        buf = StringIO()
        buf.write(
            "Employee,EmployeeCode,Present,PaidLeave,LOP,OTHours,Gross,Deductions,Net,Status\n"
        )
        for r in records:
            name = r.user.user_name if r.user else str(r.user_id)
            code = (r.user.employee_code if r.user else "") or ""
            buf.write(
                f'"{name}","{code}",{r.days_present},{r.days_leave_paid},{r.days_absent},'
                f"{r.overtime_hours},{r.total_earnings},{r.total_deductions},{r.net_salary},{r.status.value}\n"
            )
        return buf.getvalue()

    def employee_payslips(self, user_id: UUID) -> list[dict]:
        records = (
            self.db.query(PayrollRecord)
            .filter(
                PayrollRecord.user_id == user_id,
                PayrollRecord.status.in_(
                    [PayrollStatus.approved, PayrollStatus.paid, PayrollStatus.calculated, PayrollStatus.ready]
                ),
            )
            .order_by(PayrollRecord.year.desc(), PayrollRecord.month.desc())
            .all()
        )
        return [self._record_to_dict(r, detail=False) for r in records]

    def get_employee_detail(self, record_id: UUID) -> dict:
        record = (
            self.db.query(PayrollRecord)
            .options(
                joinedload(PayrollRecord.user).joinedload(User.department),
                joinedload(PayrollRecord.components),
                joinedload(PayrollRecord.adjustments),
            )
            .filter(PayrollRecord.id == record_id)
            .first()
        )
        if not record:
            raise ValueError("Payroll record not found")
        return self._record_to_dict(record, detail=True)

    # ── legacy entrypoint ─────────────────────────────────────────────

    def process_monthly(self, month: int, year: int, admin_id: UUID | None = None) -> list[PayrollRecord]:
        run = self.get_or_create_run(month, year)
        self.calculate_run(run.id, admin_id=admin_id)
        self.submit_for_review(run.id)
        return self._run_records(run)

    # ── internals ─────────────────────────────────────────────────────

    def _get_run(self, run_id: UUID) -> PayrollRun:
        run = self.db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
        if not run:
            raise ValueError("Payroll run not found")
        return run

    def _get_record(self, record_id: UUID) -> PayrollRecord:
        record = self.db.query(PayrollRecord).filter(PayrollRecord.id == record_id).first()
        if not record:
            raise ValueError("Payroll record not found")
        return record

    def _run_records(self, run: PayrollRun) -> list[PayrollRecord]:
        return (
            self.db.query(PayrollRecord)
            .options(joinedload(PayrollRecord.user))
            .filter(PayrollRecord.payroll_run_id == run.id)
            .all()
        )

    def _active_employees(self, month: int | None = None, year: int | None = None) -> list[User]:
        q = (
            self.db.query(User)
            .options(joinedload(User.department))
            .filter(User.user_role == UserRole.user, User.status == "Active")
            .order_by(User.user_name)
        )
        employees = q.all()
        if month is None or year is None:
            return employees
        period_start = date(year, month, 1)
        period_end = date(year, month, monthrange(year, month)[1])
        eligible = []
        for emp in employees:
            if emp.joining_date and emp.joining_date > period_end:
                continue
            if emp.termination_date and emp.termination_date < period_start:
                continue
            eligible.append(emp)
        return eligible

    def _active_structure(self, user_id: UUID) -> SalaryStructure | None:
        return (
            self.db.query(SalaryStructure)
            .filter(SalaryStructure.user_id == user_id, SalaryStructure.is_active.is_(True))
            .first()
        )

    def _get_or_create_record(self, user_id: UUID, run: PayrollRun) -> PayrollRecord:
        record = (
            self.db.query(PayrollRecord)
            .filter(
                PayrollRecord.user_id == user_id,
                PayrollRecord.month == run.month,
                PayrollRecord.year == run.year,
            )
            .first()
        )
        if record:
            return record
        record = PayrollRecord(
            id=uuid4(),
            user_id=user_id,
            month=run.month,
            year=run.year,
            payroll_run_id=run.id,
            status=PayrollStatus.draft,
        )
        self.db.add(record)
        self.db.flush()
        return record

    def _divisor(self, basis: SalaryCalcBasis, summary: dict) -> Decimal:
        if basis == SalaryCalcBasis.calendar_days:
            return Decimal(str(summary["calendarDays"]))
        if basis == SalaryCalcBasis.working_days:
            return Decimal(str(max(summary["workingDays"], 1)))
        if basis == SalaryCalcBasis.attendance_hours:
            hours = Decimal(str(summary["expectedMinutes"])) / Decimal("60")
            return hours if hours > 0 else Decimal("1")
        return Decimal("30")

    def _worked_day_premium(
        self,
        user_id: UUID,
        month: int,
        year: int,
        daily_rate: Decimal,
        emp: User | None,
    ) -> Decimal:
        """Sum cash premiums for WORKED_HOLIDAY / WORKED_WEEK_OFF using configured compensation."""
        from calendar import monthrange

        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        rows = (
            self.db.query(AttendanceDailySummary)
            .filter(
                AttendanceDailySummary.user_id == user_id,
                AttendanceDailySummary.work_date >= start,
                AttendanceDailySummary.work_date <= end,
                AttendanceDailySummary.attendance_status.in_(
                    [DayAttendanceStatus.worked_holiday, DayAttendanceStatus.worked_week_off]
                ),
            )
            .all()
        )
        if not rows:
            return Decimal("0")

        total = Decimal("0")
        for row in rows:
            fraction = Decimal(str(row.present_fraction or 0))
            if fraction <= 0:
                continue
            compensation = HolidayWorkCompensation.comp_off
            if row.attendance_status == DayAttendanceStatus.worked_holiday:
                holiday = None
                if row.holiday_id:
                    holiday = self.db.query(Holiday).filter(Holiday.id == row.holiday_id).first()
                if holiday:
                    compensation = holiday.work_compensation
            else:
                # Worked week-off: use employee's week-off policy compensation
                policy = None
                if emp and emp.weekoff_policy_id:
                    policy = (
                        self.db.query(WeekOffPolicy)
                        .filter(WeekOffPolicy.id == emp.weekoff_policy_id)
                        .first()
                    )
                if not policy:
                    policy = (
                        self.db.query(WeekOffPolicy)
                        .filter(WeekOffPolicy.is_default.is_(True), WeekOffPolicy.is_active.is_(True))
                        .first()
                    )
                if policy:
                    compensation = policy.work_compensation
            total += daily_rate * premium_extra_factor(compensation) * fraction
        return total

    def _monthly_package(self, structure: SalaryStructure) -> Decimal:
        return (
            structure.basic_salary
            + structure.hra
            + structure.da
            + structure.conveyance
            + structure.medical_allowance
            + structure.special_allowance
        )

    def _apply_calculation(
        self,
        record: PayrollRecord,
        emp: User | None,
        structure: SalaryStructure,
        summary: dict,
        basis: SalaryCalcBasis,
    ) -> None:
        from app.services.overtime_service import OvertimeService

        package = self._monthly_package(structure)
        divisor = self._divisor(basis, summary)
        lop_days = Decimal(str(summary["lopDays"]))

        # Employment period proration (joining / termination)
        month, year = record.month, record.year
        period_start = date(year, month, 1)
        period_end = date(year, month, monthrange(year, month)[1])
        eligible_start = period_start
        eligible_end = period_end
        if emp and emp.joining_date and emp.joining_date > eligible_start:
            eligible_start = emp.joining_date
        if emp and emp.termination_date and emp.termination_date < eligible_end:
            eligible_end = emp.termination_date
        calendar_days = Decimal(str(summary["calendarDays"] or monthrange(year, month)[1]))
        if eligible_end < eligible_start:
            # Not employed any day this month
            package = Decimal("0")
            period_factor = Decimal("0")
        else:
            eligible_days = Decimal(str((eligible_end - eligible_start).days + 1))
            period_factor = (eligible_days / calendar_days) if calendar_days > 0 else Decimal("1")
            package = (package * period_factor).quantize(Q)

        # Approved OT only (falls back to 0 if none approved)
        approved_ot_minutes = OvertimeService(self.db).approved_minutes_for_month(
            record.user_id, month, year
        )
        ot_hours = (Decimal(str(approved_ot_minutes)) / Decimal("60")).quantize(Q)

        overtime_pay = Decimal("0")
        if structure.overtime_rate and ot_hours > 0:
            overtime_pay = (structure.overtime_rate * ot_hours).quantize(Q)

        # Holiday / week-off work premium from existing compensation settings.
        # Package already pays the normal day (no LOP). Premium is EXTRA only.
        #   normal / ot / comp_off → 0 cash premium (OT via approvals; comp_off via engine)
        #   1.5x → +0.5 × daily_rate × present_fraction
        #   2x   → +1.0 × daily_rate × present_fraction
        daily_rate = (package / divisor) if divisor > 0 else Decimal("0")
        premium_pay = self._worked_day_premium(
            record.user_id, month, year, daily_rate, emp
        ).quantize(Q)

        # Manual adjustments
        adjustments = (
            self.db.query(PayrollAdjustment)
            .filter(PayrollAdjustment.payroll_record_id == record.id)
            .all()
        )
        adj_earn = sum(
            (a.amount for a in adjustments if a.component_type == PayrollComponentType.earning),
            Decimal("0"),
        )
        adj_ded = sum(
            (a.amount for a in adjustments if a.component_type == PayrollComponentType.deduction),
            Decimal("0"),
        )

        lop_amount = ((daily_rate) * lop_days).quantize(Q) if divisor > 0 else Decimal("0")

        # Statutory — on prorated package; LOP is explicit deduction
        pf_base = min(
            (structure.basic_salary + structure.da) * period_factor,
            Decimal(str(settings.pf_max_limit)),
        )
        pf_employee = (pf_base * structure.pf_deduction_percent / Decimal("100")).quantize(Q)
        pt_deduction = structure.pt_deduction_amount if period_factor > 0 else Decimal("0")
        annual_income = package * Decimal("12")
        tds_deduction = Decimal("0")
        if annual_income > Decimal("250000") and structure.tds_percent > 0:
            tds_deduction = (package * structure.tds_percent / Decimal("100")).quantize(Q)

        basic = (structure.basic_salary * period_factor).quantize(Q)
        hra = (structure.hra * period_factor).quantize(Q)
        da = (structure.da * period_factor).quantize(Q)
        conveyance = (structure.conveyance * period_factor).quantize(Q)
        medical = (structure.medical_allowance * period_factor).quantize(Q)
        special = (structure.special_allowance * period_factor).quantize(Q)

        gross = (package + overtime_pay + premium_pay + adj_earn).quantize(Q)
        other_deductions = adj_ded.quantize(Q)
        total_deductions = (lop_amount + pf_employee + pt_deduction + tds_deduction + other_deductions).quantize(Q)
        net = (gross - total_deductions).quantize(Q)

        record.salary_structure_id = structure.id
        record.monthly_salary = package.quantize(Q)
        record.calendar_days = int(summary["calendarDays"])
        record.working_days = Decimal(str(summary["workingDays"]))
        record.days_present = Decimal(str(summary["present"]))
        record.days_absent = lop_days
        record.days_leave_paid = Decimal(str(summary["paidLeave"]))
        record.days_leave_unpaid = Decimal(str(summary["unpaidLeave"]))
        record.week_off_days = Decimal(str(summary["weekOffs"]))
        record.holiday_days = Decimal(str(summary["holidays"]))
        record.expected_hours = (Decimal(str(summary["expectedMinutes"])) / Decimal("60")).quantize(Q)
        record.worked_hours = (Decimal(str(summary["workedMinutes"])) / Decimal("60")).quantize(Q)
        record.overtime_hours = ot_hours
        record.basic_pay = basic
        record.hra_amount = hra
        record.da_amount = da
        record.overtime_pay = overtime_pay
        record.other_earnings = (adj_earn + premium_pay).quantize(Q)
        record.other_deductions = other_deductions
        record.total_earnings = gross
        record.pf_employee = pf_employee
        record.pt_deduction = pt_deduction
        record.tds_deduction = tds_deduction
        record.lop_amount = lop_amount
        record.total_deductions = total_deductions
        record.net_salary = net
        record.processed_at = datetime.now(timezone.utc)
        record.flags = self._build_flags(record, summary)

        # Replace system components; keep adjustment rows separate
        self.db.query(PayrollComponent).filter(PayrollComponent.payroll_record_id == record.id).delete()
        components = [
            ("earning", "BASIC", "Basic Salary", basic),
            ("earning", "HRA", "HRA", hra),
            ("earning", "DA", "DA", da),
            ("earning", "CONVEYANCE", "Conveyance", conveyance),
            ("earning", "MEDICAL", "Medical Allowance", medical),
            ("earning", "SPECIAL", "Special Allowance", special),
            ("earning", "OT", "Approved Overtime", overtime_pay),
            ("earning", "HOLIDAY_PREMIUM", "Worked Holiday/Week-Off Premium", premium_pay),
            ("deduction", "LOP", "LOP Deduction", lop_amount),
            ("deduction", "PF", "PF", pf_employee),
            ("deduction", "PT", "Professional Tax", pt_deduction),
            ("deduction", "TDS", "TDS", tds_deduction),
        ]
        for ctype, code, label, amount in components:
            if amount and amount > 0:
                self.db.add(
                    PayrollComponent(
                        id=uuid4(),
                        payroll_record_id=record.id,
                        component_type=PayrollComponentType(ctype),
                        component_code=code,
                        label=label,
                        amount=amount.quantize(Q),
                        calculation_source="system",
                    )
                )
        for adj in adjustments:
            self.db.add(
                PayrollComponent(
                    id=uuid4(),
                    payroll_record_id=record.id,
                    component_type=adj.component_type,
                    component_code=adj.component_code,
                    label=adj.label,
                    amount=adj.amount,
                    calculation_source="manual",
                )
            )

    def _build_flags(self, record: PayrollRecord, summary: dict) -> list:
        flags = []
        if float(summary.get("lopDays") or 0) >= 3:
            flags.append("high_lop")
        if float(summary.get("overtimeMinutes") or 0) > 20 * 60:
            flags.append("high_ot")
        if not record.salary_structure_id:
            flags.append("missing_salary")
        return flags

    def _needs_review(self, record: PayrollRecord) -> bool:
        return bool(record.flags)

    def _refresh_run_totals(self, run: PayrollRun) -> None:
        records = [
            r
            for r in self._run_records(run)
            if r.status not in {PayrollStatus.missing_salary, PayrollStatus.excluded, PayrollStatus.draft}
            or (r.total_earnings and r.total_earnings > 0)
        ]
        eligible = [
            r
            for r in self._run_records(run)
            if r.status not in {PayrollStatus.missing_salary, PayrollStatus.excluded}
            and (r.net_salary is not None)
        ]
        run.employee_count = len(eligible)
        run.gross_amount = sum((r.total_earnings or 0) for r in eligible)
        run.total_deductions = sum((r.total_deductions or 0) for r in eligible)
        run.net_amount = sum((r.net_salary or 0) for r in eligible)

    def _cycle_steps(self, run: PayrollRun) -> list[dict]:
        order = [
            ("attendance_locked", "Attendance Locked", run.attendance_locked or run.status != PayrollRunStatus.draft),
            ("calculated", "Payroll Calculated", run.status in {
                PayrollRunStatus.calculated,
                PayrollRunStatus.under_review,
                PayrollRunStatus.approved,
                PayrollRunStatus.paid,
            }),
            ("under_review", "HR Review", run.status in {
                PayrollRunStatus.under_review,
                PayrollRunStatus.approved,
                PayrollRunStatus.paid,
            } or run.status == PayrollRunStatus.under_review),
            ("approved", "Approved", run.status in {PayrollRunStatus.approved, PayrollRunStatus.paid}),
            ("paid", "Paid", run.status == PayrollRunStatus.paid),
        ]
        current = run.status.value
        if run.status == PayrollRunStatus.draft:
            current = "attendance_locked" if run.attendance_locked else "draft"
        elif run.status == PayrollRunStatus.calculated:
            current = "calculated"
        steps = []
        for key, label, done in order:
            state = "done" if done and key != current else ("current" if key == current or (run.status.value == key) else "pending")
            if run.status == PayrollRunStatus.calculated and key == "calculated":
                state = "current"
            if run.status == PayrollRunStatus.under_review and key == "under_review":
                state = "current"
            if run.status == PayrollRunStatus.approved and key == "approved":
                state = "current"
            if run.status == PayrollRunStatus.paid and key == "paid":
                state = "current"
            if run.status == PayrollRunStatus.draft and key == "attendance_locked" and not run.attendance_locked:
                state = "current"
            steps.append({"key": key, "label": label, "state": state})
        return steps

    def _serialize_employees(self, run: PayrollRun, include_preview: bool = False) -> list[dict]:
        existing = {
            r.user_id: r
            for r in self.db.query(PayrollRecord)
            .options(joinedload(PayrollRecord.user).joinedload(User.department))
            .filter(PayrollRecord.month == run.month, PayrollRecord.year == run.year)
            .all()
        }
        rows: list[dict] = []
        if run.status != PayrollRunStatus.draft or existing:
            for emp in self._active_employees():
                record = existing.get(emp.id)
                if record and record.processed_at:
                    rows.append(self._record_to_dict(record, detail=False))
                    continue
                if include_preview:
                    structure = self._active_structure(emp.id)
                    package = float(self._monthly_package(structure)) if structure else 0
                    rows.append(
                        {
                            "id": str(record.id) if record else None,
                            "userId": str(emp.id),
                            "userName": emp.user_name,
                            "employeeCode": emp.employee_code,
                            "department": emp.department.name if emp.department else None,
                            "monthlySalary": package,
                            "calendarDays": monthrange(run.year, run.month)[1],
                            "presentDays": None,
                            "paidLeaveDays": None,
                            "lopDays": None,
                            "overtimeHours": None,
                            "grossEarnings": package if structure else None,
                            "totalDeductions": None,
                            "netPay": package if structure else None,
                            "status": "missing_salary" if not structure else "draft",
                            "flags": ["missing_salary"] if not structure else [],
                            "payslipUrl": None,
                        }
                    )
            return rows

        # Pure draft with no records — still show roster
        for emp in self._active_employees():
            structure = self._active_structure(emp.id)
            package = float(self._monthly_package(structure)) if structure else 0
            rows.append(
                {
                    "id": None,
                    "userId": str(emp.id),
                    "userName": emp.user_name,
                    "employeeCode": emp.employee_code,
                    "department": emp.department.name if emp.department else None,
                    "monthlySalary": package,
                    "calendarDays": monthrange(run.year, run.month)[1],
                    "presentDays": None,
                    "paidLeaveDays": None,
                    "lopDays": None,
                    "overtimeHours": None,
                    "grossEarnings": package if structure else None,
                    "totalDeductions": None,
                    "netPay": package if structure else None,
                    "status": "missing_salary" if not structure else "draft",
                    "flags": ["missing_salary"] if not structure else [],
                    "payslipUrl": None,
                }
            )
        return rows

    def _run_to_dict(self, run: PayrollRun, include_employees: bool = True) -> dict:
        data = {
            "id": str(run.id),
            "month": run.month,
            "year": run.year,
            "status": run.status.value,
            "salaryCalcBasis": run.salary_calc_basis.value,
            "attendanceLocked": run.attendance_locked,
            "employeeCount": run.employee_count,
            "grossAmount": float(run.gross_amount or 0),
            "totalDeductions": float(run.total_deductions or 0),
            "netAmount": float(run.net_amount or 0),
            "calculatedAt": run.calculated_at.isoformat() if run.calculated_at else None,
            "approvedAt": run.approved_at.isoformat() if run.approved_at else None,
            "paidAt": run.paid_at.isoformat() if run.paid_at else None,
            "paymentDate": run.payment_date.isoformat() if run.payment_date else None,
            "paymentMethod": run.payment_method,
            "paymentReference": run.payment_reference,
            "cycle": self._cycle_steps(run),
        }
        if include_employees:
            data["employees"] = self._serialize_employees(run, include_preview=True)
        return data

    def _record_to_dict(self, record: PayrollRecord, detail: bool = False) -> dict:
        emp = record.user
        data = {
            "id": str(record.id),
            "userId": str(record.user_id),
            "userName": emp.user_name if emp else None,
            "employeeCode": emp.employee_code if emp else None,
            "department": emp.department.name if emp and emp.department else None,
            "employmentType": emp.employment_type if emp else None,
            "month": record.month,
            "year": record.year,
            "monthlySalary": float(record.monthly_salary or 0),
            "calendarDays": record.calendar_days,
            "workingDays": float(record.working_days or 0),
            "presentDays": float(record.days_present or 0),
            "paidLeaveDays": float(record.days_leave_paid or 0),
            "unpaidLeaveDays": float(record.days_leave_unpaid or 0),
            "lopDays": float(record.days_absent or 0),
            "weekOffDays": float(record.week_off_days or 0),
            "holidayDays": float(record.holiday_days or 0),
            "expectedHours": float(record.expected_hours or 0),
            "workedHours": float(record.worked_hours or 0),
            "overtimeHours": float(record.overtime_hours or 0),
            "grossEarnings": float(record.total_earnings or 0),
            "lopDeduction": float(record.lop_amount or 0),
            "totalDeductions": float(record.total_deductions or 0),
            "netPay": float(record.net_salary or 0),
            "status": record.status.value,
            "flags": record.flags or [],
            "payslipUrl": resolve_media_url(record.payslip_url) if record.payslip_url else None,
        }
        if detail:
            data["pan"] = emp.pan_number if emp else None
            data["bankAccount"] = emp.bank_account_number if emp else None
            data["bankIfsc"] = emp.bank_ifsc if emp else None
            data["bankName"] = emp.bank_name if emp else None
            data["earnings"] = [
                {
                    "code": c.component_code,
                    "label": c.label,
                    "amount": float(c.amount),
                    "source": c.calculation_source,
                }
                for c in (record.components or [])
                if c.component_type == PayrollComponentType.earning
            ]
            data["deductions"] = [
                {
                    "code": c.component_code,
                    "label": c.label,
                    "amount": float(c.amount),
                    "source": c.calculation_source,
                }
                for c in (record.components or [])
                if c.component_type == PayrollComponentType.deduction
            ]
            data["adjustments"] = [
                {
                    "id": str(a.id),
                    "type": a.component_type.value,
                    "code": a.component_code,
                    "label": a.label,
                    "amount": float(a.amount),
                    "reason": a.reason,
                    "createdAt": a.created_at.isoformat() if a.created_at else None,
                }
                for a in (record.adjustments or [])
            ]
            data["breakdown"] = {
                "basic": float(record.basic_pay or 0),
                "hra": float(record.hra_amount or 0),
                "da": float(record.da_amount or 0),
                "ot": float(record.overtime_pay or 0),
                "pf": float(record.pf_employee or 0),
                "pt": float(record.pt_deduction or 0),
                "tds": float(record.tds_deduction or 0),
                "lop": float(record.lop_amount or 0),
            }
        return data

    def _generate_payslip_pdf(self, emp: User, payroll: PayrollRecord, structure: SalaryStructure) -> str:
        filename = f"payslips/{payroll.year}/{payroll.month:02d}/{emp.id}.pdf"
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        y = 800
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, "PRESENT SIR")
        y -= 24
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, f"PAYSLIP — {payroll.month:02d}/{payroll.year}")
        y -= 30
        c.setFont("Helvetica", 10)
        lines = [
            f"Employee: {emp.user_name}",
            f"Employee ID: {emp.employee_code or '-'}",
            f"Designation: {emp.designation or '-'}",
            f"Department: {emp.department.name if emp.department else '-'}",
            f"PAN: {emp.pan_number or '-'}   UAN: {emp.uan_number or '-'}   ESI: {emp.esi_number or '-'}",
            f"Bank: {emp.bank_name or '-'} / {emp.bank_account_number or '-'}",
            "",
            "ATTENDANCE",
            f"Working Days: {payroll.working_days}   Present: {payroll.days_present}",
            f"Paid Leave: {payroll.days_leave_paid}   LOP: {payroll.days_absent}   OT: {payroll.overtime_hours}h",
            "",
            "EARNINGS",
            f"Basic: Rs {payroll.basic_pay}   HRA: Rs {payroll.hra_amount}   DA: Rs {payroll.da_amount}",
            f"OT: Rs {payroll.overtime_pay}   Other: Rs {payroll.other_earnings}",
            f"Gross: Rs {payroll.total_earnings}",
            "",
            "DEDUCTIONS",
            f"LOP: Rs {payroll.lop_amount}   PF: Rs {payroll.pf_employee}",
            f"PT: Rs {payroll.pt_deduction}   TDS: Rs {payroll.tds_deduction}",
            f"Other: Rs {payroll.other_deductions}",
            f"Total Deductions: Rs {payroll.total_deductions}",
            "",
            f"NET PAY: Rs {payroll.net_salary}",
        ]
        for line in lines:
            c.drawString(50, y, line)
            y -= 16
            if y < 60:
                c.showPage()
                y = 800
                c.setFont("Helvetica", 10)
        c.save()
        return save_file(filename, buffer.getvalue(), "application/pdf")
