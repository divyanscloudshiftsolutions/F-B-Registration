from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import User, UserRole
from app.schemas import DepartmentResponse, EmployeeCreateRequest, EmployeeResponse, EmployeeUpdateRequest, UserResponse
from app.services import get_user_by_email, get_user_by_id, employee_to_response, user_to_response
from app.services.employee_service import EmployeeService, EmployeeServiceError

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/departments", response_model=list[DepartmentResponse])
def list_departments(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    departments = EmployeeService(db).list_departments()
    return [
        DepartmentResponse(
            id=str(d.id),
            name=d.name,
            code=d.code,
            description=d.description,
        )
        for d in departments
    ]


@router.get("", response_model=list[EmployeeResponse])
def list_users(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.salary_structures))
        .filter(User.user_role == UserRole.user)
        .order_by(User.created_at.desc())
        .all()
    )
    return [employee_to_response(user) for user in users]


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreateRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = EmployeeService(db)
    try:
        user = service.create_employee(payload)
    except EmployeeServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.refresh(user)
    user = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.salary_structures))
        .filter(User.id == user.id)
        .first()
    )
    return employee_to_response(user)


def _load_employee(db: Session, user_id: UUID) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.salary_structures))
        .filter(User.id == user_id, User.user_role == UserRole.user)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return user


@router.get("/employees/{user_id}", response_model=EmployeeResponse)
def get_employee(
    user_id: UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return employee_to_response(_load_employee(db, user_id))


@router.patch("/employees/{user_id}", response_model=EmployeeResponse)
def update_employee(
    user_id: UUID,
    payload: EmployeeUpdateRequest,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = EmployeeService(db)
    try:
        service.update_employee(user_id, payload)
    except EmployeeServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return employee_to_response(_load_employee(db, user_id))


@router.get("/by-email/{email}", response_model=UserResponse)
def get_user_by_email_route(
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Employees may only look up themselves; admins may look up anyone
    if current_user.user_role == UserRole.user and current_user.id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user_to_response(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Employees may only fetch themselves; admins may fetch anyone (same rule as by-email)
    if current_user.user_role == UserRole.user and current_user.id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user_to_response(user)
