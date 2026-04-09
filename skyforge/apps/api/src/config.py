from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/skyforge"

    # GCP
    gcp_project_id: str = ""
    gcs_raw_bucket: str = "skyforge-raw"
    gcs_output_bucket: str = "skyforge-output"
    pubsub_topic: str = "skyforge-jobs"
    pubsub_subscription: str = "skyforge-jobs-sub"

    # GCE — ODM worker instances
    gce_zone: str = "us-central1-a"
    gce_machine_type: str = "n2-standard-8"  # 8 vCPU, 32GB RAM
    odm_docker_image: str = "opendronemap/odm:latest"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-pro"

    # Firebase
    firebase_project_id: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # App
    environment: str = "development"
    api_url: str = "http://localhost:8000"
    web_url: str = "http://localhost:3000"
    signed_url_expiry_minutes: int = 60
    share_token_expiry_days: int = 30
    worker_secret: str = ""

    model_config = {"env_prefix": "SKYFORGE_", "env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
