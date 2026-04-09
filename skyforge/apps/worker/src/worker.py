"""
Skyforge ODM Worker

Runs on GCE Spot VM. Subscribes to Cloud Pub/Sub, pulls processing jobs,
runs OpenDroneMap (Docker), uploads outputs to GCS, calls back the API.
Auto-shuts down when idle (Spot VM cost control).
"""

import json
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path

import httpx
from google.cloud import pubsub_v1, storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("odm-worker")

# Config from env
GCP_PROJECT = os.environ["SKYFORGE_GCP_PROJECT_ID"]
SUBSCRIPTION = os.environ["SKYFORGE_PUBSUB_SUBSCRIPTION"]
GCS_RAW_BUCKET = os.environ["SKYFORGE_GCS_RAW_BUCKET"]
GCS_OUTPUT_BUCKET = os.environ["SKYFORGE_GCS_OUTPUT_BUCKET"]
API_CALLBACK_URL = os.environ["SKYFORGE_API_URL"]
WORKER_SECRET = os.environ.get("SKYFORGE_WORKER_SECRET", "")

gcs_client = storage.Client(project=GCP_PROJECT)
subscriber = pubsub_v1.SubscriberClient()
sub_path = subscriber.subscription_path(GCP_PROJECT, SUBSCRIPTION)


def download_project_images(project_id: str, workdir: Path) -> int:
    """Download all raw images from GCS into workdir/images/."""
    images_dir = workdir / "images"
    images_dir.mkdir(exist_ok=True)

    bucket = gcs_client.bucket(GCS_RAW_BUCKET)
    prefix = f"projects/{project_id}/"
    blobs = list(bucket.list_blobs(prefix=prefix))

    if not blobs:
        raise ValueError(f"No images found for project {project_id}")

    for blob in blobs:
        if blob.name.endswith("/"):
            continue
        dest = images_dir / Path(blob.name).name
        blob.download_to_filename(str(dest))

    count = len([f for f in images_dir.iterdir() if f.is_file()])
    log.info(f"Downloaded {count} images")
    return count


def run_odm(workdir: Path, job_type: str) -> Path:
    """Run OpenDroneMap via Docker."""
    cmd = [
        "docker", "run", "--rm",
        "-v", f"{workdir}:/datasets/project",
        "opendronemap/odm:latest",
        "--project-path", "/datasets",
        "project",
        "--orthophoto-resolution", "5",
        "--dsm", "--dtm",
        "--pc-quality", "medium",
        "--auto-boundary",
        "--cog",
    ]
    if job_type == "fast":
        cmd.append("--fast-orthophoto")

    log.info(f"Running ODM: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)

    if result.returncode != 0:
        raise RuntimeError(f"ODM failed:\n{result.stderr[-2000:]}")

    return workdir


def upload_outputs(project_id: str, job_id: str, workdir: Path) -> list[dict]:
    """Upload ODM outputs to GCS output bucket."""
    bucket = gcs_client.bucket(GCS_OUTPUT_BUCKET)
    outputs: list[dict] = []

    output_map = [
        (workdir / "odm_orthophoto" / "odm_orthophoto.tif", "orthophoto"),
        (workdir / "odm_dem" / "dsm.tif", "dsm"),
        (workdir / "odm_dem" / "dtm.tif", "dtm"),
        (workdir / "odm_georeferencing" / "odm_georeferenced_model.laz", "point_cloud"),
    ]

    for local_path, deliverable_type in output_map:
        if not local_path.exists():
            log.warning(f"Expected output not found: {local_path}")
            continue

        gcs_object = f"projects/{project_id}/outputs/{job_id}/{deliverable_type}{local_path.suffix}"
        blob = bucket.blob(gcs_object)
        blob.upload_from_filename(str(local_path))

        outputs.append({
            "type": deliverable_type,
            "gcs_path": f"gs://{GCS_OUTPUT_BUCKET}/{gcs_object}",
            "file_size_bytes": local_path.stat().st_size,
        })
        log.info(f"Uploaded {deliverable_type} → {gcs_object}")

    return outputs


def callback_api(endpoint: str, payload: dict) -> None:
    """Call the Skyforge API webhook endpoint."""
    url = f"{API_CALLBACK_URL}/webhooks/odm/{endpoint}"
    httpx.post(
        url,
        json=payload,
        headers={"X-Worker-Secret": WORKER_SECRET},
        timeout=30,
    )


def process_job(message_data: dict) -> None:
    """Process a single drone mapping job end-to-end."""
    project_id = message_data["project_id"]
    job_id = message_data["job_id"]
    job_type = message_data.get("job_type", "odm")

    log.info(f"Processing job {job_id} for project {project_id} ({job_type})")
    callback_api("progress", {"job_id": job_id, "status": "running", "progress_pct": 5})

    with tempfile.TemporaryDirectory() as tmpdir:
        workdir = Path(tmpdir)

        count = download_project_images(project_id, workdir)
        callback_api("progress", {"job_id": job_id, "status": "running", "progress_pct": 20})

        run_odm(workdir, job_type)
        callback_api("progress", {"job_id": job_id, "status": "running", "progress_pct": 80})

        outputs = upload_outputs(project_id, job_id, workdir)
        callback_api("progress", {"job_id": job_id, "status": "running", "progress_pct": 95})

    callback_api("complete", {"job_id": job_id, "outputs": outputs})
    log.info(f"Job {job_id} complete — {len(outputs)} outputs")


def main() -> None:
    """Main loop — pull from Pub/Sub, process, auto-shutdown when idle."""
    log.info(f"ODM Worker started. Listening on {sub_path}")
    idle_count = 0

    while True:
        response = subscriber.pull(
            request={"subscription": sub_path, "max_messages": 1},
            timeout=30,
        )

        if not response.received_messages:
            idle_count += 1
            log.info(f"No messages. Idle count: {idle_count}")
            # Auto-shutdown after 10 minutes idle (saves Spot VM cost)
            if idle_count >= 20:
                log.info("Idle timeout. Shutting down VM.")
                subprocess.run(["sudo", "shutdown", "-h", "now"])
            time.sleep(30)
            continue

        idle_count = 0

        for msg in response.received_messages:
            ack_id = msg.ack_id
            try:
                data = json.loads(msg.message.data.decode("utf-8"))
                process_job(data)
                subscriber.acknowledge(
                    request={"subscription": sub_path, "ack_ids": [ack_id]}
                )
            except Exception as e:
                log.error(f"Job failed: {e}", exc_info=True)
                try:
                    callback_api("failed", {
                        "job_id": data.get("job_id", "unknown"),
                        "error": str(e),
                    })
                except Exception:
                    pass
                subscriber.modify_ack_deadline(
                    request={"subscription": sub_path, "ack_ids": [ack_id], "ack_deadline_seconds": 0}
                )


if __name__ == "__main__":
    main()
