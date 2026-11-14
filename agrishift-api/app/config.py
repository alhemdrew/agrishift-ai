from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The .env file that sits in the backend folder, wherever the server is started from.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # Values are read from the .env file in the backend folder, and from the system environment if set there.
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8-sig", extra="ignore")

    database_url: str
    frontend_url: str = "http://localhost:3000"
    cookie_secure: bool = False

    brevo_api_key: str = ""
    brevo_api_url: str = "https://api.brevo.com/v3/smtp/email"
    email_from_address: str = "no-reply@example.com"
    email_from_name: str = "AgriShift"

    # AI Assistant (Google Gemini)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com"

    # Place search (OpenStreetMap Nominatim)
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    geocode_user_agent: str = "AgriShift/0.1 (NASA Space Apps demo; set GEOCODE_USER_AGENT in .env)"

    @property
    def sqlalchemy_url(self) -> str:
        """Supabase gives postgresql:// URLs; SQLAlchemy needs the psycopg driver named explicitly."""
        url = self.database_url
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url


settings = Settings()
