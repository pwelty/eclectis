"""Configuration — Pydantic Settings loaded from environment / .env."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    database_url: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # AI
    anthropic_api_key: str = ""
    haiku_model: str = "claude-haiku-4-5-20251001"

    # External APIs
    serper_api_key: str = ""
    scrapingbee_api_key: str = ""
    brevo_api_key: str = ""
    brevo_webhook_secret: str = ""
    briefing_from_email: str = "briefing@eclectis.io"
    briefing_from_name: str = "Eclectis"

    # Analytics
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    # Engine tuning
    command_poll_interval: int = 5
    log_level: str = "INFO"

    # Sentry
    sentry_dsn: str = ""

    # Environment
    environment: str = "dev"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def scoring_model(self) -> str:
        """Alias — scoring uses Haiku for cost efficiency."""
        return self.haiku_model


settings = Settings()
