"""Fail when models declare tables/columns that no Alembic migration creates.

Run against a database already migrated to head (CI does: alembic upgrade head,
then this script).

Scope: structural drift only (added/removed tables and columns). Index naming,
nullability-with-server-default, and type-affinity differences between the
hand-written migrations and the model declarations are long-standing and
benign; gating on them would need a dedicated reconciliation migration first,
so they are deliberately out of scope here.

Known tolerated structural drift is listed in ALLOWED_TABLES with the reason.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic.autogenerate import compare_metadata  # noqa: E402
from alembic.migration import MigrationContext  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import Base  # noqa: E402
import app.models  # noqa: F401,E402  (registers every model on Base.metadata)

ALLOWED_TABLES = {
    # Legacy table created by the initial schema migration but never referenced
    # by any application code in the project's history (empty in every
    # deployment). Dropping it is tracked as a post-release follow-up; until
    # then autogenerate wants to remove it.
    "asset_price_history",
    # Email configuration table: intentionally has no ORM model. It lives in
    # the public schema and is read/written via raw SQL
    # (app/services/platform/admin.py, admin settings endpoints).
    "config",
}

STRUCTURAL_OPS = {"add_table", "remove_table", "add_column", "remove_column"}


def _describe(entry):
    op = entry[0]
    if op in {"add_table", "remove_table"}:
        return op, entry[1].name
    # add_column/remove_column: (op, schema, table_name, column)
    return op, f"{entry[2]}.{entry[3].name}"


def main() -> int:
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        ctx = MigrationContext.configure(
            conn,
            opts={
                "include_schemas": True,
                "version_table_schema": "portfolio",
            },
        )
        diffs = compare_metadata(ctx, Base.metadata)
    engine.dispose()

    unexpected = []
    for diff in diffs:
        entries = diff if isinstance(diff, list) else [diff]
        for entry in entries:
            if entry[0] not in STRUCTURAL_OPS:
                continue
            op, target = _describe(entry)
            if op in {"add_table", "remove_table"} and target in ALLOWED_TABLES:
                continue
            if op.endswith("_column") and entry[2] in ALLOWED_TABLES:
                continue
            unexpected.append((op, target))

    if unexpected:
        print("Structural migration drift detected (model changes without a migration):")
        for op, target in unexpected:
            print(f"  - {op}: {target}")
        return 1

    print("No structural migration drift detected (allowlisted legacy tables ignored).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
