from app.config import Settings


def test_network_settings_parse_comma_separated_values():
    settings = Settings(
        cors_allowed_origins="https://app.example.com, https://preview.example.com/",
        trusted_hosts="api.example.com,127.0.0.1,localhost",
    )

    assert settings.cors_origins == ["https://app.example.com", "https://preview.example.com"]
    assert settings.trusted_host_list == ["api.example.com", "127.0.0.1", "localhost"]


def test_empty_trusted_hosts_falls_back_to_wildcard():
    settings = Settings(trusted_hosts="")
    assert settings.trusted_host_list == ["*"]
