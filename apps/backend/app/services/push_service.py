"""
Push Notification Service — delivers notifications via Expo Push API.
Uses existing notification infrastructure; never exposes private location data.
"""
import json
import logging
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    sound: str = "default",
) -> bool:
    """
    Send a single push notification via Expo Push API.
    Returns True if the request succeeded (does not guarantee delivery).
    """
    if not push_token or not push_token.startswith("ExponentPushToken["):
        return False

    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": sound,
        "data": data or {},
        "priority": "high",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            resp_data = resp.json()
            # Expo returns {"data": [{"status": "ok"|"error", ...}]}
            results = resp_data.get("data", [])
            if results and results[0].get("status") == "error":
                logger.warning(
                    "Expo push error for token %s: %s",
                    push_token[:20],
                    results[0].get("message"),
                )
                return False
            return True
    except Exception as exc:
        logger.error("Push notification send failed: %s", exc)
        return False


async def send_push_to_users(
    users_with_tokens: List[dict],  # [{"push_token": ..., "title": ..., "body": ..., "data": ...}]
) -> None:
    """Batch send push notifications. Failures are logged but not raised."""
    for item in users_with_tokens:
        token = item.get("push_token")
        if not token:
            continue
        await send_push_notification(
            push_token=token,
            title=item.get("title", "SafeCity"),
            body=item.get("body", ""),
            data=item.get("data"),
        )
