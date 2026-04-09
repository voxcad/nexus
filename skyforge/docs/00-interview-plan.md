# User Interview Plan — Drone Data SaaS Validation

> **Goal:** Talk to 10 drone operators / survey firms / civil engineers before writing code.
> **Timeline:** Weeks 1–2 (Phase 0)

---

## Opening Script

> "I'm a software developer with a geomatic engineering background. I'm exploring building tools for drone data processing. I'd love to understand your current workflow — not selling anything."

---

## Interview Questions

### On Current Workflow
1. Walk me through exactly what happens after your drone lands on site — step by step until the client gets their deliverable.
2. How long does that entire process take? Where does most of the time go?
3. What software do you use today? What do you hate about it?

### On Pain
4. What's the most frustrating part of processing drone data?
5. Have you ever lost a client or a deadline because of the processing bottleneck?
6. What does a "bad day" in your workflow look like?

### On Deliverables
7. What does your client actually receive? What format? How do they access it?
8. Do clients ever ask for things you can't currently deliver easily?

### On Money
9. What do you pay today for software (Pix4D, Agisoft, etc.)?
10. If a tool cut your processing time in half, what would that be worth to you per month?

### On Behaviour
11. Have you tried any cloud-based alternatives? What happened?
12. What would make you switch from your current setup?

---

## What to Listen For

**Feature signals** — words like:
- "takes forever"
- "manual"
- "clients keep asking for"
- "I have to export then import then..."
- "waiting for the computer"
- "send them a Dropbox link"

**Pricing signals:**
- What they currently pay (Pix4D ~$350/month, Agisoft ~$3500 one-time)
- What "saving time" is worth to them
- Per-project vs subscription preference

**Deal-breakers:**
- Accuracy requirements (survey-grade vs general mapping)
- Coordinate system / datum requirements
- Deliverable format requirements (GeoTIFF, DXF, PDF, etc.)
- Data privacy / on-prem concerns

---

## Interview Tracking

| # | Name | Role | Company Size | Date | Key Pain | Willingness to Pay | Notes |
|---|------|------|-------------|------|----------|-------------------|-------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
| 9 | | | | | | | |
| 10 | | | | | | | |

---

## Where to Find Interviewees

- LinkedIn: search "drone operator", "UAV pilot", "drone surveyor"
- Reddit: r/drones, r/surveying, r/UAVmapping
- Facebook groups: drone mapping communities
- Local survey firms (cold email / call)
- Drone pilot forums (DJI Forum, Phantom Pilots)
- Industry events / meetups

---

## After 10 Interviews — Decision Gate

**GO if:**
- 7+ confirm the processing bottleneck pain
- 5+ would pay $50+/month for a faster solution
- Clear pattern in deliverable formats needed

**PIVOT if:**
- Pain is real but they won't pay (price sensitivity too high)
- Accuracy requirements exceed what ODM can deliver
- Data privacy concerns block cloud processing entirely

**KILL if:**
- <3 confirm the pain
- Existing solutions are "good enough"
- Market too small or fragmented
