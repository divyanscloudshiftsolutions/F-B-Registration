from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LocationSchema(BaseModel):
    latitude: float
    longitude: float
    accuracy: float


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    user_name: str = Field(min_length=1, alias="userName")
    user_image: str | None = Field(default=None, alias="userImage")

    model_config = ConfigDict(populate_by_name=True)


class UserProfileUpdate(BaseModel):
    user_name: str | None = Field(default=None, alias="userName")
    user_image: str | None = Field(default=None, alias="userImage")

    model_config = ConfigDict(populate_by_name=True)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    user_id: str = Field(alias="userId")
    email: EmailStr
    user_name: str = Field(alias="userName")
    user_role: str = Field(alias="userRole")
    user_image: str | None = Field(default=None, alias="userImage")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AdminResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    avatar: str | None = None
    role: Literal["admin"] = "admin"


class AttendanceCreateRequest(BaseModel):
    user_id: str | None = Field(default=None, alias="userId")
    user_name: str | None = Field(default=None, alias="userName")
    user_email: str | None = Field(default=None, alias="userEmail")
    timestamp: datetime | None = None
    type: Literal["check-in", "check-out", "week-off"]
    method: Literal["face", "manual", "geolocation"]
    status: Literal["pending", "approved", "rejected"] | None = None
    location: LocationSchema | None = None
    note: str | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")

    model_config = ConfigDict(populate_by_name=True)


class AttendanceUpdateRequest(BaseModel):
    user_id: str | None = Field(default=None, alias="userId")
    status: Literal["pending", "approved", "rejected"] | None = None
    note: str | None = None
    type: Literal["check-in", "check-out", "week-off"] | None = None
    method: Literal["face", "manual", "geolocation"] | None = None
    location: LocationSchema | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")

    model_config = ConfigDict(populate_by_name=True)


