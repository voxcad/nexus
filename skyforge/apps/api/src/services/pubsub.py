import json

from google.cloud import pubsub_v1

from src.config import settings

publisher = pubsub_v1.PublisherClient() if settings.gcp_project_id else None


def _topic_path() -> str:
    if not publisher:
        raise RuntimeError("Pub/Sub not configured")
    return publisher.topic_path(settings.gcp_project_id, settings.pubsub_topic)


def publish_odm_job(project_id: str, job_id: str, job_type: str = "odm") -> str:
    """Publish a processing job to Pub/Sub. Returns message ID."""
    message_data = {
        "project_id": str(project_id),
        "job_id": str(job_id),
        "job_type": job_type,
        "gcs_raw_bucket": settings.gcs_raw_bucket,
        "gcs_output_bucket": settings.gcs_output_bucket,
    }

    future = publisher.publish(
        _topic_path(),
        data=json.dumps(message_data).encode("utf-8"),
        project_id=str(project_id),
        job_type=job_type,
    )
    return future.result()


def publish_gemini_job(project_id: str, job_id: str, orthomosaic_gcs_path: str) -> str:
    """Publish an AI analysis job after ODM completes."""
    message_data = {
        "project_id": str(project_id),
        "job_id": str(job_id),
        "job_type": "gemini_vision",
        "orthomosaic_gcs_path": orthomosaic_gcs_path,
    }

    future = publisher.publish(
        _topic_path(),
        data=json.dumps(message_data).encode("utf-8"),
        job_type="gemini_vision",
    )
    return future.result()
