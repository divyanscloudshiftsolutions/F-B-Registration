from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Department, User, UserRole
from app.schemas import EmployeeCreateRequest, EmployeeUpdateRequest
from app.services import get_user_by_email, hash_password
from app.services.leave_service import LeaveService
from app.services.payroll_service import PayrollService


class EmployeeServiceError(Exception):
    pass


class EmployeeService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_employee_code(self) -> str:
        existing = {
            row[0]
            for row in self.db.query(User.employee_code).filter(User.employee_code.isnot(None)).all()
        }
        numeric = [int(c) for c in existing if c.isdigit() and 1 <= len(c) <= 6]
        next_num = (max(numeric) if numeric else 0) + 1
        if next_num > 999999:
            raise EmployeeServiceError("No employee codes available")
        while True:
            code = f"{next_num:06d}"
            if code not in existing:
                return code
            next_num += 1
            if next_num > 999999:
                raise EmployeeServiceError("No employee codes available")

    def list_departments(self) -> list[Department]:
        return (
            self.db.query(Department)
            .filter(Department.is_active.is_(True))
            .order_by(Department.name)
            .all()
        )

    def create_employee(self, payload: EmployeeCreateRequest) -> User:
        if get_user_by_email(self.db, payload.email):
            raise EmployeeServiceError("An employee with this email already exists")

        employee_code = self._generate_employee_code()

        department_id = None
        if payload.department_id:
            department_id = UUID(payload.department_id)
            dept = self.db.query(Department).filter(Department.id == department_id).first()
            if not dept:
                raise EmployeeServiceError("Department not found")

        documents_metadata: dict = {}
        for doc in payload.documents:
            documents_metadata[doc.type] = {
                "url": doc.url,
                "name": doc.name,
                "uploadedAt": date.today().isoformat(),
            }

        user = User(
            email=payload.email,
            password_hash=hash_password(payload.password),
            user_name=payload.user_name,
            user_role=UserRole.user,
            user_image=payload.user_image,
            phone=payload.phone,
            employee_code=employee_code,
            department_id=department_id,
            joining_date=payload.joining_date,
            termination_date=payload.termination_date,
            designation=payload.designation,
            employment_type=payload.employment_type,
            status=payload.status or "Active",
            aadhaar_number=payload.aadhaar_number,
            pan_number=payload.pan_number,
            uan_number=payload.uan_number,
            esi_number=payload.esi_number,
            bank_account_number=payload.bank_account_number,
            bank_ifsc=payload.bank_ifsc,
            bank_name=payload.bank_name,
            documents_metadata=documents_metadata,
        )
        self.db.add(user)
        self.db.flush()

        LeaveService(self.db).ensure_balances_for_user(user)

        if payload.salary:
            salary_data = {
                "basic_salary": payload.salary.basic_salary,
                "hra": payload.salary.hra,
                "da": payload.salary.da,
                "conveyance": payload.salary.conveyance,
                "medical_allowance": payload.salary.medical_allowance,
                "special_allowance": payload.salary.special_allowance,
                "overtime_rate": payload.salary.overtime_rate,
                "effective_from": payload.salary.effective_from,
            }
            PayrollService(self.db).assign_salary_structure(user.id, salary_data)

        self.db.commit()
        self.db.refresh(user)
        return user

    def get_employee(self, user_id: UUID) -> User:
        user = (
            self.db.query(User)
            .filter(User.id == user_id, User.user_role == UserRole.user)
            .first()
        )
        if not user:
            raise EmployeeServiceError("Employee not found")
        return user

    def update_employee(self, user_id: UUID, payload: EmployeeUpdateRequest) -> User:
        user = self.get_employee(user_id)

        if payload.email and payload.email != user.email:
            if get_user_by_email(self.db, payload.email):
                raise EmployeeServiceError("An employee with this email already exists")
            user.email = payload.email

        if payload.password:
            user.password_hash = hash_password(payload.password)

        if payload.user_name is not None:
            user.user_name = payload.user_name
        if payload.user_image is not None:
            user.user_image = payload.user_image
        if payload.phone is not None:
            user.phone = payload.phone

        if payload.department_id is not None:
            if payload.department_id == "":
                user.department_id = None
            else:
                department_id = UUID(payload.department_id)
                dept = self.db.query(Department).filter(Department.id == department_id).first()
                if not dept:
                    raise EmployeeServiceError("Department not found")
                user.department_id = department_id

        if payload.joining_date is not None:
            user.joining_date = payload.joining_date
        if payload.termination_date is not None:
            user.termination_date = payload.termination_date
        if payload.designation is not None:
            user.designation = payload.designation
        if payload.employment_type is not None:
            user.employment_type = payload.employment_type
        if payload.status is not None:
            user.status = payload.status
        if payload.aadhaar_number is not None:
            user.aadhaar_number = payload.aadhaar_number
        if payload.pan_number is not None:
            user.pan_number = payload.pan_number
        if payload.uan_number is not None:
            user.uan_number = payload.uan_number
        if payload.esi_number is not None:
            user.esi_number = payload.esi_number
        if payload.bank_account_number is not None:
            user.bank_account_number = payload.bank_account_number
        if payload.bank_ifsc is not None:
            user.bank_ifsc = payload.bank_ifsc
        if payload.bank_name is not None:
            user.bank_name = payload.bank_name

        if payload.documents is not None:
            documents_metadata = dict(user.documents_metadata or {})
            for doc in payload.documents:
                documents_metadata[doc.type] = {
                    "url": doc.url,
                    "name": doc.name,
                    "uploadedAt": date.today().isoformat(),
                }
            user.documents_metadata = documents_metadata

        if payload.salary:
            salary_data = {
                "basic_salary": payload.salary.basic_salary,
                "hra": payload.salary.hra,
                "da": payload.salary.da,
                "conveyance": payload.salary.conveyance,
                "medical_allowance": payload.salary.medical_allowance,
                "special_allowance": payload.salary.special_allowance,
                "overtime_rate": payload.salary.overtime_rate,
                "effective_from": payload.salary.effective_from,
            }
            PayrollService(self.db).assign_salary_structure(user.id, salary_data)

        self.db.commit()
        self.db.refresh(user)
        return user
