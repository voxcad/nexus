# Pricing Model

---

## Tiers

### Starter (Free)
- 1 project/month
- Up to 200 photos per project
- Standard quality processing
- Shareable viewer link (expires 30 days)
- Community support

### Pay-as-you-go ($15/project)
- No monthly commitment
- Up to 500 photos per project
- Standard or high quality
- Shareable viewer link (expires 90 days)
- Download all outputs
- Email support

### Pro ($99/month)
- 10 projects/month
- Up to 1000 photos per project
- All quality presets
- Permanent shareable links
- Priority processing queue
- Email support (24hr response)

### Agency ($299/month)
- Unlimited projects
- Up to 2000 photos per project
- All quality presets
- White-label client portal (custom logo, domain)
- Priority processing queue
- API access
- Dedicated support

---

## Competitive Pricing Context

| Competitor | Pricing | Notes |
|-----------|---------|-------|
| Pix4D Cloud | $300–$500/month | Feature-rich, industry standard |
| DroneDeploy | $329–$499/month | Enterprise focused |
| Agisoft Metashape | $3,500 one-time (Pro) | Desktop only, no cloud |
| WebODM Lightning | $29–$249/month | Closest comparable, open-source based |

**Our positioning:** Cheaper than Pix4D/DroneDeploy, simpler than Agisoft, more polished than WebODM Lightning.

---

## Revenue Projections (Conservative)

| Month | Free Users | Paid Users | MRR |
|-------|-----------|-----------|-----|
| 1 | 10 | 3 | $45 (pay-per-project) |
| 3 | 50 | 15 | $500 |
| 6 | 200 | 40 | $2,500 |
| 12 | 500 | 100 | $8,000 |

**Break-even estimate:** ~$500/month AWS costs at 40 jobs/month → break even at ~15 Pro users.

---

## AWS Cost Estimates (per job)

| Resource | Cost per Job |
|----------|-------------|
| EC2 Spot (c5.4xlarge, ~2hrs) | ~$0.50 |
| S3 Storage (5GB output, 90 days) | ~$0.10 |
| Data transfer (download) | ~$0.05 |
| **Total per job** | **~$0.65** |

**Margin at $15/project:** ~96% gross margin.
