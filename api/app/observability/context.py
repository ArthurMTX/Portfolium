"""Low-cardinality logging context propagated through async request handling."""
from __future__ import annotations

from contextvars import ContextVar, Token


request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
task_name_var: ContextVar[str | None] = ContextVar("task_name", default=None)


def set_request_id(request_id: str | None) -> Token:
    return request_id_var.set(request_id)


def reset_request_id(token: Token) -> None:
    request_id_var.reset(token)


def set_task_name(task_name: str | None) -> Token:
    return task_name_var.set(task_name)


def reset_task_name(token: Token) -> None:
    task_name_var.reset(token)
