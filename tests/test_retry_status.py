from app.config import Settings
from app.models import Post
from app.service import _attempt_count


def test_attempt_count_defaults_to_zero():
    post = Post(
        source_id=1,
        x_post_id="1",
        text="Tiida 390k",
        raw_json={},
        ai_payload=None,
    )
    assert _attempt_count(post) == 0


def test_attempt_count_reads_retry_metadata():
    post = Post(
        source_id=1,
        x_post_id="2",
        text="Premio 390k",
        raw_json={},
        ai_payload={"_meta": {"attempts": 3}},
    )
    assert _attempt_count(post) == 3


def test_openai_is_optional_when_gemini_selected():
    settings = Settings(_env_file=None, ai_provider="gemini", gemini_api_key="gemini-test", openai_api_key="")
    assert settings.ai_configured is True
    assert settings.ai_model == settings.gemini_model
