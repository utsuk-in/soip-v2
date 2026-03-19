from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.admin import (
    BulkRemoveRequest,
    BulkRemoveSummary,
    BulkResendRequest,
    BulkResendSummary,
    DashboardMetrics,
    EngagementReport,
    MagicLinkResult,
    StudentActivity,
    StudentListResponse,
    UploadConfirmRequest,
    UploadSummary,
    UploadValidationResponse,
)
from app.schemas.auth import TokenResponse
from app.services.auth import create_access_token, hash_password
from app.services.excel_parser import generate_template_xlsx, generate_template_csv, parse_csv, parse_xlsx
from app.services.magic_link import create_magic_link
from app.services.student_upload import confirm_upload, find_duplicate_emails
from app.utils.dependencies import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


# --- Schemas (kept here for the register endpoint) ---

class AdminRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    invite_code: str
    university_id: UUID


# --- Admin Registration ---

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def admin_register(body: AdminRegisterRequest, db: Session = Depends(get_db)):
    if body.invite_code != settings.admin_invite_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid invite code",
        )

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        university_id=body.university_id,
        role="admin",
        is_onboarded=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = JSONResponse(
        content={"access_token": token, "token_type": "bearer"},
        status_code=status.HTTP_201_CREATED,
    )
    response.set_cookie(
        key="soip_admin_token",
        value=token,
        httponly=True,
        secure=not settings.debug,
        samesite="strict",
        path="/api",
        max_age=settings.jwt_expire_minutes * 60,
    )
    return response


# --- Admin Logout ---

@router.post("/logout")
def admin_logout(admin: User = Depends(get_current_admin)):
    """Clear the admin HTTP-only auth cookie."""
    response = JSONResponse(content={"status": "ok"})
    response.delete_cookie(key="soip_admin_token", path="/api")
    return response


# --- Student Upload (SOIP-580) ---

@router.post("/students/validate", response_model=UploadValidationResponse)
def validate_student_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Parse and validate an uploaded student file without writing to DB."""
    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx"):
        valid_rows, errors = parse_xlsx(file.file)
    elif filename.endswith(".csv"):
        valid_rows, errors = parse_csv(file.file)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Upload .xlsx or .csv",
        )

    emails = [r.email for r in valid_rows]
    duplicates = find_duplicate_emails(db, emails)

    return UploadValidationResponse(
        valid_rows=valid_rows,
        errors=errors,
        duplicates=duplicates,
        total_rows=len(valid_rows) + len(errors),
    )


@router.post("/students/upload", response_model=UploadSummary)
def register_students(
    body: UploadConfirmRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Create student records and send magic link invites."""
    return confirm_upload(db, body.students, admin)


@router.get("/students/template")
def download_template(format: str = "xlsx"):
    """Download a sample template with 10 example rows. Supports xlsx and csv."""
    if format == "csv":
        content = generate_template_csv()
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=student_upload_template.csv"},
        )
    content = generate_template_xlsx()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=student_upload_template.xlsx"},
    )


@router.post("/students/bulk-resend", response_model=BulkResendSummary)
def bulk_resend_invite(
    body: BulkResendRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Generate new magic links for a batch of non-onboarded students."""
    students = db.query(User).filter(
        User.id.in_(body.student_ids),
        User.university_id == admin.university_id,
        User.role == "student",
    ).all()

    results = []
    skipped_onboarded = 0
    failed = 0

    for student in students:
        if student.is_onboarded:
            skipped_onboarded += 1
            continue
        try:
            ml_token = create_magic_link(db, student.id)
            results.append(MagicLinkResult(
                student_id=student.id,
                email=student.email,
                magic_token=ml_token.token,
                magic_link_url=f"{settings.frontend_base_url}/magic-link?token={ml_token.token}",
            ))
        except Exception:
            failed += 1

    db.commit()
    return BulkResendSummary(results=results, skipped_onboarded=skipped_onboarded, failed=failed)


@router.delete("/students/bulk", response_model=BulkRemoveSummary)
def bulk_remove_students(
    body: BulkRemoveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Soft-deactivate a batch of students."""
    removed = (
        db.query(User)
        .filter(
            User.id.in_(body.student_ids),
            User.university_id == admin.university_id,
            User.role == "student",
        )
        .update({"is_active": False}, synchronize_session=False)
    )
    db.commit()
    return BulkRemoveSummary(removed=removed)


@router.post("/students/{student_id}/resend-invite", response_model=MagicLinkResult)
def resend_invite(
    student_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Regenerate and resend a magic link for a student."""
    student = db.query(User).filter(
        User.id == student_id,
        User.university_id == admin.university_id,
        User.role == "student",
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if student.is_onboarded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student already activated")

    ml_token = create_magic_link(db, student.id)
    db.commit()
    return MagicLinkResult(
        student_id=student.id,
        email=student.email,
        magic_token=ml_token.token,
        magic_link_url=f"{settings.frontend_base_url}/magic-link?token={ml_token.token}",
    )


# --- Dashboard (SOIP-581) ---

@router.get("/dashboard/metrics", response_model=DashboardMetrics)
def dashboard_metrics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from app.services.admin_dashboard import get_dashboard_metrics
    return get_dashboard_metrics(db, admin.university_id)


@router.get("/students/filter-options")
def student_filter_options(
    field: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return distinct non-null values for a filterable column."""
    ALLOWED = {
        "department": User.department,
        "year_of_study": User.year_of_study,
    }
    if field not in ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field. Allowed: {', '.join(ALLOWED)}",
        )
    col = ALLOWED[field]
    rows = (
        db.query(col)
        .filter(
            User.university_id == admin.university_id,
            User.role == "student",
            col.isnot(None),
        )
        .distinct()
        .all()
    )
    return sorted([r[0] for r in rows if r[0]])


@router.get("/students", response_model=StudentListResponse)
def list_students(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
    name: str | None = None,
    email: str | None = None,
    department: str | None = None,
    year_of_study: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from app.services.admin_dashboard import get_student_list
    return get_student_list(
        db, admin.university_id, page, page_size, search, status_filter,
        name=name, email=email, department=department, year_of_study=year_of_study,
    )


@router.get("/students/{student_id}/activity", response_model=StudentActivity)
def student_activity(
    student_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    student = db.query(User).filter(
        User.id == student_id,
        User.university_id == admin.university_id,
        User.role == "student",
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    from app.services.admin_dashboard import get_student_activity
    return get_student_activity(db, student_id)


@router.delete("/students/{student_id}")
def remove_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    student = db.query(User).filter(
        User.id == student_id,
        User.university_id == admin.university_id,
        User.role == "student",
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    student.is_active = False
    db.commit()
    return {"status": "ok", "message": "Student removed"}


# --- Engagement Report (SOIP-582) ---

@router.get("/engagement", response_model=EngagementReport)
def engagement_report(
    weeks: int = 8,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from app.services.engagement import get_engagement_report
    return get_engagement_report(db, admin.university_id, weeks)
