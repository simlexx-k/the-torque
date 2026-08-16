from sqlalchemy.engine import URL

from app.config import Settings
from app.db import build_database_target


def test_structured_database_target_preserves_reserved_password_characters():
    settings = Settings(
        _env_file=None,
        database_host="db",
        database_port=5432,
        database_user="thetorque",
        database_password="p@ss%word:with/slashes#and?chars",
        database_name="thetorque",
    )

    target = build_database_target(settings)

    assert isinstance(target, URL)
    assert target.host == "db"
    assert target.port == 5432
    assert target.username == "thetorque"
    assert target.password == "p@ss%word:with/slashes#and?chars"
    assert target.database == "thetorque"


def test_database_url_fallback_remains_available_for_local_development():
    settings = Settings(_env_file=None, database_url="sqlite:///./local.db", database_host="")

    assert build_database_target(settings) == "sqlite:///./local.db"
