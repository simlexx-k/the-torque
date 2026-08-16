from app.config import Settings
from app.enrichment import should_enrich


def test_vehicle_sale_text_is_candidate():
    assert should_enrich("2018 VW Passat for sale KES 2.5m, 84,000 km", []) is True


def test_photo_post_is_candidate_even_with_minimal_text():
    assert should_enrich("Fresh unit", ["https://example.com/car.jpg"]) is True


def test_shorthand_multi_vehicle_sale_is_candidate_without_images():
    text = "Tiida 390k\nNote 440k\nPajero io 350k\nPremio 390k"
    assert should_enrich(text, []) is True


def test_unrelated_text_is_skipped():
    assert should_enrich("Good morning and have a great Sunday", []) is False


def test_gemini_is_default_provider_and_key_controls_readiness():
    unconfigured = Settings(_env_file=None)
    assert unconfigured.ai_provider == "gemini"
    assert unconfigured.gemini_model == "gemini-3.1-flash-lite"
    assert unconfigured.ai_configured is False

    configured = Settings(_env_file=None, gemini_api_key="test-key")
    assert configured.ai_configured is True
    assert configured.ai_model == "gemini-3.1-flash-lite"
