FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt

COPY . .

# Run as a non-root user. /app/.venv is created (and owned) here so the
# anonymous volume Compose mounts over it inherits appuser's ownership; the
# same goes for /app itself, which the bind mount and uvicorn --reload use.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/.venv \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# The API's own /api/health endpoint, hit with the stdlib so the image needs no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
