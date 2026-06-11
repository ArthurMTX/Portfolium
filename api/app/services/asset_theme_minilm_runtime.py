"""ONNX MiniLM embedding runtime for theme classification."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Protocol, Sequence
from urllib.request import urlretrieve

from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_MODEL_REPO = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_MODEL_FILENAME = "onnx/model_quint8_avx2.onnx"
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "portfolium" / "theme-minilm"
HF_RESOLVE_URL = "https://huggingface.co/{repo}/resolve/main/{path}"


class EmbeddingBackend(Protocol):
    """Small protocol used by tests to avoid loading ONNX Runtime."""

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        ...


@dataclass(frozen=True)
class MiniLMModelPaths:
    model_path: Path
    tokenizer_path: Path


class OnnxMiniLMEmbeddingBackend:
    """Embedding backend for all-MiniLM-L6-v2 exported to ONNX."""

    def __init__(
        self,
        model_path: Optional[str | Path] = None,
        max_length: int = 256,
    ) -> None:
        self.model_path = model_path
        self.max_length = max_length
        self.model_paths: Optional[MiniLMModelPaths] = None
        self.session: Any = None
        self.tokenizer: Any = None
        self.input_names: set[str] = set()
        self.output_names: list[str] = []
        self.load_ms: float = 0.0

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        self._load()
        if not texts:
            return []

        import numpy as np

        encoded = self.tokenizer.encode_batch(list(texts))
        max_length = max(len(item.ids) for item in encoded)
        input_ids = []
        attention_mask = []
        token_type_ids = []
        for item in encoded:
            pad_length = max_length - len(item.ids)
            input_ids.append(item.ids + [0] * pad_length)
            attention_mask.append(item.attention_mask + [0] * pad_length)
            type_ids = getattr(item, "type_ids", None) or [0] * len(item.ids)
            token_type_ids.append(type_ids + [0] * pad_length)

        feeds: Dict[str, Any] = {}
        if "input_ids" in self.input_names:
            feeds["input_ids"] = np.asarray(input_ids, dtype=np.int64)
        if "attention_mask" in self.input_names:
            feeds["attention_mask"] = np.asarray(attention_mask, dtype=np.int64)
        if "token_type_ids" in self.input_names:
            feeds["token_type_ids"] = np.asarray(token_type_ids, dtype=np.int64)

        outputs = self.session.run(None, feeds)
        sentence_embeddings = self._select_sentence_embeddings(
            outputs=outputs,
            attention_mask=np.asarray(attention_mask, dtype=np.float32),
        )
        return sentence_embeddings.astype("float32").tolist()

    def _load(self) -> None:
        if self.session is not None and self.tokenizer is not None:
            return

        started_at = time.perf_counter()
        try:
            import onnxruntime as ort
            from tokenizers import Tokenizer
        except ImportError as exc:
            raise RuntimeError(
                "MiniLM benchmark dependencies are missing. Install the optional "
                "theme-minilm extras: pip install -e '.[theme-minilm]'"
            ) from exc

        self.model_paths = resolve_model_paths(self.model_path)
        tokenizer = Tokenizer.from_file(str(self.model_paths.tokenizer_path))
        tokenizer.enable_truncation(max_length=self.max_length)
        tokenizer.enable_padding()

        session = ort.InferenceSession(
            str(self.model_paths.model_path),
            providers=["CPUExecutionProvider"],
        )
        self.input_names = {item.name for item in session.get_inputs()}
        self.output_names = [item.name for item in session.get_outputs()]
        self.tokenizer = tokenizer
        self.session = session
        self.load_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "MiniLM ONNX model loaded model_path=%s tokenizer_path=%s load_ms=%.1f",
            self.model_paths.model_path,
            self.model_paths.tokenizer_path,
            self.load_ms,
        )

    def _select_sentence_embeddings(self, outputs: Sequence[Any], attention_mask: Any) -> Any:
        import numpy as np

        named_outputs = dict(zip(self.output_names, outputs))
        for name, value in named_outputs.items():
            if "sentence" in name.lower() and len(value.shape) == 2:
                return np.asarray(value)
            if "embedding" in name.lower() and len(value.shape) == 2:
                return np.asarray(value)

        for value in outputs:
            array = np.asarray(value)
            if len(array.shape) == 2:
                return array

        for value in outputs:
            array = np.asarray(value)
            if len(array.shape) == 3:
                mask = attention_mask[..., None]
                summed = (array * mask).sum(axis=1)
                counts = mask.sum(axis=1).clip(min=1e-9)
                return summed / counts

        raise RuntimeError("ONNX MiniLM model did not return a usable embedding tensor")

    def estimated_model_disk_mb(self) -> Optional[float]:
        try:
            paths = self.model_paths or resolve_model_paths(self.model_path)
            total_bytes = paths.model_path.stat().st_size + paths.tokenizer_path.stat().st_size
            return round(total_bytes / (1024 * 1024), 2)
        except Exception:
            return None

    def estimated_memory_mb(self) -> Optional[float]:
        disk_mb = self.estimated_model_disk_mb()
        if disk_mb is None:
            return None
        return round((disk_mb * 4.0) + 50.0, 2)


def resolve_model_paths(model_path: Optional[str | Path] = None) -> MiniLMModelPaths:
    configured_path = model_path or settings.THEME_MINILM_MODEL_PATH or default_model_directory()
    path = Path(configured_path).expanduser()

    if path.is_file():
        model_file = path
        tokenizer_file = _find_tokenizer_near(path.parent)
    else:
        model_file = _find_model_in_directory(path)
        tokenizer_file = _find_tokenizer_near(path)

    if not model_file or not model_file.exists():
        raise RuntimeError(
            "MiniLM ONNX model file was not found. Set THEME_MINILM_MODEL_PATH, "
            "or run with --download-model to populate the local cache."
        )
    if not tokenizer_file or not tokenizer_file.exists():
        raise RuntimeError(
            "MiniLM tokenizer.json was not found next to the model directory. Download the "
            "model assets or point THEME_MINILM_MODEL_PATH at a directory containing tokenizer.json."
        )

    return MiniLMModelPaths(model_path=model_file, tokenizer_path=tokenizer_file)


def default_model_directory() -> Path:
    return DEFAULT_CACHE_DIR / DEFAULT_MODEL_REPO.replace("/", "__")


def download_default_model(target_dir: Optional[str | Path] = None) -> MiniLMModelPaths:
    """Download the default quantized MiniLM ONNX model and tokenizer once."""

    destination = Path(target_dir).expanduser() if target_dir else default_model_directory()
    model_path = destination / DEFAULT_MODEL_FILENAME
    tokenizer_path = destination / "tokenizer.json"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    tokenizer_path.parent.mkdir(parents=True, exist_ok=True)

    downloads = {
        model_path: DEFAULT_MODEL_FILENAME,
        tokenizer_path: "tokenizer.json",
    }
    for local_path, remote_path in downloads.items():
        if local_path.exists() and local_path.stat().st_size > 0:
            continue
        url = HF_RESOLVE_URL.format(repo=DEFAULT_MODEL_REPO, path=remote_path)
        logger.info("Downloading MiniLM asset url=%s destination=%s", url, local_path)
        urlretrieve(url, local_path)

    return MiniLMModelPaths(model_path=model_path, tokenizer_path=tokenizer_path)


def _find_model_in_directory(directory: Path) -> Optional[Path]:
    candidates = [
        directory / DEFAULT_MODEL_FILENAME,
        directory / "onnx" / "model_quint8_avx2.onnx",
        directory / "onnx" / "model_qint8_avx512.onnx",
        directory / "onnx" / "model.onnx",
        directory / "model_quint8_avx2.onnx",
        directory / "model.onnx",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _find_tokenizer_near(directory: Path) -> Optional[Path]:
    search_directories: Iterable[Path] = [
        directory,
        directory.parent,
        directory.parent.parent,
    ]
    for search_directory in search_directories:
        candidate = search_directory / "tokenizer.json"
        if candidate.exists():
            return candidate
    return None
