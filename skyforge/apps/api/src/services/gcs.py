import uuid
from datetime import timedelta

from google.cloud import storage

from src.config import settings

client = storage.Client(project=settings.gcp_project_id) if settings.gcp_project_id else None


def get_signed_upload_url(project_id: str, filename: str) -> dict:
    """Generate a signed URL for direct browser-to-GCS upload."""
    if not client:
        raise RuntimeError("GCS not configured")

    bucket = client.bucket(settings.gcs_raw_bucket)
    gcs_path = f"projects/{project_id}/{uuid.uuid4()}_{filename}"
    blob = bucket.blob(gcs_path)

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=settings.signed_url_expiry_minutes),
        method="PUT",
        content_type="image/jpeg",
    )

    return {
        "upload_url": url,
        "gcs_path": f"gs://{settings.gcs_raw_bucket}/{gcs_path}",
        "object_name": gcs_path,
    }


def get_signed_download_url(gcs_path: str, filename: str) -> str:
    """Generate a short-lived download URL for a processed deliverable."""
    if not client:
        raise RuntimeError("GCS not configured")

    object_name = gcs_path.replace(f"gs://{settings.gcs_output_bucket}/", "")
    bucket = client.bucket(settings.gcs_output_bucket)
    blob = bucket.blob(object_name)

    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(hours=2),
        method="GET",
        response_disposition=f'attachment; filename="{filename}"',
    )


def list_project_outputs(project_id: str) -> list[str]:
    """List all processed output files for a project."""
    if not client:
        return []
    bucket = client.bucket(settings.gcs_output_bucket)
    prefix = f"projects/{project_id}/outputs/"
    return [blob.name for blob in bucket.list_blobs(prefix=prefix)]


def delete_project_files(project_id: str) -> None:
    """Hard delete all GCS files for a project (GDPR / user request)."""
    if not client:
        return
    for bucket_name in [settings.gcs_raw_bucket, settings.gcs_output_bucket]:
        bucket = client.bucket(bucket_name)
        prefix = f"projects/{project_id}/"
        blobs = list(bucket.list_blobs(prefix=prefix))
        if blobs:
            bucket.delete_blobs(blobs)
