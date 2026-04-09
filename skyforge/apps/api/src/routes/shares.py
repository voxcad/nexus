import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_or_create_user
from src.db import get_db
from src.models import Deliverable, Project, Share, User
from src.services.gcs import get_signed_download_url

router = APIRouter()


class ShareCreate(BaseModel):
    project_id: uuid.UUID
    client_email: str | None = None
    expires_days: int = 30


EXTENSION_MAP = {
    "orthophoto": "tif",
    "dsm": "tif",
    "dtm": "tif",
    "point_cloud": "laz",
    "contours": "gpkg",
    "report": "pdf",
}


@router.post("/create")
async def create_share(
    body: ShareCreate,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a shareable link for a project's deliverables."""
    project = (
        await db.execute(
            select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    share = Share(
        project_id=project.id,
        token=secrets.token_urlsafe(32),
        client_email=body.client_email,
        expires_at=datetime.now(timezone.utc) + timedelta(days=body.expires_days),
    )
    db.add(share)
    await db.flush()

    return {
        "share_token": share.token,
        "share_url": f"https://skyforge.app/s/{share.token}",
        "expires_at": share.expires_at.isoformat(),
    }


@router.get("/{token}")
async def view_share(token: str, db: AsyncSession = Depends(get_db)) -> dict:
    """
    Public endpoint — client accesses deliverables via share token.
    No auth required. Returns project info + signed download URLs.
    """
    share = (await db.execute(select(Share).where(Share.token == token))).scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Share link has expired")

    # Track first view
    if not share.viewed_at:
        share.viewed_at = datetime.now(timezone.utc)

    project = (
        await db.execute(select(Project).where(Project.id == share.project_id))
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    deliverables = (
        await db.execute(select(Deliverable).where(Deliverable.project_id == share.project_id))
    ).scalars().all()

    deliverable_list = []
    for d in deliverables:
        ext = EXTENSION_MAP.get(d.type, "bin")
        try:
            download_url = get_signed_download_url(d.gcs_path, f"{d.type}.{ext}")
        except Exception:
            download_url = None

        deliverable_list.append({
            "id": str(d.id),
            "type": d.type,
            "download_url": download_url,
            "file_size_mb": round(d.file_size_bytes / 1024 / 1024, 1) if d.file_size_bytes else None,
            "ai_summary": d.gemini_summary,
            "created_at": d.created_at.isoformat(),
        })

    await db.commit()

    return {
        "project": {
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "photo_count": project.photo_count,
        },
        "deliverables": deliverable_list,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
    }
