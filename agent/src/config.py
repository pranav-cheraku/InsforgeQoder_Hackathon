from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    insforge_url: str
    insforge_service_role_key: str
    buy_executor_url: str
    port: int = 8000

    model_config = {"env_file": ".env"}


settings = Settings()
