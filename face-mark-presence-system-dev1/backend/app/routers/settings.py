from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import AttendancePolicy, Department, DocumentType, EmploymentType, User
from app.services.attendance_policy_service import AttendancePolicyService

router = APIRouter(prefix="/settings", tags=["settings"])


class DepartmentPayload(BaseModel):
    name: str
    code: str
    description: str | None = None
    is_active: bool = True


class EmploymentTypePayload(BaseModel):
    name: str
    code: str
    is_active: bool = True
    sort_order: int = 0


class DocumentTypePayload(BaseModel):
    key: str
    label: str
    is_required: bool = False
    is_active: bool = True
    sort_order: int = 0


class AttendancePolicyPayload(BaseModel):
    shift_start_time: str = Field(alias="shiftStartTime")
    shift_end_time: str = Field(alias="shiftEndTime")
    late_grace_minutes: int = Field(alias="lateGraceMinutes")
    half_day_hours: float = Field(alias="halfDayHours")
    full_day_hours: float = Field(alias="fullDayHours")
    overtime_after_hours: float = Field(alias="overtimeAfterHours")

    model_config = {"populate_by_name": True}


def _department(d: Department) -> dict:
    return {
        "id": str(d.id),
        "name": d.name,
        "code": d.code,
        "description": d.description,
        "isActive": d.is_active,
    }


def _employment_type(e: EmploymentType) -> dict:
    return {
        "id": str(e.id),
        "name": e.name,
        "code": e.code,
        "isActive": e.is_active,
        "sortOrder": e.sort_order,
    }


def _document_type(d: DocumentType) -> dict:
    return {
        "id": str(d.id),
        "key": d.key,
        "label": d.label,
        "isRequired": d.is_required,
        "isActive": d.is_active,
        "sortOrder": d.sort_order,
    }


def _attendance_policy(p: AttendancePolicy) -> dict:
    return {
        "shiftStartTime": p.shift_start_time,
        "shiftEndTime": p.shift_end_time,
        "lateGraceMinutes": p.late_grace_minutes,
        "halfDayHours": float(p.half_day_hours),
        "fullDayHours": float(p.full_day_hours),
        "overtimeAfterHours": float(p.overtime_after_hours),
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


# Departments
@router.get("/departments")
def list_departments(
    active_only: bool = False,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Department).order_by(Department.name)
    if active_only:
        query = query.filter(Department.is_active.is_(True))
    return [_department(d) for d in query.all()]


@router.post("/departments", status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentPayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if db.query(Department).filter(Department.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Department code already exists")
    dept = Department(
        name=payload.name,
        code=payload.code.upper(),
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _department(dept)


@router.patch("/departments/{department_id}")
def update_department(
    department_id: UUID,
    payload: DepartmentPayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    existing = db.query(Department).filter(Department.code == payload.code, Department.id != department_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    dept.name = payload.name
    dept.code = payload.code.upper()
    dept.description = payload.description
    dept.is_active = payload.is_active
    db.commit()
    db.refresh(dept)
    return _department(dept)


@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.is_active = False
    db.commit()


# Employment types
@router.get("/employment-types")
def list_employment_types(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    items = db.query(EmploymentType).order_by(EmploymentType.sort_order, EmploymentType.name).all()
    return [_employment_type(e) for e in items]


@router.post("/employment-types", status_code=status.HTTP_201_CREATED)
def create_employment_type(
    payload: EmploymentTypePayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if db.query(EmploymentType).filter(EmploymentType.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Code already exists")
    item = EmploymentType(
        name=payload.name,
        code=payload.code,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    AttendancePolicyService(db).get_policy_for_employment_type(item.id)
    return _employment_type(item)


@router.patch("/employment-types/{item_id}")
def update_employment_type(
    item_id: UUID,
    payload: EmploymentTypePayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(EmploymentType).filter(EmploymentType.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Employment type not found")
    existing = (
        db.query(EmploymentType)
        .filter(EmploymentType.code == payload.code, EmploymentType.id != item_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")
    item.name = payload.name
    item.code = payload.code
    item.is_active = payload.is_active
    item.sort_order = payload.sort_order
    db.commit()
    db.refresh(item)
    return _employment_type(item)


@router.delete("/employment-types/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employment_type(
    item_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(EmploymentType).filter(EmploymentType.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Employment type not found")
    item.is_active = False
    db.commit()


# Document types
@router.get("/document-types")
def list_document_types(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    items = db.query(DocumentType).order_by(DocumentType.sort_order, DocumentType.label).all()
    return [_document_type(d) for d in items]


@router.post("/document-types", status_code=status.HTTP_201_CREATED)
def create_document_type(
    payload: DocumentTypePayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if db.query(DocumentType).filter(DocumentType.key == payload.key).first():
        raise HTTPException(status_code=400, detail="Document key already exists")
    item = DocumentType(
        key=payload.key,
        label=payload.label,
        is_required=payload.is_required,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _document_type(item)


@router.patch("/document-types/{item_id}")
def update_document_type(
    item_id: UUID,
    payload: DocumentTypePayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(DocumentType).filter(DocumentType.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Document type not found")
    existing = (
        db.query(DocumentType)
        .filter(DocumentType.key == payload.key, DocumentType.id != item_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Document key already exists")
    item.key = payload.key
    item.label = payload.label
    item.is_required = payload.is_required
    item.is_active = payload.is_active
    item.sort_order = payload.sort_order
    db.commit()
    db.refresh(item)
    return _document_type(item)


@router.delete("/document-types/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_type(
    item_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(DocumentType).filter(DocumentType.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Document type not found")
    item.is_active = False
    db.commit()


# Attendance policies (per employment type)
@router.get("/attendance-policies")
def list_attendance_policies(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return AttendancePolicyService(db).list_policies()


@router.put("/attendance-policies/{employment_type_id}")
def update_attendance_policy_for_type(
    employment_type_id: UUID,
    payload: AttendancePolicyPayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    employment_type = db.query(EmploymentType).filter(EmploymentType.id == employment_type_id).first()
    if not employment_type:
        raise HTTPException(status_code=404, detail="Employment type not found")
    policy = AttendancePolicyService(db).update_policy_for_employment_type(
        employment_type_id, payload.model_dump()
    )
    return AttendancePolicyService(db)._policy_response(policy, employment_type)


# Legacy single default policy endpoints
@router.get("/attendance-policy")
def get_attendance_policy(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    policy = AttendancePolicyService(db).get_default_policy()
    return _attendance_policy(policy)


@router.put("/attendance-policy")
def update_attendance_policy(
    payload: AttendancePolicyPayload,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    policy = AttendancePolicyService(db).update_default_policy(payload.model_dump())
    return _attendance_policy(policy)
