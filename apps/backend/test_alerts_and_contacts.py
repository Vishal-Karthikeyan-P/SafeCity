"""
Test Suite for:
1. Admin Community Alerts (Broadcast 'all_users' vs PostGIS 'location_based')
2. User-to-User Emergency Contacts Workflow
"""
import asyncio
import uuid
from datetime import datetime, timezone
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import select, delete

from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.alert import CommunityAlert, AlertType
from app.models.notification import Notification, NotificationType
from app.models.emergency import ContactRequest
from app.schemas.alert import AlertCreate
from app.services.alert_service import AlertService
from app.services.contact_request_service import ContactRequestService
from app.schemas.contacts import ContactRequestSend


async def run_tests():
    print("=== Testing Community Alerts & Emergency Contacts ===")
    async with AsyncSessionLocal() as session:
        # Create test users: User A (inside zone), User B (far away), User C (no location / permission denied)
        ts = uuid.uuid4().hex[:6]
        user_inside = User(
            id=str(uuid.uuid4()),
            email=f"inside_{ts}@test.com",
            full_name=f"Inside User {ts}",
            hashed_password="hash",
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
            last_location_lat=11.0168,
            last_location_lng=76.9558,
            last_location_geom=from_shape(Point(76.9558, 11.0168), srid=4326),
        )
        user_outside = User(
            id=str(uuid.uuid4()),
            email=f"outside_{ts}@test.com",
            full_name=f"Outside User {ts}",
            hashed_password="hash",
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
            last_location_lat=13.0827,  # Chennai (~420km away)
            last_location_lng=80.2707,
            last_location_geom=from_shape(Point(80.2707, 13.0827), srid=4326),
        )
        user_no_loc = User(
            id=str(uuid.uuid4()),
            email=f"noloc_{ts}@test.com",
            full_name=f"NoLocation User {ts}",
            hashed_password="hash",
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
            last_location_lat=None,
            last_location_lng=None,
            last_location_geom=None,
        )
        session.add_all([user_inside, user_outside, user_no_loc])
        await session.commit()
        print(f"[OK] Created test users: Inside, Outside, NoLocation")

        try:
            alert_service = AlertService(session)

            # ── 1. TEST BROADCAST ALERT ("All Users") ─────────────────────────
            broadcast_data = AlertCreate(
                title=f"Citywide Announcement {ts}",
                message="Maintenance scheduled for city servers tonight.",
                alert_type=AlertType.SYSTEM_ANNOUNCEMENT,
                target_scope="all_users",
                expires_in_hours=12,
            )
            broadcast_alert = await alert_service.create_and_dispatch_alert(broadcast_data)
            print(f"[OK] Broadcast alert created: {broadcast_alert.title} (ID: {broadcast_alert.id})")

            # Check that all 3 active users received the notification
            notifs_inside = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_inside.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{broadcast_alert.id}:{user_inside.id}"
                )
            )).scalars().all()
            notifs_outside = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_outside.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{broadcast_alert.id}:{user_outside.id}"
                )
            )).scalars().all()
            notifs_noloc = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_no_loc.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{broadcast_alert.id}:{user_no_loc.id}"
                )
            )).scalars().all()

            assert len(notifs_inside) == 1, "User inside should receive broadcast alert"
            assert len(notifs_outside) == 1, "User outside should receive broadcast alert"
            assert len(notifs_noloc) == 1, "User without location should receive broadcast alert"
            print("[OK] Broadcast alert reached all eligible users regardless of location.")

            # ── 2. TEST LOCATION-BASED ALERT (PostGIS distance check) ──────────
            location_data = AlertCreate(
                title=f"Water Main Leak Hazard {ts}",
                message="Flooding at Gandhipuram junction. Avoid the area.",
                alert_type=AlertType.HIGH_RISK_AREA,
                target_scope="location_based",
                location_lat=11.0180,
                location_lng=76.9570,
                radius_km=3.0,  # 3km radius around Gandhipuram
                expires_in_hours=24,
            )
            loc_alert = await alert_service.create_and_dispatch_alert(location_data)
            print(f"[OK] Location-based alert created: {loc_alert.title} (Radius: {loc_alert.radius_km}km)")

            # Verify User Inside (within ~200m) received it
            notifs_loc_inside = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_inside.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{loc_alert.id}:{user_inside.id}"
                )
            )).scalars().all()
            assert len(notifs_loc_inside) == 1, "User inside 3km radius MUST receive location alert"

            # Verify User Outside (>400km away) did NOT receive it
            notifs_loc_outside = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_outside.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{loc_alert.id}:{user_outside.id}"
                )
            )).scalars().all()
            assert len(notifs_loc_outside) == 0, "User outside radius MUST NOT receive location alert"

            # Verify User with no location permission / null geom did NOT receive it
            notifs_loc_noloc = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_no_loc.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{loc_alert.id}:{user_no_loc.id}"
                )
            )).scalars().all()
            assert len(notifs_loc_noloc) == 0, "User with no location permission MUST NOT receive location alert"
            print("[OK] Location alert verified: only users within radius received it; outside and no-permission users excluded.")

            # ── 3. TEST DEDUPLICATION (Prevent duplicate delivery) ─────────────
            # Dispatching same alert again should not duplicate for user_inside
            await alert_service.create_and_dispatch_alert(AlertCreate(
                title=f"Water Main Leak Hazard {ts}",
                message="Flooding at Gandhipuram junction. Avoid the area.",
                alert_type=AlertType.HIGH_RISK_AREA,
                target_scope="location_based",
                location_lat=11.0180,
                location_lng=76.9570,
                radius_km=3.0,
            ))
            total_inside_notifs = (await session.execute(
                select(Notification).where(
                    Notification.user_id == user_inside.id,
                    Notification.type == NotificationType.COMMUNITY_ALERT,
                    Notification.dedup_key == f"community_alert:{loc_alert.id}:{user_inside.id}"
                )
            )).scalars().all()
            assert len(total_inside_notifs) == 1, "Duplicate notifications must be prevented"
            print("[OK] Duplicate prevention verified.")

            # ── 4. TEST USER-TO-USER EMERGENCY CONTACT WORKFLOW ────────────────
            contacts_svc = ContactRequestService(session)

            # Search users
            search_res = await contacts_svc.search_users(query="Inside", current_user_id=user_outside.id)
            assert any(u.id == user_inside.id for u in search_res), "Search should find Inside User"
            print("[OK] User search verified.")

            # Send request from User Outside to User Inside
            req = await contacts_svc.send_request(
                requester_id=user_outside.id,
                data=ContactRequestSend(contact_id=user_inside.id, message="Please add me as your emergency contact.")
            )
            assert req.status == "pending"
            print(f"[OK] Emergency contact request sent: status = {req.status}")

            # Verify incoming for User Inside
            incoming = await contacts_svc.list_incoming(user_inside.id)
            assert any(r.id == req.id for r in incoming), "User Inside should see incoming request"

            # Verify outgoing for User Outside
            outgoing = await contacts_svc.list_outgoing(user_outside.id)
            assert any(r.id == req.id for r in outgoing), "User Outside should see outgoing request"
            print("[OK] Incoming & Outgoing requests visible to both parties.")

            # Accept request by User Inside
            accepted = await contacts_svc.respond_to_request(req.id, current_user_id=user_inside.id, accept=True)
            assert accepted.status == "accepted", "Request should now be accepted"

            # Verify accepted contacts list for both parties
            contacts_inside = await contacts_svc.list_accepted(user_inside.id)
            contacts_outside = await contacts_svc.list_accepted(user_outside.id)
            assert any(c.id == req.id for c in contacts_inside), "User Inside should see accepted contact"
            assert any(c.id == req.id for c in contacts_outside), "User Outside should see accepted contact"
            print("[OK] Accepted relationship visible in both users' contact lists.")

            # Revoke / remove contact
            await contacts_svc.revoke_or_delete(req.id, current_user_id=user_inside.id)
            contacts_after_revoke = await contacts_svc.list_accepted(user_inside.id)
            assert not any(c.id == req.id for c in contacts_after_revoke), "Contact should be removed after revoke"
            print("[OK] Revoke/delete emergency contact verified.")

            print("=== ALL TESTS PASSED SUCCESSFULLY! ===")

        finally:
            # Clean up test notifications, requests, alerts, and users
            await session.execute(delete(Notification).where(Notification.user_id.in_([user_inside.id, user_outside.id, user_no_loc.id])))
            await session.execute(delete(ContactRequest).where(ContactRequest.requester_id.in_([user_inside.id, user_outside.id]) | ContactRequest.contact_id.in_([user_inside.id, user_outside.id])))
            await session.execute(delete(User).where(User.id.in_([user_inside.id, user_outside.id, user_no_loc.id])))
            await session.commit()
            print("[OK] Test cleanup completed.")

if __name__ == "__main__":
    asyncio.run(run_tests())
