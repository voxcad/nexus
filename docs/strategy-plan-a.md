# Strategy Plan A — AEC/Geospatial Software Business Opportunity

> Source: Brainstorming session exploring what a software developer with geomatic engineering background can bring to the AEC/Geospatial industry in 2026.

---

## The Premise

The AEC + Geospatial industry is undergoing a massive tech transformation but is still heavily underserved by modern software practices. A developer with **geomatic engineering domain knowledge + 10 years full-stack/AI/DevOps experience** has a rare unfair advantage: understands the PAIN and can BUILD the CURE.

---

## Industry Landscape Assessed

### Autodesk (Civil / Survey / Architecture)
| Product | Purpose |
|---------|---------|
| AutoCAD Civil 3D | Road design, grading, drainage, pipe networks, land development |
| InfraWorks | Conceptual infrastructure modeling in GIS-based 3D |
| Revit | BIM — flagship for architectural design, structure, MEP |
| AutoCAD Architecture | Architecture-specific AutoCAD |
| ReCap Pro | Reality capture — processes drone/LiDAR to 3D point clouds |
| AutoCAD Map 3D | GIS-integrated mapping and survey data management |
| Autodesk Construction Cloud | Project management and collaboration |
| Navisworks | Multi-discipline clash detection |

### GIS & Remote Sensing Vendors
| Company | Strength |
|---------|----------|
| **ESRI** | GIS analysis, enterprise platform, industry standard (ArcGIS Pro, Online, Enterprise) |
| **Hexagon** | Remote sensing, image processing (ERDAS IMAGINE, GeoMedia) |
| **Trimble** | Survey, GNSS, OBIA, field-to-office (TBC, Ecognition, Inpho) |
| **Bentley Systems** | Infrastructure + reality capture (ContextCapture, OpenCities) |
| **Planet / Maxar** | Satellite imagery data providers |
| **OSGeo** | Free/open-source (QGIS, GRASS GIS, SAGA GIS) |
| **Google / Microsoft** | Cloud-scale geospatial AI (Earth Engine, Planetary Computer) |

---

## Six Paradigm Waves Identified

### Wave 1: Geo-AI Convergence
- AI matured in text/image, now hitting geospatial hard
- Old: manually digitize, expert interprets, analyst writes queries
- New: foundation models auto-extract, AI monitors 24/7, NL → spatial analysis
- **Gap:** Very few companies translating AI breakthroughs into domain-specific geospatial tools

### Wave 2: Democratization of Space Data
- Satellite imagery approaching free (Sentinel, Landsat, Planet API)
- SAR, hyperspectral becoming affordable
- **Gap:** Data is abundant. Interpretation pipelines are not. Business is in processing, not raw pixels.

### Wave 3: Digital Twins Going Mainstream
- Evolving from static 3D models → living, sensor-fed, AI-driven simulations
- Phase 1 (past): pretty 3D visualization
- Phase 2 (now): BIM + GIS + IoT → real-time dashboard
- Phase 3 (coming): AI predicts failures, simulates scenarios, auto-updates
- **Gap:** Integration layer between BIM, GIS, IoT, and web dashboards is a massive unsolved problem

### Wave 4: Death of the Desktop GIS
- ESRI, Hexagon, Autodesk all built for desktop era — cloud/web era just starting
- Cloud-native geospatial (STAC, COG, Zarr, GeoParquet) making this possible
- **Gap:** "Figma for GIS" — the collaborative, real-time, browser-based generation of tools hasn't arrived yet

### Wave 5: Drone Economy Scaling Up
- Regulations loosening, DaaS proliferating
- Bottleneck moved from flying to processing and acting on data
- **Gap:** Most drone companies are great at hardware. Data-to-insight software layer is wide open.

### Wave 6: Climate Tech + Geospatial
- Carbon credits require verified geospatial proof
- Governments mandating climate risk disclosure
- Insurance needs hyper-local risk modeling
- **Gap:** Carbon/climate markets desperate for credible, tech-enabled verification tools

---

## Top 5 Product Opportunities (Ranked)

### #1 — AI-Powered Field Survey Report Generator
- **Pain:** Surveyors spend hours post-fieldwork on reports, formatting, plans
- **Build:** Upload field notes/coords/photos → AI generates formatted survey report + DXF/CAD
- **Stack:** Next.js, Claude API, PostGIS, GDAL, PDF generation, DXF output
- **Revenue:** $49–$199/month per surveyor
- **Time to MVP:** 6–10 weeks

### #2 — Drone Data → Deliverables SaaS ⭐ (CHOSEN)
- **Pain:** Drone operators → manual processing in Pix4D/Agisoft (expensive, desktop, slow)
- **Build:** Upload drone photos → cloud auto-processes → Ortho, DSM, DTM, volumes, contours + client portal
- **Stack:** OpenDroneMap, Node/Python, React, AWS S3/EC2, MapLibre
- **Revenue:** $99–$499/month or per-project ($15/project)
- **Time to MVP:** 8–12 weeks

