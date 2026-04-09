FROM python:3.12-slim

# Install Docker CLI (needed to run ODM container)
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system -e .

COPY src/ src/

CMD ["python", "-m", "src.worker"]
