from datetime import date
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models import (
    Holiday,
    HolidayAppliesTo,
    HolidayType,
    HolidayWorkCompensation,
    User,
    WeekOffPolicy,
    WeekOffPolicyType,
)
from app.services.policy_mutation import (
    assert_dates_writable,
    employees_for_holiday,
    employees_for_weekoff_policy,
    filter_writable_dates,
    refresh_employees_on_dates,
    writable_future_weekoff_dates,
)


class PolicyServiceError(Exception):
    pass


class HolidayWeekOffService:
    def __init__(self, db: Session):
        self.db = db

    # ---- Holidays ----

    def list_holidays(self, year: int | None = None) -> list[Holiday]:
        q = self.db.query(Holiday).filter(Holiday.is_active.is_(True))
        if year:
            q = q.filter(Holiday.holiday_date >= date(year, 1, 1), Holiday.holiday_date <= date(year, 12, 31))
        return q.order_by(Holiday.holiday_date).all()

    def create_holiday(self, data: dict) -> Holiday:
        holiday_date = (
            data["holiday_date"]
            if isinstance(data["holiday_date"], date)
            else date.fromisoformat(str(data["holiday_date"]))
        )
        assert_dates_writable(self.db, [holiday_date])

        holiday = Holiday(
            id=uuid4(),
            name=data["name"].strip(),
            holiday_date=holiday_date,
            holiday_type=HolidayType(data.get("holiday_type", "public")),
            applies_to=HolidayAppliesTo(data.get("applies_to", "all")),
            department_id=UUID(str(data["department_id"])) if data.get("department_id") else None,
            employment_type=data.get("employment_type"),
            is_paid=bool(data.get("is_paid", True)),
            work_compensation=HolidayWorkCompensation(data.get("work_compensation", "comp_off")),
            is_active=True,
        )
        self.db.add(holiday)
        self.db.flush()
        employees = employees_for_holiday(self.db, holiday)
        refresh_employees_on_dates(self.db, employees, [holiday.holiday_date], commit=False)
        self.db.commit()
        self.db.refresh(holiday)
        return holiday

    def update_holiday(self, holiday_id: UUID, data: dict) -> Holiday:
        holiday = self.db.query(Holiday).filter(Holiday.id == holiday_id).first()
        if not holiday:
            raise PolicyServiceError("Holiday not found")

        old_date = holiday.holiday_date
        old_employees = employees_for_holiday(self.db, holiday)

        new_date = old_date
        if "holiday_date" in data and data["holiday_date"]:
            new_date = (
                data["holiday_date"]
                if isinstance(data["holiday_date"], date)
                else date.fromisoformat(str(data["holiday_date"]))
            )

        assert_dates_writable(self.db, {old_date, new_date})

        if "name" in data and data["name"]:
            holiday.name = data["name"].strip()
        if "holiday_date" in data and data["holiday_date"]:
            holiday.holiday_date = new_date
        if "holiday_type" in data and data["holiday_type"]:
            holiday.holiday_type = HolidayType(data["holiday_type"])
        if "applies_to" in data and data["applies_to"]:
            holiday.applies_to = HolidayAppliesTo(data["applies_to"])
        if "department_id" in data:
            holiday.department_id = UUID(str(data["department_id"])) if data["department_id"] else None
        if "employment_type" in data:
            holiday.employment_type = data["employment_type"]
        if "is_paid" in data and data["is_paid"] is not None:
            holiday.is_paid = data["is_paid"]
        if "work_compensation" in data and data["work_compensation"]:
            holiday.work_compensation = HolidayWorkCompensation(data["work_compensation"])
        if "is_active" in data and data["is_active"] is not None:
            holiday.is_active = data["is_active"]

        self.db.flush()
        new_employees = employees_for_holiday(self.db, holiday)
        # Refresh old + new scopes on old + new dates
        emp_by_id = {e.id: e for e in old_employees + new_employees}
        refresh_employees_on_dates(
            self.db,
            list(emp_by_id.values()),
            {old_date, new_date},
            commit=False,
        )
        self.db.commit()
        self.db.refresh(holiday)
        return holiday

    def delete_holiday(self, holiday_id: UUID) -> None:
        holiday = self.db.query(Holiday).filter(Holiday.id == holiday_id).first()
        if not holiday:
            raise PolicyServiceError("Holiday not found")
        assert_dates_writable(self.db, [holiday.holiday_date])
        employees = employees_for_holiday(self.db, holiday)
        holiday_date = holiday.holiday_date
        holiday.is_active = False
        self.db.flush()
        refresh_employees_on_dates(self.db, employees, [holiday_date], commit=False)
        self.db.commit()

    def holiday_to_dict(self, h: Holiday) -> dict:
        return {
            "id": str(h.id),
            "name": h.name,
            "holidayDate": h.holiday_date.isoformat(),
            "holidayType": h.holiday_type.value,
            "appliesTo": h.applies_to.value,
            "departmentId": str(h.department_id) if h.department_id else None,
            "employmentType": h.employment_type,
            "isPaid": h.is_paid,
            "workCompensation": h.work_compensation.value,
            "isActive": h.is_active,
        }

    # ---- Week-off policies ----

    def list_weekoff_policies(self, active_only: bool = True) -> list[WeekOffPolicy]:
        q = self.db.query(WeekOffPolicy)
        if active_only:
            q = q.filter(WeekOffPolicy.is_active.is_(True))
        return q.order_by(WeekOffPolicy.name).all()

    def _refresh_policy_forward(self, policy: WeekOffPolicy, old_days: list[int] | None = None) -> None:
        """Refresh writable/future matching weekdays for assigned employees (no historical locked rewrite)."""
        employees = employees_for_weekoff_policy(self.db, policy)
        days = set(policy.week_off_days or [])
        if old_days:
            days |= set(old_days)
        candidate = writable_future_weekoff_dates(sorted(days))
        writable = filter_writable_dates(self.db, candidate)
        if employees and writable:
            refresh_employees_on_dates(self.db, employees, writable, commit=False)

    def create_weekoff_policy(self, data: dict) -> WeekOffPolicy:
        code = data["code"].strip().upper()
        if self.db.query(WeekOffPolicy).filter(WeekOffPolicy.code == code).first():
            raise PolicyServiceError(f"Policy code '{code}' already exists")
        if data.get("is_default"):
            self.db.query(WeekOffPolicy).update({"is_default": False})
        policy = WeekOffPolicy(
            id=uuid4(),
            name=data["name"].strip(),
            code=code,
            policy_type=WeekOffPolicyType(data.get("policy_type", "fixed")),
            week_off_days=data.get("week_off_days") or [],
            is_paid=bool(data.get("is_paid", True)),
            work_compensation=HolidayWorkCompensation(data.get("work_compensation", "comp_off")),
            is_active=True,
            is_default=bool(data.get("is_default", False)),
        )
        self.db.add(policy)
        self.db.flush()
        self._refresh_policy_forward(policy)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    def update_weekoff_policy(self, policy_id: UUID, data: dict) -> WeekOffPolicy:
        policy = self.db.query(WeekOffPolicy).filter(WeekOffPolicy.id == policy_id).first()
        if not policy:
            raise PolicyServiceError("Week-off policy not found")
        old_days = list(policy.week_off_days or [])
        if data.get("is_default"):
            self.db.query(WeekOffPolicy).filter(WeekOffPolicy.id != policy_id).update({"is_default": False})
        for field, key in [
            ("name", "name"),
            ("code", "code"),
            ("policy_type", "policy_type"),
            ("week_off_days", "week_off_days"),
            ("is_paid", "is_paid"),
            ("work_compensation", "work_compensation"),
            ("is_active", "is_active"),
            ("is_default", "is_default"),
        ]:
            if key in data and data[key] is not None:
                val = data[key]
                if field == "code":
                    val = str(val).strip().upper()
                if field == "policy_type":
                    val = WeekOffPolicyType(val)
                if field == "work_compensation":
                    val = HolidayWorkCompensation(val)
                setattr(policy, field, val)
        self.db.flush()
        self._refresh_policy_forward(policy, old_days=old_days)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    def assign_weekoff_policy(self, user_id: UUID, policy_id: UUID | None) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise PolicyServiceError("Employee not found")
        policy = None
        if policy_id:
            policy = self.db.query(WeekOffPolicy).filter(WeekOffPolicy.id == policy_id).first()
            if not policy:
                raise PolicyServiceError("Week-off policy not found")
        user.weekoff_policy_id = policy_id
        self.db.flush()
        days = list((policy.week_off_days if policy else []) or [])
        # Also refresh with previous default days if clearing assignment — use new policy or empty
        candidate = writable_future_weekoff_dates(days) if days else writable_future_weekoff_dates([0, 1, 2, 3, 4, 5, 6])
        writable = filter_writable_dates(self.db, candidate)
        if writable:
            refresh_employees_on_dates(self.db, [user], writable, commit=False)
        self.db.commit()
        self.db.refresh(user)
        return user

    def weekoff_to_dict(self, p: WeekOffPolicy) -> dict:
        return {
            "id": str(p.id),
            "name": p.name,
            "code": p.code,
            "policyType": p.policy_type.value,
            "weekOffDays": p.week_off_days or [],
            "isPaid": p.is_paid,
            "workCompensation": p.work_compensation.value,
            "isActive": p.is_active,
            "isDefault": p.is_default,
        }
