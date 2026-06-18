from typing import Optional

from flask import request

from models import UserActivity, db


def log_activity(user_id: str, action: str, detail: Optional[str] = None) -> None:
    try:
        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        if ip and "," in ip:
            ip = ip.split(",")[0].strip()
        ua = (request.headers.get("User-Agent") or "")[:300]
        entry = UserActivity(
            user_id=user_id,
            action=action,
            detail=(detail or "")[:500] or None,
            ip_address=ip,
            user_agent=ua,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        db.session.rollback()
