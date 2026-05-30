import io
from datetime import date
from typing import List, Tuple
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.employee import Employee
from app.schemas.attendance import CSVUploadPreviewRow, CSVUploadPreviewResponse

STATUS_MAP = {
    "present": AttendanceStatus.present,
    "p": AttendanceStatus.present,
    "absent": AttendanceStatus.absent,
    "a": AttendanceStatus.absent,
    "half day": AttendanceStatus.half_day,
    "half_day": AttendanceStatus.half_day,
    "hd": AttendanceStatus.half_day,
    "wfh": AttendanceStatus.work_from_home,
    "work from home": AttendanceStatus.work_from_home,
    "work_from_home": AttendanceStatus.work_from_home,
    "leave": AttendanceStatus.on_leave,
    "on_leave": AttendanceStatus.on_leave,
    "on leave": AttendanceStatus.on_leave,
    "holiday": AttendanceStatus.holiday,
    "week off": AttendanceStatus.week_off,
    "week_off": AttendanceStatus.week_off,
    "wo": AttendanceStatus.week_off,
}


def normalize_status(raw: str) -> AttendanceStatus | None:
    return STATUS_MAP.get(raw.lower().strip())


async def parse_csv_preview(
    csv_bytes: bytes,
    org_id: str,
    db: AsyncSession,
) -> CSVUploadPreviewResponse:
    result = await db.execute(
        select(Employee).where(
            and_(Employee.org_id == org_id, Employee.status == "active")
        )
    )
    employees = result.scalars().all()
    emp_by_code = {e.employee_code.upper(): e for e in employees}

    try:
        df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as e:
        return CSVUploadPreviewResponse(
            total_rows=0, valid_rows=0, warnings=0, errors=1,
            preview=[], error_details=[f"Could not parse CSV: {str(e)}"]
        )

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    col_map = {}
    for col in df.columns:
        if col in ("employee_id", "emp_id", "empid", "employee_code", "emp_code"):
            col_map["employee_code"] = col
        elif col in ("employee_name", "emp_name", "name", "full_name"):
            col_map["employee_name"] = col
        elif col in ("date", "attendance_date", "att_date"):
            col_map["date"] = col
        elif col in ("status", "attendance", "attendance_status"):
            col_map["status"] = col

    required = ["employee_code", "date", "status"]
    missing = [r for r in required if r not in col_map]
    if missing:
        return CSVUploadPreviewResponse(
            total_rows=len(df), valid_rows=0, warnings=0, errors=1,
            preview=[], error_details=[f"Missing required columns (mapped from): {missing}"]
        )

    preview_rows: List[CSVUploadPreviewRow] = []
    error_details: List[str] = []
    warnings = 0

    for idx, row in df.iterrows():
        raw_code = str(row[col_map["employee_code"]]).strip().upper()
        raw_date = str(row[col_map["date"]]).strip()
        raw_status = str(row[col_map["status"]]).strip()

        try:
            parsed_date = pd.to_datetime(raw_date).date()
        except Exception:
            error_details.append(f"Row {idx+2}: Invalid date '{raw_date}'")
            continue

        status = normalize_status(raw_status)
        if not status:
            error_details.append(f"Row {idx+2}: Unknown status '{raw_status}' for employee {raw_code}")
            continue

        emp = emp_by_code.get(raw_code)
        if not emp:
            warn = f"Row {idx+2}: Employee code '{raw_code}' not found in org"
            error_details.append(warn)
            warnings += 1
            continue

        existing = await db.execute(
            select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.employee_id == emp.id,
                    AttendanceRecord.date == parsed_date,
                )
            )
        )
        action = "update" if existing.scalar_one_or_none() else "insert"

        name = row.get(col_map.get("employee_name", ""), emp.full_name) if "employee_name" in col_map else emp.full_name

        preview_rows.append(
            CSVUploadPreviewRow(
                employee_id=emp.id,
                employee_code=raw_code,
                employee_name=str(name),
                date=parsed_date,
                status=status.value,
                action=action,
            )
        )

    valid = len(preview_rows)
    return CSVUploadPreviewResponse(
        total_rows=len(df),
        valid_rows=valid,
        warnings=warnings,
        errors=len(error_details) - warnings,
        preview=preview_rows,
        error_details=error_details,
    )


async def commit_csv_attendance(
    preview_rows: List[CSVUploadPreviewRow],
    org_id: str,
    db: AsyncSession,
) -> int:
    upserted = 0
    for row in preview_rows:
        existing_result = await db.execute(
            select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.employee_id == row.employee_id,
                    AttendanceRecord.date == row.date,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            existing.status = AttendanceStatus(row.status)
            existing.source = "csv"
        else:
            record = AttendanceRecord(
                org_id=org_id,
                employee_id=row.employee_id,
                date=row.date,
                status=AttendanceStatus(row.status),
                source="csv",
            )
            db.add(record)
        upserted += 1
    await db.commit()
    return upserted
