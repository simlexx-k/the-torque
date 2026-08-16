from sqlalchemy import create_engine, inspect, text

from app import db as db_module
from app.public_ids import (
    generate_listing_public_id,
    is_legacy_numeric_listing_ref,
    is_listing_public_id,
)


def test_public_listing_ids_are_url_safe_random_and_unique():
    values = {generate_listing_public_id() for _ in range(128)}
    assert len(values) == 128
    assert all(is_listing_public_id(value) for value in values)
    assert all(len(value) == 26 for value in values)


def test_public_listing_id_validation_rejects_enumerable_or_malformed_refs():
    assert not is_listing_public_id("70")
    assert not is_listing_public_id("lst_short")
    assert not is_listing_public_id("lst_../../etc/passwd")
    assert not is_listing_public_id("lst_aaaaaaaaaaaaaaaaaaaaaa/extra")


def test_legacy_numeric_lookup_is_bounded_for_backwards_compatibility():
    assert is_legacy_numeric_listing_ref("1")
    assert is_legacy_numeric_listing_ref("70")
    assert is_legacy_numeric_listing_ref("999999999999999999")
    assert not is_legacy_numeric_listing_ref("0")
    assert not is_legacy_numeric_listing_ref("00070")
    assert not is_legacy_numeric_listing_ref("9999999999999999999")
    assert not is_legacy_numeric_listing_ref("70x")


def test_existing_listing_table_is_backfilled_without_renumbering(tmp_path, monkeypatch):
    migration_engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with migration_engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE listings (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("INSERT INTO listings (id) VALUES (7), (70), (105)")

    monkeypatch.setattr(db_module, "engine", migration_engine)
    db_module._ensure_listing_public_ids()

    columns = {column["name"] for column in inspect(migration_engine).get_columns("listings")}
    assert "public_id" in columns

    with migration_engine.connect() as connection:
        rows = connection.execute(text("SELECT id, public_id FROM listings ORDER BY id")).all()

    assert [row.id for row in rows] == [7, 70, 105]
    public_ids = [row.public_id for row in rows]
    assert len(set(public_ids)) == 3
    assert all(is_listing_public_id(value) for value in public_ids)

    # Running the compatibility migration again is idempotent and must not
    # rotate stable public URLs.
    db_module._ensure_listing_public_ids()
    with migration_engine.connect() as connection:
        second_pass = connection.execute(text("SELECT id, public_id FROM listings ORDER BY id")).all()
    assert second_pass == rows