### #3 — "ChatGIS" — Natural Language Interface to Spatial Data
- **Pain:** Only GIS experts can query geodatabases. Decision makers can't self-serve.
- **Build:** Connect to PostGIS/Shapefile → NL query → AI translates to spatial SQL → web map result
- **Stack:** Claude API (tool use), PostGIS, MapLibre, Next.js
- **Revenue:** $299–$999/month per organization
- **Time to MVP:** 6–8 weeks

### #4 — BIM-GIS Sync Middleware / API
- **Pain:** Revit/Civil 3D and ArcGIS never sync. Manual export/convert/reimport constantly.
- **Build:** API that syncs IFC/Civil3D data → GeoJSON → ArcGIS/PostGIS automatically
- **Stack:** Autodesk APS API, ArcGIS REST API, Node.js, PostGIS
- **Revenue:** $499–$2000/month per firm
- **Time to MVP:** 10–14 weeks

### #5 — Climate / Flood Risk Parcel Scoring API
- **Pain:** Hyper-local climate risk scores are either too expensive or too crude
- **Build:** API returns flood risk score, elevation context, historical inundation per parcel
- **Stack:** Python, GDAL, Rasterio, FastAPI, PostGIS, AWS Lambda
- **Revenue:** API credits $0.01–$0.10/lookup or SaaS tiers
- **Time to MVP:** 10–16 weeks

---

## Chosen Path: #2 Drone Data → Deliverables SaaS

### Architecture (MVP)
```
User Upload (Web) → AWS S3 → Job Queue (Redis/SQS)
    → ODM Worker (EC2 Spot) → Process → Output to S3
        → Ortho, DSM, DTM, Contours
    → MapLibre Viewer (Web) → Shareable Client Link
    → Stripe Billing (Per-Project)
```

### Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | Next.js + MapLibre GL JS + Tailwind |
| Backend | Node.js (Express/Fastify) or Python FastAPI |
| Processing | OpenDroneMap (Docker on AWS EC2 spot) |
| Queue | Redis (BullMQ) or AWS SQS |
| Storage | AWS S3 |
| Database | PostgreSQL + PostGIS |
| Auth | Clerk or NextAuth |
| Payments | Stripe (per-project credits) |
| Deploy | AWS (EC2 for ODM), Vercel/Railway for API |

### MVP Scope (Build Only This)
| Component | MVP Scope | Skip for Now |
|-----------|-----------|--------------|
| Upload | Web drag-and-drop | Mobile app |
| Storage | S3 raw bucket + job queue | Complex CDN |
| Processing | Self-hosted ODM on EC2 | Custom photogrammetry |
| Outputs | Ortho + DSM + basic contours | AI analysis |
| Viewer | MapLibre web map embed | 3D point cloud viewer |
| Delivery | Download link + shareable URL | Full client portal |
| Billing | Stripe per-project | Subscription tiers |

### Pricing Model
| Tier | Price | Target |
|------|-------|--------|
| Starter | Free — 1 project/month (≤200 photos) | Get users in door |
| Pro | $99/month — 10 projects/month | Small drone operators |
| Agency | $299/month — unlimited + white-label portal | Survey firms |
| Pay-as-you-go | $15/project | Occasional users |

### 12-Week Build Roadmap
| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| 0 — Validate | 1–2 | Talk to 10 users. Confirm pain. Don't build. |
| 1 — Core pipeline | 3–6 | Upload → S3 → ODM worker → output files |
| 2 — Viewer + delivery | 7–8 | MapLibre viewer + shareable client link |
| 3 — Billing + auth | 9–10 | Stripe per-project, user accounts, dashboard |
| 4 — First paying users | 11–12 | Onboard 3 beta users, charge real money |

### User Interview Script (Pre-Build Validation)
**Target:** 10 drone operators / survey firms / civil engineers

**Key Questions:**
1. Walk me through what happens after your drone lands — step by step until client gets deliverable
2. How long does that take? Where does most time go?
3. What software do you use? What do you hate about it?
4. What's the most frustrating part of processing drone data?
5. Have you lost a client or deadline because of the processing bottleneck?
6. What does your client actually receive? Format? Access method?
7. What do you pay for software (Pix4D, Agisoft, etc.)?
8. If a tool cut processing time in half, what would that be worth per month?
9. Have you tried cloud-based alternatives? What happened?
10. What would make you switch?

**Listen for:** "takes forever", "manual", "clients keep asking for", "I have to export then import then..."

---

## The Meta-Insight

> The geospatial/AEC industry spent 30 years building tools for experts with desktop software. The next 10 years will be about building tools for **non-experts, on the cloud, powered by AI** — where the map becomes an interface, not just a product.

> You don't need to compete with ESRI or Autodesk. Pick one vertical, one workflow, one painful problem — and solve it with modern software thinking that legacy vendors are too slow to adopt.

---

## 90-Day Side Hustle Roadmap
| Week | Action |
|------|--------|
| 1–2 | Talk to 10 surveyors/engineers. Validate the pain. Don't build yet. |
| 3–4 | Sketch workflow. Build rough prototype (no auth, no payment). |
| 5–8 | Build MVP — core feature only. One input, one output. |
| 9–10 | Give to 3 users free. Watch how they use it. |
| 11–12 | Charge the first dollar. Even $1 validates everything. |

**First milestone:** Getting one stranger to pay $15 to process their drone photos.
