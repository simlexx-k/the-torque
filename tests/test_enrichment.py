from app.enrichment import should_enrich


def test_vehicle_sale_text_is_candidate():
    assert should_enrich("2018 VW Passat for sale KES 2.5m, 84,000 km", []) is True


def test_photo_post_is_candidate_even_with_minimal_text():
    assert should_enrich("Fresh unit", ["https://example.com/car.jpg"]) is True


def test_unrelated_text_is_skipped():
    assert should_enrich("Good morning and have a great Sunday", []) is False
