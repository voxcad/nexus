import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_or_create_user
from src.db import get_db
from src.models import Job, JobStatus, JobType, Project, ProjectStatus, User
from src.services.gcs import delete_project_files
from src.services.pubsub import publish_odm_job

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    photo_count: int
    status: ProjectStatus
    created_at: str


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    if user.credits_remaining <= 0:
        raise HTTPException(status_code=402, detail="No credits remaining")

    project = Project(user_id=user.id, name=body.name, description=body.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _response(project)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    result = await db.execute(
        select(Project).where(Project.user_id == user.id).order_by(Project.created_at.desc())
    )
    return [_response(p) for p in result.scalars().all()]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    project = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _response(project)


@router.post("/{project_id}/process")
async def trigger_processing(
    project_id: uuid.UUID,
    job_type: str = "odm",
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Trigger ODM processing for a project."""
    project = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.photo_count == 0:
        raise HTTPException(status_code=400, detail="No photos uploaded")

    if project.status in (ProjectStatus.QUEUED, ProjectStatus.PROCESSING):
        raise HTTPException(status_code=409, detail="Processing already in progress")

    job = Job(project_id=project.id, job_type=JobType(job_type), status=JobStatus.PENDING)
    db.add(job)
    await db.flush()

    try:
        msg_id = publish_odm_job(str(project.id), str(job.id), job_type)
        job.pubsub_message_id = msg_id
        job.status = JobStatus.QUEUED
        project.status = ProjectStatus.QUEUED
    except Exception:
        job.status = JobStatus.PENDING

    await db.commit()

    return {"job_id": str(job.id), "status": job.status, "message": "Processing queued"}


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete project and all associated GCS files."""
    project = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        delete_project_files(str(project.id))
    except Exception:
        pass  # GCS may not be configured in dev

    await db.delete(project)
    await db.commit()


def _response(p: Project) -> ProjectResponse:
    return ProjectResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        photo_count=p.photo_count,
        status=p.status,
        created_at=p.created_at.isoformat(),
    )
