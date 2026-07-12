"""Every Celery task must publish to a queue the production workers consume.

The Compose worker command is `celery ... worker -Q default,high,low`; a task
routed anywhere else (including Celery's implicit "celery" queue) would sit in
Redis forever. This guards both explicit task_routes entries and the
task_default_queue fallback for unrouted tasks.
"""
from app.celery_app import celery_app

CONSUMED_QUEUES = {"default", "high", "low"}


def _resolved_queue(task_name: str) -> str:
    options = celery_app.amqp.router.route({}, task_name)
    queue = options.get("queue")
    if queue is None:
        return celery_app.conf.task_default_queue
    return getattr(queue, "name", queue)


def test_default_queue_is_consumed_by_workers():
    assert celery_app.conf.task_default_queue in CONSUMED_QUEUES


def test_every_registered_task_routes_to_a_consumed_queue():
    app_tasks = [name for name in celery_app.tasks if not name.startswith("celery.")]
    assert app_tasks, "expected application tasks to be registered"

    misrouted = {
        name: _resolved_queue(name)
        for name in app_tasks
        if _resolved_queue(name) not in CONSUMED_QUEUES
    }
    assert not misrouted, f"tasks routed to unconsumed queues: {misrouted}"


def test_beat_schedule_entries_use_consumed_queues_and_known_tasks():
    schedule = celery_app.conf.beat_schedule or {}
    for entry_name, entry in schedule.items():
        queue = entry.get("options", {}).get("queue")
        assert queue in CONSUMED_QUEUES, f"{entry_name} schedules onto unconsumed queue {queue!r}"
        assert entry["task"] in celery_app.tasks, f"{entry_name} references unknown task {entry['task']!r}"
