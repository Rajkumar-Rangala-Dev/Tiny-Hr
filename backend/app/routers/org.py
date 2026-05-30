from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.storage import upload_file_to_storage, get_signed_url
from app.core.config import get_settings
from app.models.user import User, UserRole
from app.models.org import Organization
from app.schemas.org import OrgOut, OrgUpdateRequest

router = APIRouter(prefix="/org", tags=["Organisation"])
settings = get_settings()


@router.get("/", response_model=OrgOut)
async def get_org(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return org


@router.patch("/", response_model=OrgOut)
async def update_org(
    data: OrgUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can update org settings")

    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return org


@router.post("/logo")
async def upload_org_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can upload logo")

    content = await file.read()
    path = f"{current_user.org_id}/logo/{file.filename}"
    await upload_file_to_storage(
        bucket=settings.STORAGE_BUCKET_LOGOS,
        path=path,
        content=content,
        content_type=file.content_type,
    )

    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = result.scalar_one()
    org.logo_path = path
    await db.commit()

    return {"logo_path": path, "message": "Logo uploaded successfully"}


@router.get("/logo/url")
async def get_logo_url(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = result.scalar_one_or_none()
    if not org or not org.logo_path:
        raise HTTPException(status_code=404, detail="No logo uploaded")
    url = await get_signed_url(settings.STORAGE_BUCKET_LOGOS, org.logo_path)
    return {"url": url}
