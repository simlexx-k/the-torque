from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import Settings
from app.db import SessionLocal
from app.service import IngestionService

logger = logging.getLogger(__name__)


def poll_interval_seconds(settings: Settings, now: datetime | None = None) -> int:
    tz = ZoneInfo(settings.scheduler_timezone)
    local_now = now.astimezone(tz) if now is not None else datetime.now(tz)
    hour = local_now.hour
    if settings.daytime_start_hour <= hour < settings.daytime_end_hour:
        return settings.daytime_poll_seconds
    return settings.nighttime_poll_seconds


async def scheduler_loop(settings: Settings, stop_event: asyncio.Event) -> None:
    service = IngestionService(settings)
    while not stop_event.is_set():
        try:
            with SessionLocal() as session:
                result = await asyncio.to_thread(service.run_once, session)
            logger.info("ingestion cycle complete: %s", result)
        except Exception:
            logger.exception("ingestion cycle failed")

        interval = poll_interval_seconds(settings)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except TimeoutError:
            pass
