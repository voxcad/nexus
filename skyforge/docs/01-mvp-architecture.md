# MVP Architecture — Skyforge

> Drone photos in, deliverables out. GCP-native.

---

## System Overview (matches architecture diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT                                                              │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Next.js app     │  │  Mobile web      │  │  Firebase Auth   │  │
│  │  Cloud Run       │  │  PWA             │  │  JWT · Google    │  │
│  │  upload UI       │  │  field upload    │  │  SSO             │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                      │            │
└───────────┼─────────────────────┼──────────────────────┼────────────┘
            │                     │                      │
            ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API                                                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               FastAPI · Cloud Run                            │   │
│  │       projects · uploads · jobs · webhooks · auth            │   │
│  └──────┬──────────────────┬──────────────────┬─────────────────┘   │
│         │                  │                  │                     │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DATA                                                                │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  GCS raw bucket  │  │  Cloud SQL       │  │  Cloud Pub/Sub   │  │
│  │  JPG/RAW         │  │  PostgreSQL      │  │  job-queue topic │  │
│  │  signed URLs     │  │  PostGIS         │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └────────┬─────────┘  │
│                                                       │            │
└───────────────────────────────────────────────────────┼────────────┘
                                                        │
          ┌─────────────────────────────────────────────┤
          ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ WORKERS                                                             │
│                                                                     │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐  │
│  │  ODM worker              │  │  Gemini Vision                 │  │
│  │  GCE Spot VM · Docker    │  │  change detection · classify   │  │
│  │  auto-scale              │  │  report gen                    │  │
│  └──────────┬───────────────┘  └────────────┬───────────────────┘  │
│             │                               │                      │
└─────────────┼───────────────────────────────┼──────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ OUTPUT                                                              │
│                                                                     │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐  │
│  │  GCS output bucket       │  │  Client portal                 │  │
│  │  COG · DTM · DXF         │  │  MapLibre viewer · PDF         │  │
│  │  Cloud CDN               │  │  share link · Stripe           │  │
│  └──────────────────────────┘  └────────────────────────────────┘  │
│                                                                     │
│                                          ┌──────────────────┐      │
│                                          │     Stripe       │      │
│                                          └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
1. USER UPLOADS
   Drone photos (JPEG/TIFF/RAW) + optional GCPs
        │
        ▼
2. API (FastAPI on Cloud Run)
   Auth via Firebase JWT → creates project → generates signed GCS URLs
        │
        ▼
3. GCS RAW BUCKET
   Browser uploads directly via signed URLs
   gs://skyforge-raw/projects/{project_id}/raw/{filename}
        │
        ▼
4. CLOUD PUB/SUB
   API publishes job message with project_id, quality preset, paths
        │
        ├───────────────────────┐
        ▼                       ▼
5a. ODM WORKER               5b. GEMINI VISION (Phase 2)
    GCE Spot VM                   Change detection
    Pulls from Pub/Sub            Land classification
    Downloads raw → ODM           AI report generation
    Outputs ortho/DSM/DTM
        │                         │
        ▼                         ▼
6. GCS OUTPUT BUCKET
   gs://skyforge-output/projects/{project_id}/outputs/
     ├── orthophoto.tif (Cloud Optimized GeoTIFF)
     ├── dsm.tif
     ├── dtm.tif
     ├── contours.gpkg
     ├── point_cloud.laz
     └── report.pdf
        │
        ▼
7. NOTIFICATION
   API updates Cloud SQL → webhook/email → user notified
        │
        ▼
8. CLIENT PORTAL
   MapLibre loads COG tiles via Cloud CDN
   User views, downloads, shares via unique link
   Stripe handles per-project billing
```

---

## GCP Services Map

| Layer | Service | Purpose |
|-------|---------|---------|
| **Client** | Cloud Run (Next.js) | Web frontend, SSR |
| **Client** | Firebase Auth | JWT tokens, Google SSO |
| **API** | Cloud Run (FastAPI) | REST API, business logic |
| **Data** | Cloud SQL (PostgreSQL + PostGIS) | Projects, jobs, users, spatial queries |
| **Data** | Cloud Storage (GCS) | Raw uploads + processed outputs |
| **Data** | Cloud Pub/Sub | Job queue, async worker dispatch |
| **Workers** | GCE Spot VMs | OpenDroneMap processing (auto-scale) |
| **Workers** | Gemini Vision API | AI analysis (Phase 2) |
| **Output** | Cloud CDN | Fast tile delivery for viewer |
| **Billing** | Stripe | Per-project payments |

---

## MVP Scope

**Build this. Nothing else.**

| Component | MVP Scope | Skip for Now |
|-----------|-----------|--------------|
| **Upload** | Web drag-and-drop, signed URL upload | Mobile PWA |
| **Storage** | GCS raw + output buckets | Cloud CDN (add when traffic justifies) |
| **Processing** | ODM on GCE Spot | Gemini Vision (Phase 2) |
| **Outputs** | Ortho + DSM + DTM + contours | AI analysis, DXF export |
| **Viewer** | MapLibre web map embed | 3D point cloud viewer |
| **Delivery** | Download link + shareable URL | Full client portal login |
| **Billing** | Stripe per-project | Subscription tiers |
| **Auth** | Firebase (email + Google SSO) | Org management, roles |

---

## Tech Stack

```
Frontend     Next.js 15 + MapLibre GL JS + Tailwind CSS 4
Backend      Python 3.12 + FastAPI + SQLAlchemy + GeoAlchemy2
Processing   OpenDroneMap (Docker on GCE Spot VMs)
Queue        Google Cloud Pub/Sub
Storage      Google Cloud Storage (GCS)
Database     Cloud SQL (PostgreSQL 16 + PostGIS)
Auth         Firebase Auth (JWT + Google SSO)
Payments     Stripe (per-project checkout)
AI (Phase 2) Google Gemini Vision API
CDN          Cloud CDN (on output bucket)
Deploy       Cloud Run (API + Web), GCE (workers)
```
