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
