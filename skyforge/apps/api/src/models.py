import uuid
from datetime import datetime
from enum import StrEnum

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# --- Enums ---


class PlanTier(StrEnum):
    FREE = "free"
    PAY_AS_YOU_GO = "pay_as_you_go"
    PRO = "pro"
    AGENCY = "agency"


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    UPLOADING = "uploading"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class JobType(StrEnum):
    ODM = "odm"
    GEMINI_VISION = "gemini_vision"


class JobStatus(StrEnum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class DeliverableType(StrEnum):
    ORTHOPHOTO = "orthophoto"
    DSM = "dsm"
    DTM = "dtm"
    CONTOURS = "contours"
    POINT_CLOUD = "point_cloud"
    REPORT = "report"


# --- Tables ---


class User(Base):
    """users — owns projects, clients"""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(Text, unique=True, index=True)
    email: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str | None] = mapped_column(Text)
    stripe_customer_id: Mapped[str | None] = mapped_column(Text)
    plan: Mapped[PlanTier] = mapped_column(String(20), default=PlanTier.FREE)
    credits_remaining: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projects: Mapped[list["Project"]] = relationship(back_populates="user")


class Project(Base):
    """projects — has uploads, jobs, deliverables"""
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    boundary: Mapped[None] = mapped_column(Geometry("POLYGON", srid=4326), nullable=True)
    photo_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ProjectStatus] = mapped_column(String(20), default=ProjectStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="projects")
    uploads: Mapped[list["Upload"]] = relationship(back_populates="project")
    jobs: Mapped[list["Job"]] = relationship(back_populates="project")
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="project")
    shares: Mapped[list["Share"]] = relationship(back_populates="project")


class Upload(Base):
    """uploads — belongs to project"""
    __tablename__ = "uploads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    gcs_path: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(Text)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    gps_location: Mapped[None] = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    altitude_m: Mapped[float | None] = mapped_column(Float)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="uploads")


class Job(Base):
    """jobs — produces deliverables"""
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    job_type: Mapped[JobType] = mapped_column(String(20), default=JobType.ODM)
    status: Mapped[JobStatus] = mapped_column(String(20), default=JobStatus.PENDING)
    pubsub_message_id: Mapped[str | None] = mapped_column(Text)
    gce_instance_id: Mapped[str | None] = mapped_column(Text)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    error_log: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project"] = relationship(back_populates="jobs")
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="job")


class Deliverable(Base):
    """deliverables — served via shares"""
    __tablename__ = "deliverables"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id"))
    type: Mapped[DeliverableType] = mapped_column(String(20))
    gcs_path: Mapped[str] = mapped_column(Text)
    cdn_url: Mapped[str | None] = mapped_column(Text)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    gemini_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="deliverables")
    job: Mapped["Job"] = relationship(back_populates="deliverables")


class Share(Base):
    """shares — client portal access"""
    __tablename__ = "shares"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    token: Mapped[str] = mapped_column(Text, unique=True, index=True)
    client_email: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_hash: Mapped[str | None] = mapped_column(Text)
    viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="shares")
