from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import SalaryCalcBasis, SalaryStructure, User, UserRole
from app.services.media_url import resolve_media_url
from app.services.payroll_service import PayrollService

router = APIRouter(prefix="/payroll", tags=["payroll"])


class SalaryStructureRequest(BaseModel):
    user_id: str
    basic_salary: float
    hra: float = 0
    da: float = 0
    conveyance: float = 0
    medical_allowance: float = 0
    special_allowance: float = 0
    overtime_rate: float | None = None
    effective_from: date | None = None


class ProcessPayrollRequest(BaseModel):
    month: int
    year: int


class PeriodRequest(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    salary_calc_basis: str | None = None


class AdjustmentRequest(BaseModel):
    component_type: str  # earning | deduction
    component_code: str = "OTHER"
    label: str
    amount: float
    reason: str


class MarkPaidRequest(BaseModel):
    payment_date: date | None = None
    payment_method: str | None = "Bank Transfer"
    payment_reference: str | None = None


class SettingsRequest(BaseModel):
    salary_calc_basis: str


def _err(exc: Exception) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/salary-structure")
def create_salary_structure(
    payload: SalaryStructureRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    structure = PayrollService(db).assign_salary_structure(UUID(payload.user_id), payload.model_dump())
    return {"id": str(structure.id), "userId": str(structure.user_id)}


@router.get("/salary-structure/{user_id}")
def get_salary_structure(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_role == UserRole.user and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    structure = (
        db.query(SalaryStructure)
        .filter(SalaryStructure.user_id == user_id, SalaryStructure.is_active.is_(True))
        .first()
    )
    if not structure:
        raise HTTPException(status_code=404, detail="No salary structure")
    return {
        "id": str(structure.id),
        "userId": str(structure.user_id),
        "basicSalary": float(structure.basic_salary),
        "hra": float(structure.hra),
        "da": float(structure.da),
        "conveyance": float(structure.conveyance),
        "medicalAllowance": float(structure.medical_allowance),
        "specialAllowance": float(structure.special_allowance),
        "overtimeRate": float(structure.overtime_rate) if structure.overtime_rate else None,
    }


@router.get("/dashboard")
def payroll_dashboard(
    month: int,
    year: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return PayrollService(db).dashboard(month, year)


@router.get("/runs")
def list_runs(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc = PayrollService(db)
    return [svc._run_to_dict(r, include_employees=False) for r in svc.list_runs()]


@router.post("/runs/ensure")
def ensure_run(
    payload: PeriodRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    basis = None
    if payload.salary_calc_basis:
        basis = SalaryCalcBasis(payload.salary_calc_basis)
    run = PayrollService(db).get_or_create_run(payload.month, payload.year, basis)
    return PayrollService(db)._run_to_dict(run)


@router.get("/runs/{run_id}/precheck")
def precheck_run(run_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc = PayrollService(db)
    run = svc._get_run(run_id)
    return svc.precheck(run.month, run.year)


@router.post("/precheck")
def precheck_period(
    payload: PeriodRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return PayrollService(db).precheck(payload.month, payload.year)


@router.post("/runs/{run_id}/calculate")
def calculate_run(
    run_id: UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        run = PayrollService(db).calculate_run(run_id, admin_id=admin.id)
        return PayrollService(db)._run_to_dict(run)
    except ValueError as e:
        raise _err(e) from e


@router.post("/runs/{run_id}/submit-review")
def submit_review(run_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        run = PayrollService(db).submit_for_review(run_id)
        return PayrollService(db)._run_to_dict(run)
    except ValueError as e:
        raise _err(e) from e


@router.post("/runs/{run_id}/approve")
def approve_run(
    run_id: UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        run = PayrollService(db).approve_run(run_id, admin_id=admin.id)
        return PayrollService(db)._run_to_dict(run)
    except ValueError as e:
        raise _err(e) from e


@router.post("/runs/{run_id}/mark-paid")
def mark_paid(
    run_id: UUID,
    payload: MarkPaidRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        run = PayrollService(db).mark_paid(
            run_id,
            payment_date=payload.payment_date,
            payment_method=payload.payment_method,
            payment_reference=payload.payment_reference,
            admin_id=admin.id,
        )
        return PayrollService(db)._run_to_dict(run)
    except ValueError as e:
        raise _err(e) from e


@router.post("/runs/{run_id}/reopen")
def reopen_run(run_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        run = PayrollService(db).reopen_run(run_id)
        return PayrollService(db)._run_to_dict(run)
    except ValueError as e:
        raise _err(e) from e


@router.put("/runs/{run_id}/settings")
def update_settings(
    run_id: UUID,
    payload: SettingsRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        run = PayrollService(db).update_run_settings(run_id, SalaryCalcBasis(payload.salary_calc_basis))
        return PayrollService(db)._run_to_dict(run)
    except ValueError as e:
        raise _err(e) from e


@router.get("/runs/{run_id}/export.csv")
def export_csv(run_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        csv_data = PayrollService(db).export_csv(run_id)
    except ValueError as e:
        raise _err(e) from e
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="payroll-{run_id}.csv"'},
    )


@router.get("/runs/{run_id}/export.xlsx")
def export_xlsx(run_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        data = PayrollService(db).export_xlsx(run_id)
    except ValueError as e:
        raise _err(e) from e
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="payroll-{run_id}.xlsx"'},
    )


@router.get("/records/{record_id}")
def get_record(record_id: UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        return PayrollService(db).get_employee_detail(record_id)
    except ValueError as e:
        raise _err(e) from e


@router.post("/records/{record_id}/recalculate")
def recalculate_record(
    record_id: UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        record = PayrollService(db).recalculate_employee(record_id, admin_id=admin.id)
        return PayrollService(db).get_employee_detail(record.id)
    except ValueError as e:
        raise _err(e) from e


@router.post("/records/{record_id}/adjustments")
def add_adjustment(
    record_id: UUID,
    payload: AdjustmentRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        PayrollService(db).add_adjustment(
            record_id,
            component_type=payload.component_type,
            component_code=payload.component_code,
            label=payload.label,
            amount=payload.amount,
            reason=payload.reason,
            created_by=admin.id,
        )
        return PayrollService(db).get_employee_detail(record_id)
    except ValueError as e:
        raise _err(e) from e


@router.get("/my-payslips")
def my_payslips(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return PayrollService(db).employee_payslips(current_user.id)


@router.post("/process-monthly")
def process_monthly(
    payload: ProcessPayrollRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Legacy: calculate + submit for review in one step."""
    try:
        records = PayrollService(db).process_monthly(payload.month, payload.year, admin_id=admin.id)
    except ValueError as e:
        raise _err(e) from e
    return {
        "processed": len(records),
        "records": [
            {
                "id": str(r.id),
                "userId": str(r.user_id),
                "month": r.month,
                "year": r.year,
                "netSalary": float(r.net_salary or 0),
                "status": r.status.value,
                "payslipUrl": resolve_media_url(r.payslip_url) if r.payslip_url else None,
            }
            for r in records
        ],
    }


@router.get("/report")
def payroll_report(
    month: int,
    year: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    dash = PayrollService(db).dashboard(month, year)
    return {
        "month": month,
        "year": year,
        "totalNet": dash["kpis"]["netPayable"],
        "employeeCount": dash["kpis"]["employeeCount"],
        "records": [
            {
                "id": e["id"],
                "userId": e["userId"],
                "userName": e.get("userName"),
                "netSalary": e.get("netPay") or 0,
                "payslipUrl": e.get("payslipUrl"),
                "status": e.get("status"),
            }
            for e in dash["employees"]
            if e.get("id")
        ],
    }


@router.get("/slip/{payroll_id}")
def get_payslip(
    payroll_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        detail = PayrollService(db).get_employee_detail(payroll_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    if current_user.user_role == UserRole.user and detail["userId"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "payslipUrl": detail.get("payslipUrl"),
        "netSalary": detail.get("netPay"),
        "status": detail.get("status"),
        **detail,
    }
