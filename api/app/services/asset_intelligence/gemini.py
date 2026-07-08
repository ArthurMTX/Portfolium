"""Gemini API wrapper for backend-only structured generation."""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict

import requests

from app.config import settings

logger = logging.getLogger(__name__)

_KEY_PARAM_RE = re.compile(r"([?&]key=)[^&\s]+")


def _redact_api_key(message: str) -> str:
    """Strip API key values from URLs embedded in error messages."""
    return _KEY_PARAM_RE.sub(r"\1<redacted>", message)


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
            attempt_started_at = time.perf_counter()
            try:
                response = requests.post(
                    url,
                    params={"key": self.api_key},
                    json=payload,
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                data = response.json()
                text = self._extract_text(data)
                self._record_timing_attempt(
                    attempt=attempt + 1,
                    prompt=prompt,
                    response_text=text,
                    duration_seconds=time.perf_counter() - attempt_started_at,
                    status="success",
                )
                return text
            except (requests.RequestException, ValueError, GeminiError) as exc:
                duration_seconds = time.perf_counter() - attempt_started_at
                last_error = exc
                self._record_timing_attempt(
                    attempt=attempt + 1,
                    prompt=prompt,
                    response_text=None,
                    duration_seconds=duration_seconds,
                    status="timeout"
                    if isinstance(exc, requests.Timeout)
                    else "failed",
                    error=_redact_api_key(str(exc)),
                )
                if attempt >= self.max_retries:
                    break
                backoff_seconds = 0.5 * (2 ** attempt)
                backoff_started_at = time.perf_counter()
                time.sleep(backoff_seconds)
                self._record_timing_event(
                    "Gemini retry backoff",
                    time.perf_counter() - backoff_started_at,
                    metadata={
                        "attempt": attempt + 1,
                        "configured_backoff_seconds": backoff_seconds,
                    },
                )

        last_error_message = _redact_api_key(str(last_error)) if last_error else None
        logger.warning("Gemini generation failed after retries: %s", last_error_message)
        raise GeminiError(last_error_message or "Gemini generation failed")

    def _record_timing_attempt(
        self,
        *,
        attempt: int,
        prompt: str,
        response_text: str | None,
        duration_seconds: float,
        status: str,
        error: str | None = None,
    ) -> None:
        timing = getattr(self, "_asset_theme_timing", None)
        if timing is None or not hasattr(timing, "add_gemini_call"):
            return

        context = getattr(self, "_asset_theme_call_context", {}) or {}
        timing.add_gemini_call(
            pass_label=context.get("pass_label") or "Gemini",
            attempt=attempt,
            model=self.model,
            prompt_chars=context.get("prompt_chars") or len(prompt),
            response_chars=len(response_text or ""),
            duration_seconds=duration_seconds,
            status=status,
            error=error,
        )

    def _record_timing_event(
        self,
        label: str,
        duration_seconds: float,
        *,
        metadata: Dict[str, Any] | None = None,
    ) -> None:
        timing = getattr(self, "_asset_theme_timing", None)
        if timing is None or not hasattr(timing, "add_event"):
            return
        timing.add_event(label, duration_seconds, metadata=metadata)

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
