"""Maintenance reminder computation engine."""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    MaintenanceSchedule, Measurement, ChemicalAddition,
    MaintenanceAction, QuickStatus, JournalEntry,
)

# Default maintenance schedule definitions
DEFAULT_SCHEDULES = [
    {"task_type": "test_water", "display_name": "Test Water Chemistry", "interval_days": 3, "priority": "high", "icon": "🔬"},
    {"task_type": "add_chlorine", "display_name": "Add Chlorine", "interval_days": 3, "priority": "high", "icon": "🧪"},
    {"task_type": "clean_cartridge", "display_name": "Clean Filter Cartridge", "interval_days": 30, "priority": "normal", "icon": "🔧"},
    {"task_type": "shock_pool", "display_name": "Shock Pool", "interval_days": 14, "priority": "normal", "icon": "⚡"},
    {"task_type": "clean_skimmer", "display_name": "Clean Skimmer Basket", "interval_days": 7, "priority": "normal", "icon": "🧹"},
    {"task_type": "robot_run", "display_name": "Run Pool Robot", "interval_days": 7, "priority": "low", "icon": "🤖"},
    {"task_type": "vacuum", "display_name": "Vacuum Pool", "interval_days": 14, "priority": "low", "icon": "🌊"},
    {"task_type": "empty_basket", "display_name": "Empty Pump Basket", "interval_days": 7, "priority": "normal", "icon": "🗑️"},
    {"task_type": "add_water", "display_name": "Check Water Level", "interval_days": 7, "priority": "low", "icon": "💧"},
    {"task_type": "brush_walls", "display_name": "Brush Pool Walls", "interval_days": 7, "priority": "low", "icon": "🖌️"},
    {"task_type": "check_cya", "display_name": "Check CYA Level", "interval_days": 30, "priority": "normal", "icon": "☀️"},
    {"task_type": "backwash", "display_name": "Backwash / Deep Clean Filter", "interval_days": 30, "priority": "normal", "icon": "♻️"},
]

# Mapping from schedule task_type to the entry/action types that satisfy it
TASK_COMPLETION_MAP = {
    "test_water": {"entry_types": ["measurement"]},
    "add_chlorine": {"chemical_types": ["chlorine"]},
    "clean_cartridge": {"action_types": ["clean_cartridge"]},
    "shock_pool": {"entry_types": ["shock"], "chemical_types": ["shock"]},
    "clean_skimmer": {"status_types": ["clean_skimmer"]},
    "robot_run": {"status_types": ["robot_run"]},
    "vacuum": {"status_types": ["vacuumed"]},
    "empty_basket": {"status_types": ["basket_emptied"]},
    "add_water": {"action_types": ["add_water"]},
    "brush_walls": {"action_types": ["brush_walls"]},
    "check_cya": {"entry_types": ["measurement"]},  # specifically CYA measurement
    "backwash": {"action_types": ["backwash"]},
}


async def ensure_default_schedules(db: AsyncSession):
    """Create default maintenance schedules if none exist."""
    result = await db.execute(select(func.count(MaintenanceSchedule.id)))
    count = result.scalar()
    if count == 0:
        for sched in DEFAULT_SCHEDULES:
            db.add(MaintenanceSchedule(**sched))
        await db.commit()


async def update_schedule_completion(db: AsyncSession, task_type: str, completed_at: datetime):
    """Update a schedule's last_completed and next_due after a task is done."""
    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.task_type == task_type)
    )
    schedule = result.scalar_one_or_none()
    if schedule:
        schedule.last_completed = completed_at
        schedule.next_due = completed_at + timedelta(days=schedule.interval_days)
        await db.commit()


async def compute_reminders(db: AsyncSession) -> list[dict]:
    """Compute all maintenance reminders with their urgency levels."""
    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.enabled == True)
    )
    schedules = result.scalars().all()

    now = datetime.now(timezone.utc)
    reminders = []

    for sched in schedules:
        days_since = None
        if sched.last_completed:
            days_since = (now - sched.last_completed).days

        # Determine urgency
        if sched.last_completed is None:
            urgency = "urgent"  # never done
        elif days_since is not None:
            overdue_days = days_since - sched.interval_days
            if overdue_days >= 3:
                urgency = "urgent"
            elif overdue_days >= 0:
                urgency = "overdue"
            elif overdue_days >= -1:
                urgency = "due_soon"
            else:
                urgency = "good"
        else:
            urgency = "good"

        recommendation = None
        if urgency in ("overdue", "urgent"):
            recommendation = f"Last done {days_since} days ago. Due every {sched.interval_days} days."
        elif urgency == "due_soon":
            recommendation = f"Due tomorrow or today."

        reminders.append({
            "task_type": sched.task_type,
            "display_name": sched.display_name,
            "icon": sched.icon or "📋",
            "urgency": urgency,
            "days_since": days_since,
            "interval_days": sched.interval_days,
            "last_completed": sched.last_completed,
            "recommendation": recommendation,
        })

    # Sort: urgent first, then overdue, due_soon, good
    urgency_order = {"urgent": 0, "overdue": 1, "due_soon": 2, "good": 3}
    reminders.sort(key=lambda r: urgency_order.get(r["urgency"], 4))

    return reminders


async def auto_update_schedules(db: AsyncSession):
    """Scan recent journal entries and auto-update schedule completions.

    Called by the worker periodically to ensure schedules stay current.
    """
    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.enabled == True)
    )
    schedules = result.scalars().all()

    for sched in schedules:
        mapping = TASK_COMPLETION_MAP.get(sched.task_type, {})
        latest_date = None

        # Check entry types
        if "entry_types" in mapping:
            for et in mapping["entry_types"]:
                res = await db.execute(
                    select(JournalEntry.entry_date)
                    .where(JournalEntry.entry_type == et)
                    .order_by(JournalEntry.entry_date.desc())
                    .limit(1)
                )
                row = res.scalar_one_or_none()
                if row and (latest_date is None or row > latest_date):
                    latest_date = row

        # Check chemical types
        if "chemical_types" in mapping:
            for ct in mapping["chemical_types"]:
                res = await db.execute(
                    select(ChemicalAddition.added_at)
                    .where(ChemicalAddition.chemical_type == ct)
                    .order_by(ChemicalAddition.added_at.desc())
                    .limit(1)
                )
                row = res.scalar_one_or_none()
                if row and (latest_date is None or row > latest_date):
                    latest_date = row

        # Check action types
        if "action_types" in mapping:
            for at in mapping["action_types"]:
                res = await db.execute(
                    select(MaintenanceAction.performed_at)
                    .where(MaintenanceAction.action_type == at)
                    .order_by(MaintenanceAction.performed_at.desc())
                    .limit(1)
                )
                row = res.scalar_one_or_none()
                if row and (latest_date is None or row > latest_date):
                    latest_date = row

        # Check status types
        if "status_types" in mapping:
            for st in mapping["status_types"]:
                res = await db.execute(
                    select(QuickStatus.logged_at)
                    .where(QuickStatus.status_type == st)
                    .order_by(QuickStatus.logged_at.desc())
                    .limit(1)
                )
                row = res.scalar_one_or_none()
                if row and (latest_date is None or row > latest_date):
                    latest_date = row

        if latest_date and (sched.last_completed is None or latest_date > sched.last_completed):
            sched.last_completed = latest_date
            sched.next_due = latest_date + timedelta(days=sched.interval_days)

    await db.commit()
