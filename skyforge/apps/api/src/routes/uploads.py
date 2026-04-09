import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import storage
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_current_user_uid
from src.config import settings
from src.db import get_db
from src.models import Project, Upload, User

router = APIRouter()

gcs_client = storage.Client() if settings.gcp_project_id else None


class SignedUrlRequest(BaseModel):
    project_id: uuid.UUID
    filenames: list[str]


class SignedUrlResponse(BaseModel):
    urls: dict[str, str]


class UploadConfirm(BaseModel):
    project_id: uuid.UUID
    files: list[dict]  # [{filename, file_size_bytes, gps_lat, gps_lon, altitude_m}]


@router.post("/signed-urls", response_model=SignedUrlResponse)
async def get_upload_urls(
    body: SignedUrlRequest,
    uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
) -> SignedUrlResponse:
    """Generate signed GCS URLs for direct browser upload."""
    user = (await db.execute(select(User).where(User.firebase_uid == uid))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    project = (
        await db.execute(
            select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if len(body.filenames) > 2000:
        raise HTTPException(status_code=400, detail="Maximum 2000 photos per project")

    if not gcs_client:
        raise HTTPException(status_code=503, detail="Storage not configured")

    bucket = gcs_client.bucket(settings.gcs_raw_bucket)
    prefix = f"projects/{project.id}/raw"
    urls: dict[str, str] = {}

    for filename in body.filenames:
        blob = bucket.blob(f"{prefix}/{filename}")
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=2),
            method="PUT",
            content_type="application/octet-stream",
        )
        urls[filename] = url

    return SignedUrlResponse(urls=urls)


@router.post("/confirm")
async def confirm_uploads(
    body: UploadConfirm,
    uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Record upload metadata after browser uploads complete."""
    user = (await db.execute(select(User).where(User.firebase_uid == uid))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    project = (
        await db.execute(
            select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    prefix = f"projects/{project.id}/raw"
    for f in body.files:
        gps_wkt = None
        if f.get("gps_lat") and f.get("gps_lon"):
            gps_wkt = f"SRID=4326;POINT({f['gps_lon']} {f['gps_lat']})"

        upload = Upload(
            project_id=project.id,
            gcs_path=f"{prefix}/{f['filename']}",
            filename=f["filename"],
            file_size_bytes=f.get("file_size_bytes", 0),
            gps_location=gps_wkt,
            altitude_m=f.get("altitude_m"),
        )
        db.add(upload)

    project.photo_count = len(body.files)
    project.status = "uploading"
    await db.commit()

    return {"uploaded": len(body.files)}
