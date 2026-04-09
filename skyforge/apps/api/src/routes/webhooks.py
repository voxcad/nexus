import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db import get_db
from src.models import Deliverable, DeliverableType, Job, JobStatus, Project, User
from src.services.pubsub import publish_gemini_job

router = APIRouter()
logger = logging.getLogger(__name__)

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


# -- ODM Worker Callbacks --


@router.post("/odm/progress")
async def odm_progress(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Called by GCE ODM worker to report progress."""
    body = await request.json()
    job_id = body.get("job_id")

    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        return {"ok": False, "error": "Job not found"}

    job.progress_pct = body.get("progress_pct", 0)
    if body.get("status") == "running" and not job.started_at:
        job.started_at = datetime.now(timezone.utc)
        job.status = JobStatus.PROCESSING

        project = (await db.execute(select(Project).where(Project.id == job.project_id))).scalar_one_or_none()
        if project:
            project.status = "processing"

    await db.commit()
    return {"ok": True}


@router.post("/odm/complete")
async def odm_complete(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Called by ODM worker when processing is done. Triggers Gemini analysis."""
    body = await request.json()
    job_id = body.get("job_id")
    outputs = body.get("outputs", [])

    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        return {"ok": False, "error": "Job not found"}

    job.status = JobStatus.COMPLETE
    job.progress_pct = 100
    job.completed_at = datetime.now(timezone.utc)

    orthomosaic_path = None

    for output in outputs:
        d = Deliverable(
            project_id=job.project_id,
            job_id=job.id,
            type=DeliverableType(output["type"]),
            gcs_path=output["gcs_path"],
            file_size_bytes=output.get("file_size_bytes", 0),
        )
        db.add(d)
        if output["type"] == "orthophoto":
            orthomosaic_path = output["gcs_path"]

    project = (await db.execute(select(Project).where(Project.id == job.project_id))).scalar_one_or_none()
    if project:
        project.status = "complete"

    await db.flush()

    # Trigger Gemini analysis if orthomosaic exists
    if orthomosaic_path:
        gemini_job = Job(
            project_id=job.project_id,
            job_type="gemini_vision",
            status=JobStatus.PENDING,
        )
        db.add(gemini_job)
        await db.flush()
        try:
            msg_id = publish_gemini_job(str(job.project_id), str(gemini_job.id), orthomosaic_path)
            gemini_job.pubsub_message_id = msg_id
            gemini_job.status = JobStatus.QUEUED
        except Exception:
            logger.warning("Failed to publish Gemini job — Pub/Sub may not be configured")

    await db.commit()
    logger.info(f"ODM job {job_id} complete — {len(outputs)} deliverables stored")
    return {"ok": True, "deliverables": len(outputs)}


@router.post("/odm/failed")
async def odm_failed(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Called by ODM worker on processing failure."""
    body = await request.json()
    job = (await db.execute(select(Job).where(Job.id == body.get("job_id")))).scalar_one_or_none()
    if job:
        job.status = JobStatus.FAILED
        job.error_log = body.get("error", "Unknown error")
        job.completed_at = datetime.now(timezone.utc)

        project = (await db.execute(select(Project).where(Project.id == job.project_id))).scalar_one_or_none()
        if project:
            project.status = "failed"

        await db.commit()
    return {"ok": True}


# -- Stripe Webhook --


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Handle Stripe webhook events for billing."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if not sig or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=400, detail="Missing signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        customer_id = session.get("customer")
        credits = int(session["metadata"].get("credits", 0))
        plan = session["metadata"].get("plan")

        user = (
            await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        ).scalar_one_or_none()
        if user:
            if credits:
                user.credits_remaining += credits
            if plan:
                user.plan = plan

    elif event["type"] == "customer.subscription.deleted":
        customer_id = event["data"]["object"]["customer"]
        user = (
            await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        ).scalar_one_or_none()
        if user:
            user.plan = "free"
            user.credits_remaining = 1

    await db.commit()
    return {"received": True}
