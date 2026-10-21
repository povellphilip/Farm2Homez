# Farm2Home API: production image for AWS App Runner (or any container host).
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first so code changes don't invalidate the cached layer.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Collect static files (Django admin assets, served by WhiteNoise). Build-time values only.
RUN DJANGO_ENV=development DEBUG=False SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 10001 farm2home \
    && chown -R farm2home:farm2home /app

USER farm2home
ENV DJANGO_ENV=production PORT=8000
EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
