# 12-Week Build Roadmap

> Start date: TBD (after validation phase)
> First milestone: One stranger pays $15 to process their drone photos.

---

## Phase 0 — Validate (Weeks 1–2)

**Goal:** Confirm the pain exists and people will pay.

- [ ] Conduct 10 user interviews (see 00-interview-plan.md)
- [ ] Document findings and patterns
- [ ] GO / PIVOT / KILL decision
- [ ] If GO: refine MVP scope based on interview insights

**Deliverable:** Written validation summary with go/no-go decision.

---

## Phase 1 — Core Pipeline (Weeks 3–6)

**Goal:** Upload drone photos → get processed outputs.

### Week 3–4: Infrastructure
- [ ] Monorepo setup (pnpm workspaces)
- [ ] AWS account setup (S3 buckets, EC2 launch template, IAM roles)
- [ ] PostgreSQL + PostGIS database schema
- [ ] Redis queue setup
- [ ] OpenDroneMap Docker image tested locally
- [ ] Presigned URL upload flow (API → S3)

### Week 5–6: Processing Pipeline
- [ ] Worker service: poll queue → pull images from S3 → run ODM → push outputs to S3
- [ ] EC2 spot instance lifecycle (launch on job, terminate on idle)
- [ ] Job status tracking (queued → processing → complete → failed)
- [ ] Output conversion to Cloud Optimized GeoTIFF
- [ ] Basic contour generation from DTM
- [ ] Email notification on completion

**Deliverable:** End-to-end pipeline working. Upload 200 photos, get ortho + DSM + DTM back.

---

## Phase 2 — Viewer + Delivery (Weeks 7–8)

**Goal:** Users can see and share results in browser.

- [ ] MapLibre GL JS map viewer
- [ ] COG tile serving (Titiler or custom endpoint)
- [ ] Layer toggle: orthophoto / DSM / DTM / contours
- [ ] Download buttons for each output
- [ ] Shareable public URL (unique token, no auth needed)
- [ ] Basic measurement tools (distance, area)
- [ ] Processing report (PDF with quality metrics)

**Deliverable:** Complete view + share + download flow.

---

## Phase 3 — Billing + Auth (Weeks 9–10)

**Goal:** Users can sign up, manage projects, and pay.

- [ ] Clerk authentication (sign up / login / profile)
- [ ] Project dashboard (list, status, view results)
- [ ] Stripe integration (per-project checkout)
- [ ] Free tier enforcement (1 project/month, 200 photo limit)
- [ ] Usage tracking and limits
- [ ] Landing page with pricing

**Deliverable:** Full self-serve flow from signup to paid processing.

---

## Phase 4 — First Paying Users (Weeks 11–12)

**Goal:** Get 3 beta users paying real money.

- [ ] Onboard 3 beta users from interview pool
- [ ] Monitor processing pipeline reliability
- [ ] Collect feedback on output quality and workflow
- [ ] Fix critical bugs and UX issues
- [ ] Set up basic monitoring and alerting
- [ ] Document runbook for common issues

**Deliverable:** 3 paying users, $45+ in revenue, validated product-market fit signal.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| User interviews completed | 10 |
| Processing pipeline uptime | >95% |
| Avg processing time (200 photos) | <90 min |
| Shareable link load time | <3s |
| First paying user | Week 11 |
| Revenue by Week 12 | $45+ |

---

## Post-MVP Priorities (Weeks 13+)

Based on user feedback, likely next:
1. 3D point cloud viewer (Potree)
2. Volume calculation tools
3. DXF/CAD export
4. Custom CRS / coordinate system selection
5. Client portal with login
6. AI-powered change detection
7. Mobile upload app
8. Subscription billing tiers
