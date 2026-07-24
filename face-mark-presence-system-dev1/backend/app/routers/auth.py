from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserRole
from app.schemas import (
    AdminResponse,
    TokenResponse,
    UserLoginRequest,
    UserProfileUpdate,
    UserRegisterRequest,
    UserResponse,
)
from app.services import (
    admin_to_response,
    create_access_token,
    get_user_by_email,
    hash_password,
    user_to_response,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """Public self-registration is disabled unless explicitly enabled in config.

    Employees are created by admins via POST /api/users/employees.
    """
    if not settings.allow_public_employee_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public employee registration is disabled. Ask an admin to create your account.",
        )

    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists with this email")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        user_name=payload.user_name,
        user_role=UserRole.user,
        user_image=payload.user_image,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, payload.email)
    if user and user.user_role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This is an admin account. Sign in at /admin/login instead.",
        )
    if not user or user.user_role != UserRole.user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(str(user.id), user.user_role.value)
    return TokenResponse(access_token=token)


@router.post("/admin/register", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
def register_admin(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """Bootstrap only: allowed when zero admin accounts exist. Otherwise closed."""
    admin_count = db.query(User).filter(User.user_role == UserRole.admin).count()
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin registration is closed. Ask an existing admin to create accounts.",
        )

    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin already exists with this email")

    admin = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        user_name=payload.user_name,
        user_role=UserRole.admin,
        user_image=payload.user_image,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin_to_response(admin)


@router.post("/admin/login", response_model=TokenResponse)
def login_admin(payload: UserLoginRequest, db: Session = Depends(get_db)):
    admin = get_user_by_email(db, payload.email)
    if admin and admin.user_role == UserRole.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This is an employee account. Sign in at /login instead.",
        )
    if not admin or admin.user_role != UserRole.admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    token = create_access_token(str(admin.id), admin.user_role.value)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.user_role != UserRole.user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee access required")

    if payload.user_name is not None:
        current_user.user_name = payload.user_name
    if payload.user_image is not None:
        current_user.user_image = payload.user_image

    db.commit()
    db.refresh(current_user)
    return user_to_response(current_user)


@router.get("/admin/me", response_model=AdminResponse)
def get_admin_me(current_user: User = Depends(get_current_user)):
    if current_user.user_role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return admin_to_response(current_user)
