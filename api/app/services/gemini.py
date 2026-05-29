"""Gemini API wrapper for backend-only structured generation."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict

import requests

from app.config import settings

logger = logging.getLogger(__name__)


class GeminiError(RuntimeError):
    """Raised when Gemini generation fails."""


class GeminiService:
    """Small REST wrapper around Gemini generateContent."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: int | None = None,
        max_retries: int | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self.timeout_seconds = timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else settings.GEMINI_MAX_RETRIES

    def generate_json(self, prompt: str, response_schema: Dict[str, Any]) -> str:
        if not self.api_key:
            raise GeminiError("GEMINI_API_KEY is not configured")

        url = f"{self.BASE_URL}/models/{self.model}:generateContent"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "topP": 0.8,
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
            },
        }

        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = requests.post(
                    url,
                    params={"key": self.api_key},
                    json=payload,
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                data = response.json()
                return self._extract_text(data)
            except (requests.RequestException, ValueError, GeminiError) as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break
                time.sleep(0.5 * (2 ** attempt))

        logger.warning("Gemini generation failed after retries: %s", last_error)
        raise GeminiError(str(last_error) if last_error else "Gemini generation failed")

    @staticmethod
    def _extract_text(data: Dict[str, Any]) -> str:
        candidates = data.get("candidates") or []
        if not candidates:
            raise GeminiError("Gemini response has no candidates")

        parts = candidates[0].get("content", {}).get("parts") or []
        for part in parts:
            text = part.get("text")
            if text:
                return text

        raise GeminiError("Gemini response has no text part")
