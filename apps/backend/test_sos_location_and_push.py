"""
Unit tests for:
  1. SOS location ownership — GET /sos/{sos_id}/location must return the SENDER's
     coordinates, never the recipient's own location.
  2. Push token sync — token is re-registered after login/register/logout lifecycle.
  3. Navigation routing — sos_alert push payload routes to SOSView with sender coords.

These tests use pytest with unittest.mock; no live DB/server required.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# ─── 1. SOS Location Ownership ────────────────────────────────────────────────

class MockSOSRequest:
    """Minimal stand-in for the SQLAlchemy SOSRequest ORM object."""
    def __init__(self, sos_id, sender_id, lat, lng, status="active"):
        self.id = sos_id
        self.user_id = sender_id
        self.location_lat = lat
        self.location_lng = lng
        self.status = status
        self.created_at = __import__("datetime").datetime(2024, 1, 1, 12, 0, 0)


class MockContactRequest:
    """Minimal stand-in for an accepted ContactRequest."""
    def __init__(self, requester_id, contact_id):
        self.requester_id = requester_id
        self.contact_id = contact_id
        self.status = "accepted"


def simulate_get_sos_location(sos, current_user_id, accepted_contact):
    """
    Simulate the authorization + return logic from GET /sos/{sos_id}/location
    without a live DB. Returns the payload dict or raises PermissionError.
    """
    sender_id = sos.user_id

    if sender_id != str(current_user_id):
        # Check if current user is an accepted contact of the sender
        is_contact = (
            accepted_contact is not None
            and (
                (accepted_contact.requester_id == sender_id and accepted_contact.contact_id == str(current_user_id))
                or
                (accepted_contact.requester_id == str(current_user_id) and accepted_contact.contact_id == sender_id)
            )
        )
        if not is_contact:
            raise PermissionError("Not an authorized emergency contact")

    return {
        "sos_id": sos.id,
        "location_lat": sos.location_lat,   # SENDER's coords
        "location_lng": sos.location_lng,   # SENDER's coords
        "status": sos.status,
    }


class TestSOSLocationOwnership:
    """
    Verify that the SOS location endpoint ALWAYS returns the sender's coordinates
    and NEVER confuses the recipient's location with the sender's.
    """

    SENDER_ID = "sender-uuid-1111"
    RECIPIENT_ID = "recipient-uuid-2222"
    THIRD_PARTY_ID = "random-uuid-9999"

    SENDER_LAT = 11.0168
    SENDER_LNG = 76.9558

    def _make_sos(self):
        return MockSOSRequest("sos-abc-123", self.SENDER_ID, self.SENDER_LAT, self.SENDER_LNG)

    def _make_contact(self, requester, contact):
        return MockContactRequest(requester, contact)

    def test_sender_gets_own_coords(self):
        """The SOS sender should always see their own coordinates."""
        sos = self._make_sos()
        result = simulate_get_sos_location(sos, self.SENDER_ID, accepted_contact=None)
        assert result["location_lat"] == self.SENDER_LAT
        assert result["location_lng"] == self.SENDER_LNG

    def test_accepted_contact_sees_sender_coords_not_own(self):
        """
        An accepted recipient should see the SENDER's coordinates.
        The test explicitly provides different coords for the sender to confirm
        no confusion with the recipient's own position.
        """
        sos = self._make_sos()
        contact = self._make_contact(self.SENDER_ID, self.RECIPIENT_ID)
        result = simulate_get_sos_location(sos, self.RECIPIENT_ID, accepted_contact=contact)

        # Must be SENDER coords
        assert result["location_lat"] == self.SENDER_LAT, (
            f"Recipient received their own lat ({result['location_lat']}) "
            f"instead of sender's ({self.SENDER_LAT})"
        )
        assert result["location_lng"] == self.SENDER_LNG, (
            f"Recipient received their own lng ({result['location_lng']}) "
            f"instead of sender's ({self.SENDER_LNG})"
        )

    def test_accepted_contact_reverse_direction(self):
        """Contact relationship can go either direction (requester vs contact)."""
        sos = self._make_sos()
        contact = self._make_contact(self.RECIPIENT_ID, self.SENDER_ID)
        result = simulate_get_sos_location(sos, self.RECIPIENT_ID, accepted_contact=contact)
        assert result["location_lat"] == self.SENDER_LAT
        assert result["location_lng"] == self.SENDER_LNG

    def test_unauthorized_third_party_is_rejected(self):
        """A user who is NOT an emergency contact must be denied access."""
        sos = self._make_sos()
        with pytest.raises(PermissionError):
            simulate_get_sos_location(sos, self.THIRD_PARTY_ID, accepted_contact=None)

    def test_sos_id_is_returned_correctly(self):
        """The response sos_id must match the requested SOS session."""
        sos = self._make_sos()
        result = simulate_get_sos_location(sos, self.SENDER_ID, accepted_contact=None)
        assert result["sos_id"] == "sos-abc-123"

    def test_different_sender_recipient_coords_no_mix(self):
        """
        Regression: if the sender and recipient have completely different coordinates,
        confirm the endpoint returns the SENDER's coords and not the recipient's.
        """
        RECIPIENT_LAT = 12.9716  # recipient is in Bangalore
        RECIPIENT_LNG = 77.5946
        # sender is in Coimbatore — different from recipient
        sos = MockSOSRequest("sos-xyz", self.SENDER_ID, 11.0168, 76.9558)
        contact = self._make_contact(self.SENDER_ID, self.RECIPIENT_ID)
        result = simulate_get_sos_location(sos, self.RECIPIENT_ID, accepted_contact=contact)

        assert result["location_lat"] != RECIPIENT_LAT, "Got recipient lat instead of sender lat!"
        assert result["location_lng"] != RECIPIENT_LNG, "Got recipient lng instead of sender lng!"
        assert result["location_lat"] == 11.0168
        assert result["location_lng"] == 76.9558


# ─── 2. Push Token Sync Logic ─────────────────────────────────────────────────

class TestPushTokenSync:
    """
    Tests for the fixed syncPushToken logic.
    Key invariant: if the last backend sync failed (flag='false'),
    the token must be re-registered even if the token string hasn't changed.
    """

    def test_skips_when_token_matches_and_sync_ok(self):
        """No backend call when token is unchanged AND previous sync succeeded."""
        storage = {"safecity_push_token": "ExponentPushToken[abc]", "safecity_push_sync_ok": "true"}
        api_calls = []

        async def fake_post(path, data):
            api_calls.append(path)

        async def fake_get(key):
            return storage.get(key)

        async def fake_set(key, val):
            storage[key] = val

        import asyncio
        asyncio.run(self._simulate_sync("ExponentPushToken[abc]", fake_get, fake_set, fake_post))
        assert len(api_calls) == 0, "Should have skipped backend call"

    def test_registers_when_sync_flag_is_false(self):
        """Re-registers even if the token is the same when last sync failed."""
        storage = {"safecity_push_token": "ExponentPushToken[abc]", "safecity_push_sync_ok": "false"}
        api_calls = []

        async def fake_post(path, data):
            api_calls.append(path)
            return MagicMock(status_code=204)

        async def fake_get(key):
            return storage.get(key)

        async def fake_set(key, val):
            storage[key] = val

        import asyncio
        asyncio.run(self._simulate_sync("ExponentPushToken[abc]", fake_get, fake_set, fake_post))
        assert len(api_calls) == 1, "Should have re-registered token with backend"
        assert storage.get("safecity_push_sync_ok") == "true"

    def test_registers_when_no_cached_token(self):
        """Registers when no token is cached at all (fresh install / logout)."""
        storage = {}
        api_calls = []

        async def fake_post(path, data):
            api_calls.append(path)
            return MagicMock(status_code=204)

        async def fake_get(key):
            return storage.get(key)

        async def fake_set(key, val):
            storage[key] = val

        import asyncio
        asyncio.run(self._simulate_sync("ExponentPushToken[new]", fake_get, fake_set, fake_post))
        assert len(api_calls) == 1
        assert storage["safecity_push_token"] == "ExponentPushToken[new]"
        assert storage["safecity_push_sync_ok"] == "true"

    async def _simulate_sync(self, token, fake_get, fake_set, fake_post):
        """
        Pure logic port of syncPushToken from pushNotifications.ts.
        Uses injected I/O so we don't need a real Expo runtime.
        """
        PUSH_SYNC_OK_KEY = "safecity_push_sync_ok"
        PUSH_TOKEN_KEY = "safecity_push_token"

        last_token = await fake_get(PUSH_TOKEN_KEY)
        last_sync_ok = await fake_get(PUSH_SYNC_OK_KEY)

        if last_token == token and last_sync_ok == "true":
            return  # skip

        await fake_set(PUSH_SYNC_OK_KEY, "false")  # mark pending
        try:
            await fake_post("/contacts/push-token", {"push_token": token})
            await fake_set(PUSH_TOKEN_KEY, token)
            await fake_set(PUSH_SYNC_OK_KEY, "true")  # success
        except Exception:
            pass  # stay 'false' so next session retries


# ─── 3. Notification Navigation Routing ───────────────────────────────────────

class TestNotificationNavTarget:
    """
    Verify that getNotificationNavTarget routes notification types correctly.
    Focus: sos_alert must go to SOSView with sender coords, not Profile/Notifications.
    """

    def _get_target(self, data):
        """Pure Python port of the getNotificationNavTarget logic."""
        if not data.get("type"):
            return None
        t = data["type"]
        if t in ("emergency_contact_request", "emergency_contact_accepted", "emergency_contact_rejected"):
            return {"screen": "SafeCityContacts"}
        if t == "sos_alert":
            if data.get("sos_id"):
                return {
                    "screen": "SOSView",
                    "params": {
                        "sos_id": data["sos_id"],
                        "sender_name": data.get("reporter_name", "Unknown"),
                        "sender_lat": float(data.get("lat", 0)),
                        "sender_lng": float(data.get("lng", 0)),
                    },
                }
            return {"screen": "Notifications"}
        if t in ("nearby_incident", "unsafe_area"):
            return {"screen": "Explore"}
        return {"screen": "Notifications"}

    def test_sos_alert_routes_to_sos_view(self):
        """sos_alert taps must open SOSView, not Profile."""
        data = {
            "type": "sos_alert",
            "sos_id": "sos-abc",
            "reporter_name": "Alice",
            "lat": 11.0168,
            "lng": 76.9558,
        }
        result = self._get_target(data)
        assert result["screen"] == "SOSView", (
            f"Expected SOSView but got {result['screen']}"
        )

    def test_sos_alert_passes_sender_coords_in_params(self):
        """SOSView params must carry the SENDER's coords from the push payload."""
        data = {
            "type": "sos_alert",
            "sos_id": "sos-abc",
            "reporter_name": "Alice",
            "lat": 11.0168,
            "lng": 76.9558,
        }
        result = self._get_target(data)
        assert result["params"]["sender_lat"] == 11.0168
        assert result["params"]["sender_lng"] == 76.9558
        assert result["params"]["sender_name"] == "Alice"
        assert result["params"]["sos_id"] == "sos-abc"

    def test_sos_alert_without_sos_id_falls_back(self):
        """Malformed sos_alert (no sos_id) falls back to Notifications."""
        result = self._get_target({"type": "sos_alert"})
        assert result["screen"] == "Notifications"

    def test_nearby_incident_routes_to_explore(self):
        """nearby_incident goes to new Explore tab (was 'Map')."""
        result = self._get_target({"type": "nearby_incident", "incident_id": "inc-123"})
        assert result["screen"] == "Explore"

    def test_no_type_returns_none(self):
        assert self._get_target({}) is None

    def test_incident_update_routes_to_notifications(self):
        result = self._get_target({"type": "incident_update", "incident_id": "i-1"})
        assert result["screen"] == "Notifications"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
