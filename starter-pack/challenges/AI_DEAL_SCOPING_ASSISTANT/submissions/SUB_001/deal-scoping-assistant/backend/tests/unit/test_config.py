from app.core.config import AiMode, AiProvider, Settings


def make_settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_cors_origins_parsed_to_list() -> None:
    settings = make_settings(cors_origins="http://a.test, http://b.test ,")
    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_cors_origins_default_empty() -> None:
    assert make_settings(cors_origins="").cors_origins == []


def test_secrets_do_not_leak_in_repr_or_dump() -> None:
    settings = make_settings(google_api_key="super-secret-key")
    assert "super-secret-key" not in repr(settings)
    assert "super-secret-key" not in str(settings)
    assert "super-secret-key" not in settings.model_dump_json()
    assert settings.google_api_key.get_secret_value() == "super-secret-key"


def test_empty_provider_becomes_none() -> None:
    assert make_settings(ai_provider="").ai_provider is None


def test_provider_key_follows_provider() -> None:
    settings = make_settings(ai_provider="groq", groq_api_key="gsk-test", google_api_key="g-test")
    assert settings.ai_provider is AiProvider.GROQ
    assert settings.provider_key() == "gsk-test"
    assert make_settings(ai_provider=None).provider_key() == ""


def test_unknown_env_keys_are_ignored() -> None:
    settings = make_settings(some_unrelated_key="x")
    assert not hasattr(settings, "some_unrelated_key")


def test_defaults() -> None:
    settings = make_settings()
    assert settings.ai_mode is AiMode.MOCK
    assert settings.max_upload_mb == 10
    assert settings.max_input_chars == 60000
