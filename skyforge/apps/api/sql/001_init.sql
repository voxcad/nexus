-- Skyforge Database Schema — 6 tables
-- PostgreSQL 16 + PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE plan_tier AS ENUM ('free', 'pay_as_you_go', 'pro', 'agency');
CREATE TYPE project_status AS ENUM ('draft', 'uploading', 'queued', 'processing', 'complete', 'failed');
CREATE TYPE job_type AS ENUM ('odm', 'gemini_vision');
CREATE TYPE job_status AS ENUM ('pending', 'queued', 'processing', 'complete', 'failed');
CREATE TYPE deliverable_type AS ENUM ('orthophoto', 'dsm', 'dtm', 'contours', 'point_cloud', 'report');

-- 1. users — owns projects, clients
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid    text NOT NULL UNIQUE,
    email           text NOT NULL,
    full_name       text,
    stripe_customer_id text,
    plan            plan_tier NOT NULL DEFAULT 'free',
    credits_remaining integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);

-- 2. projects — has uploads, jobs, deliverables
CREATE TABLE projects (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    boundary        geometry(Polygon, 4326),
    photo_count     integer NOT NULL DEFAULT 0,
    status          project_status NOT NULL DEFAULT 'draft',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects (user_id);
CREATE INDEX idx_projects_boundary ON projects USING GIST (boundary);

-- 3. uploads — belongs to project
CREATE TABLE uploads (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    gcs_path        text NOT NULL,
    filename        text NOT NULL,
    file_size_bytes bigint NOT NULL,
    gps_location    geometry(Point, 4326),
    altitude_m      float,
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uploads_project_id ON uploads (project_id);
CREATE INDEX idx_uploads_gps ON uploads USING GIST (gps_location);

-- 4. jobs — produces deliverables
CREATE TABLE jobs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_type        job_type NOT NULL DEFAULT 'odm',
    status          job_status NOT NULL DEFAULT 'pending',
    pubsub_message_id text,
    gce_instance_id text,
    progress_pct    integer NOT NULL DEFAULT 0,
    error_log       text,
    started_at      timestamptz,
    completed_at    timestamptz
);

CREATE INDEX idx_jobs_project_id ON jobs (project_id);
CREATE INDEX idx_jobs_status ON jobs (status);

-- 5. deliverables — served via shares
CREATE TABLE deliverables (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    type            deliverable_type NOT NULL,
    gcs_path        text NOT NULL,
    cdn_url         text,
    file_size_bytes bigint NOT NULL,
    gemini_summary  text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliverables_project_id ON deliverables (project_id);
CREATE INDEX idx_deliverables_job_id ON deliverables (job_id);

-- 6. shares — client portal access
CREATE TABLE shares (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token           text NOT NULL UNIQUE,
    client_email    text,
    expires_at      timestamptz,
    password_hash   text,
    viewed_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_token ON shares (token);
CREATE INDEX idx_shares_project_id ON shares (project_id);
