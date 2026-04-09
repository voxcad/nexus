import json
import logging
import re

import google.generativeai as genai
from google.cloud import storage

from src.config import settings

logger = logging.getLogger(__name__)

if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_model)
else:
    model = None


async def analyse_orthomosaic(
    gcs_path: str,
    project_name: str,
    area_ha: float | None = None,
) -> dict:
    """Use Gemini Vision to analyse a processed orthomosaic."""
    if not model:
        return _empty_analysis()

    image_bytes = _download_gcs_thumbnail(gcs_path)

    prompt = f"""
You are an expert geomatics engineer and remote sensing analyst.
Analyse this drone orthomosaic image for a project called "{project_name}".
{f"The surveyed area is approximately {area_ha:.1f} hectares." if area_ha else ""}

Provide a structured analysis with:
1. OVERVIEW: A 2-3 sentence professional summary of what is visible.
2. LAND COVER: Identify and estimate % of visible land cover types (vegetation, bare soil, water, built structures, roads).
3. FEATURES: List notable features detected (buildings, infrastructure, water bodies, etc.)
4. ANOMALIES: Identify any anomalies, damage, changes, or areas of concern.
5. DATA QUALITY: Comment on image quality, coverage, and any gaps or issues.
6. RECOMMENDATIONS: 1-2 actionable recommendations based on what is visible.

Be concise, professional, and specific. Avoid vague statements.
Respond in JSON format matching this schema exactly:
{{
  "overview": "string",
  "land_cover": [{{"type": "string", "percentage": number}}],
  "features": ["string"],
  "anomalies": ["string"],
  "data_quality": "string",
  "recommendations": ["string"]
}}
"""
    try:
        image_part = {"mime_type": "image/jpeg", "data": image_bytes}
        response = model.generate_content([prompt, image_part])
        text = re.sub(r"```json|```", "", response.text).strip()
        return json.loads(text)
    except Exception as e:
        logger.error(f"Gemini analysis failed for {gcs_path}: {e}")
        return _empty_analysis()


async def generate_report_markdown(
    project_name: str, analysis: dict, deliverables: list
) -> str:
    """Generate a professional survey report in markdown via Gemini."""
    if not model:
        return f"# Survey Report — {project_name}\n\nAutomated report generation unavailable."

    prompt = f"""
You are a professional geomatics engineer writing a drone survey report.
Write a complete, professional survey report for project: "{project_name}"

Analysis results:
{json.dumps(analysis, indent=2)}

Deliverables produced: {json.dumps(deliverables, indent=2)}

Write the report in markdown format with these sections:
- Executive Summary
- Survey Overview
- Methodology
- Findings
- Data Quality Assessment
- Deliverables
- Recommendations
- Appendix (coordinate system, equipment notes)

Use professional language. Be specific and concise. Do not invent data not provided.
"""
    response = model.generate_content(prompt)
    return response.text


def _download_gcs_thumbnail(gcs_path: str) -> bytes:
    """Download image bytes from GCS for Gemini Vision input."""
    gcs_client = storage.Client(project=settings.gcp_project_id)
    parts = gcs_path.replace("gs://", "").split("/", 1)
    bucket_name, object_name = parts[0], parts[1]
    bucket = gcs_client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    return blob.download_as_bytes()


def _empty_analysis() -> dict:
    return {
        "overview": "Analysis could not be completed automatically.",
        "land_cover": [],
        "features": [],
        "anomalies": [],
        "data_quality": "Unable to assess",
        "recommendations": ["Manual review recommended"],
    }
