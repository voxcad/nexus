import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import pubsub_v1
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_current_user_uid
from src.config import settings
from src.db import get_db
from src.models import Deliverable, DeliverableType, Job, JobStatus, JobType, Project, User

router = APIRouter()

publisher = pubsub_v1.PublisherClient() if settings.gcp_project_id else None


class JobCreate(BaseModel):
    project_id: uuid.UUID
    job_type: JobType = JobType.ODM


class JobResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    job_type: JobType
    status: JobStatus
    progress_pct: int
    error_log: str | None
    started_at: str | None
    completed_at: str | None


class DeliverableResponse(BaseModel):
    id: uuid.UUID
    type: DeliverableType
    cdn_url: str | None
    file_size_bytes: int
    gemini_summary: str | None


@router.post("/", response_model=JobResponse)
async def create_job(
    body: JobCreate,
    uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
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

    job = Job(
        project_id=project.id,
        job_type=body.job_type,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Publish to Cloud Pub/Sub
    if publisher and settings.gcp_project_id:
        topic_path = publisher.topic_path(settings.gcp_project_id, settings.pubsub_topic)
        message = json.dumps({
            "job_id": str(job.id),
            "project_id": str(project.id),
            "job_type": job.job_type,
            "gcs_raw_prefix": f"projects/{project.id}/raw",
            "gcs_output_prefix": f"projects/{project.id}/outputs",
        }).encode()
        future = publisher.publish(topic_path, message)
        job.pubsub_message_id = future.result()
        job.status = JobStatus.QUEUED
        project.status = "queued"
        await db.commit()
        await db.refresh(job)

    return _job_response(job)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_response(job)


@router.get("/{job_id}/deliverables", response_model=list[DeliverableResponse])
async def get_deliverables(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[DeliverableResponse]:
    deliverables = (
        await db.execute(select(Deliverable).where(Deliverable.job_id == job_id))
    ).scalars().all()
    return [
        DeliverableResponse(
            id=d.id,
            type=d.type,
            cdn_url=d.cdn_url,
            file_size_bytes=d.file_size_bytes,
            gemini_summary=d.gemini_summary,
        )
        for d in deliverables
    ]


class JobCallback(BaseModel):
    status: str
    progress_pct: int | None = None
    gce_instance_id: str | None = None
    error_log: str | None = None
    outputs: list[dict] | None = None


@router.post("/{job_id}/callback")
async def job_callback(
    job_id: uuid.UUID,
    body: JobCallback,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Internal callback from worker — updates job status and creates deliverables."""
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = body.status
    if body.progress_pct is not None:
        job.progress_pct = body.progress_pct
    if body.gce_instance_id:
        job.gce_instance_id = body.gce_instance_id
    if body.error_log:
        job.error_log = body.error_log

    if body.status == "processing" and not job.started_at:
        from datetime import datetime, timezone
        job.started_at = datetime.now(timezone.utc)

    if body.status in ("complete", "failed"):
        from datetime import datetime, timezone
        job.completed_at = datetime.now(timezone.utc)

    # Create deliverable records from worker output
    if body.outputs:
        for output in body.outputs:
            deliverable = Deliverable(
                project_id=job.project_id,
                job_id=job.id,
                type=output["output_type"],
                gcs_path=output["gcs_path"],
                cdn_url=output.get("cdn_url"),
                file_size_bytes=output.get("file_size_bytes", 0),
                gemini_summary=output.get("gemini_summary"),
            )
            db.add(deliverable)

    # Sync project status
    project = (
        await db.execute(select(Project).where(Project.id == job.project_id))
    ).scalar_one_or_none()
    if project:
        project.status = body.status

    await db.commit()
    return {"status": "ok"}


def _job_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        project_id=job.project_id,
        job_type=job.job_type,
        status=job.status,
        progress_pct=job.progress_pct,
        error_log=job.error_log,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
    )
