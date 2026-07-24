from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Attendance, AttendanceType, LeaveRequest, LeaveStatus, PayrollRecord, PayrollStatus, RecordStatus, User, UserRole
from app.timeutil import local_day_bounds_utc, local_today

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_employees = db.query(User).filter(User.user_role == UserRole.user).count()
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.pending).count()
    pending_attendance = db.query(Attendance).filter(Attendance.status == RecordStatus.pending).count()
    payroll_processed = db.query(PayrollRecord).filter(PayrollRecord.status == PayrollStatus.processed).count()

    return {
        "totalEmployees": total_employees,
        "pendingLeaves": pending_leaves,
        "pendingAttendance": pending_attendance,
        "payrollProcessed": payroll_processed,
    }


@router.get("/attendance-today")
def attendance_today(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    today = local_today()
    start, end = local_day_bounds_utc(today)
    records = (
        db.query(Attendance)
        .filter(Attendance.timestamp >= start, Attendance.timestamp <= end)
        .all()
    )
    checkins = [r for r in records if r.type == AttendanceType.check_in]
    checkouts = [r for r in records if r.type == AttendanceType.check_out]
    return {
        "date": today.isoformat(),
        "checkIns": len(checkins),
        "checkOuts": len(checkouts),
        "records": [
            {
                "id": str(r.id),
                "userName": r.user_name,
                "userEmail": r.user_email,
                "type": r.type.value,
                "method": r.method.value,
                "status": r.status.value,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in records
        ],
    }
