from __future__ import annotations

from typing import Any, Protocol

from ..schemas import NormalizedOffer, SearchRequest


class PlatformAdapter(Protocol):
    platform: str

    async def search(self, request: SearchRequest) -> list[NormalizedOffer]: ...

    def capabilities(self) -> dict[str, Any]: ...


class UnavailableAdapter:
    def __init__(self, platform: str, name: str):
        self.platform, self.name = platform, name

    def capabilities(self) -> dict[str, Any]:
        return {"platform": self.platform, "name": self.name, "status": "unavailable", "reason": "未配置经授权的开放平台接口", "fallback": "manual_import", "automaticSearch": False}

    async def search(self, _request: SearchRequest) -> list[NormalizedOffer]:
        return []
