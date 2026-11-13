from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("COMPARE_DATABASE_URL", "")
    internal_token: str = ""
    ebay_client_id: str = os.getenv("EBAY_CLIENT_ID", "")
    ebay_client_secret: str = os.getenv("EBAY_CLIENT_SECRET", "")
    ebay_marketplace: str = os.getenv("EBAY_MARKETPLACE_ID", "EBAY_US")
    max_results: int = int(os.getenv("COMPARE_MAX_RESULTS", "50"))
    tushare_token: str = field(default=os.getenv("TUSHARE_TOKEN", ""), repr=False)
    investment_auto_update: bool = os.getenv("INVESTMENT_AUTO_UPDATE", "true").lower() == "true"
    investment_realtime: bool = os.getenv("INVESTMENT_REALTIME_ENABLED", "false").lower() == "true"
    investment_interval: int = int(os.getenv("INVESTMENT_UPDATE_INTERVAL_SECONDS", "900"))

    def __post_init__(self) -> None:
        if not 300 <= self.investment_interval <= 86400:
            raise ValueError("INVESTMENT_UPDATE_INTERVAL_SECONDS must be between 300 and 86400")
        if not self.database_url:
            object.__setattr__(self, "database_url", f"sqlite:///{ROOT / 'python' / 'data' / 'compare.db'}")
        # Explicit settings are used by isolated tests and controlled callers;
        # environment values are only fallbacks for the process-wide service.
        token = self.internal_token or os.getenv("COMPARE_INTERNAL_TOKEN", "")
        jwt_secret = os.getenv("JWT_SECRET", "")
        if not token and jwt_secret:
            token = hashlib.sha256(f"price-compare:{jwt_secret}".encode()).hexdigest()
        object.__setattr__(self, "internal_token", token)


settings = Settings()
