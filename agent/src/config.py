from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    insforge_url: str
    service_key: str           # InsForge SERVICE_KEY (set via: npx @insforge/cli secrets add SERVICE_KEY ...)
    buy_executor_url: str
    port: int = 8000

    model_config = {"env_file": ".env"}


settings = Settings()