class AttendanceResponse(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    user_name: str = Field(alias="userName")
    user_email: str = Field(alias="userEmail")
    timestamp: str
    type: Literal["check-in", "check-out", "week-off"]
    method: Literal["face", "manual", "geolocation"]
    status: Literal["pending", "approved", "rejected"]
    location: LocationSchema | None = None
    note: str | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")
    face_confidence: float | None = Field(default=None, alias="faceConfidence")
    work_hours: float | None = Field(default=None, alias="workHours")
    day_status: str | None = Field(default=None, alias="dayStatus")

    model_config = ConfigDict(populate_by_name=True)


class WeekOffCreateRequest(BaseModel):
    user_id: str | None = Field(default=None, alias="userId")
    user_email: str | None = Field(default=None, alias="userEmail")
    date: datetime
    reason: str = Field(min_length=1)
    status: Literal["pending", "approved", "rejected"] | None = None

    model_config = ConfigDict(populate_by_name=True)


class WeekOffUpdateRequest(BaseModel):
    status: Literal["pending", "approved", "rejected"] | None = None
    reason: str | None = None
    date: datetime | None = None

    model_config = ConfigDict(populate_by_name=True)


class WeekOffResponse(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    user_email: str = Field(alias="userEmail")
    date: str
    reason: str
    status: Literal["pending", "approved", "rejected"]
    created_at: str = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class UploadResponse(BaseModel):
    url: str


class EmployeeDocumentSchema(BaseModel):
    type: str
    name: str
    url: str


class EmployeeSalaryInput(BaseModel):
    basic_salary: float = Field(alias="basicSalary")
    hra: float = 0
    da: float = 0
    conveyance: float = 0
    medical_allowance: float = Field(0, alias="medicalAllowance")
    special_allowance: float = Field(0, alias="specialAllowance")
    overtime_rate: float | None = Field(None, alias="overtimeRate")
    effective_from: date | None = Field(None, alias="effectiveFrom")

    model_config = ConfigDict(populate_by_name=True)


class EmployeeCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    user_name: str = Field(min_length=1, alias="userName")
    user_image: str | None = Field(default=None, alias="userImage")
    phone: str | None = None
    employee_code: str | None = Field(default=None, alias="employeeCode")
    department_id: str | None = Field(default=None, alias="departmentId")
    joining_date: date | None = Field(default=None, alias="joiningDate")
    termination_date: date | None = Field(default=None, alias="terminationDate")
    designation: str | None = None
    employment_type: str = Field(default="Full-time", alias="employmentType")
    status: str = "Active"
    aadhaar_number: str | None = Field(default=None, alias="aadhaarNumber")
    pan_number: str | None = Field(default=None, alias="panNumber")
    uan_number: str | None = Field(default=None, alias="uanNumber")
    esi_number: str | None = Field(default=None, alias="esiNumber")
    bank_account_number: str | None = Field(default=None, alias="bankAccountNumber")
    bank_ifsc: str | None = Field(default=None, alias="bankIfsc")
    bank_name: str | None = Field(default=None, alias="bankName")
    documents: list[EmployeeDocumentSchema] = []
    salary: EmployeeSalaryInput | None = None

    model_config = ConfigDict(populate_by_name=True)


class EmployeeUpdateRequest(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)
    user_name: str | None = Field(default=None, min_length=1, alias="userName")
    user_image: str | None = Field(default=None, alias="userImage")
    phone: str | None = None
    employee_code: str | None = Field(default=None, alias="employeeCode")
    department_id: str | None = Field(default=None, alias="departmentId")
    joining_date: date | None = Field(default=None, alias="joiningDate")
    termination_date: date | None = Field(default=None, alias="terminationDate")
    designation: str | None = None
    employment_type: str | None = Field(default=None, alias="employmentType")
    status: str | None = None
    aadhaar_number: str | None = Field(default=None, alias="aadhaarNumber")
    pan_number: str | None = Field(default=None, alias="panNumber")
    uan_number: str | None = Field(default=None, alias="uanNumber")
    esi_number: str | None = Field(default=None, alias="esiNumber")
    bank_account_number: str | None = Field(default=None, alias="bankAccountNumber")
    bank_ifsc: str | None = Field(default=None, alias="bankIfsc")
    bank_name: str | None = Field(default=None, alias="bankName")
    documents: list[EmployeeDocumentSchema] | None = None
    salary: EmployeeSalaryInput | None = None

    model_config = ConfigDict(populate_by_name=True)


class DepartmentResponse(BaseModel):
    id: str
    name: str
    code: str
    description: str | None = None


class EmployeeResponse(BaseModel):
    user_id: str = Field(alias="userId")
    email: EmailStr
    user_name: str = Field(alias="userName")
    user_role: str = Field(alias="userRole")
    user_image: str | None = Field(default=None, alias="userImage")
    phone: str | None = None
    employee_code: str | None = Field(default=None, alias="employeeCode")
    department_id: str | None = Field(default=None, alias="departmentId")
    department_name: str | None = Field(default=None, alias="departmentName")
    joining_date: str | None = Field(default=None, alias="joiningDate")
    termination_date: str | None = Field(default=None, alias="terminationDate")
    designation: str | None = None
    employment_type: str | None = Field(default=None, alias="employmentType")
    status: str | None = None
    aadhaar_number: str | None = Field(default=None, alias="aadhaarNumber")
    pan_number: str | None = Field(default=None, alias="panNumber")
    uan_number: str | None = Field(default=None, alias="uanNumber")
    esi_number: str | None = Field(default=None, alias="esiNumber")
    bank_account_number: str | None = Field(default=None, alias="bankAccountNumber")
    bank_ifsc: str | None = Field(default=None, alias="bankIfsc")
    bank_name: str | None = Field(default=None, alias="bankName")
    documents: dict | None = None
    has_salary_structure: bool = Field(default=False, alias="hasSalaryStructure")
    salary: EmployeeSalaryInput | None = None
    created_at: str | None = Field(default=None, alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)
