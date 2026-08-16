from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import Settings
from app.scheduler import poll_interval_seconds


def test_daytime_interval():
    settings = Settings(scheduler_timezone="Africa/Nairobi", daytime_poll_seconds=600, nighttime_poll_seconds=3600)
    now = datetime(2026, 8, 16, 12, 0, tzinfo=ZoneInfo("Africa/Nairobi"))
    assert poll_interval_seconds(settings, now) == 600


def test_night_interval():
    settings = Settings(scheduler_timezone="Africa/Nairobi", daytime_poll_seconds=600, nighttime_poll_seconds=3600)
    now = datetime(2026, 8, 16, 23, 0, tzinfo=ZoneInfo("Africa/Nairobi"))
    assert poll_interval_seconds(settings, now) == 3600
