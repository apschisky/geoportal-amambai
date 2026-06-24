from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_debug: bool = True
    allowed_origins: str = "http://localhost:5195,http://127.0.0.1:5195"
    database_url: str | None = None
    persist_solicitacoes: bool = False
    rate_limit_enabled: bool = True
    rate_limit_max_requests: int = 5
    rate_limit_window_seconds: int = 600
    trusted_proxy_hosts: str = '127.0.0.1,::1'
    internal_login_rate_limit_max_attempts: int = 5
    internal_login_rate_limit_ip_max_attempts: int = 20
    internal_login_rate_limit_ip_login_max_attempts: int = 5
    internal_login_rate_limit_window_minutes: int = 15

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
