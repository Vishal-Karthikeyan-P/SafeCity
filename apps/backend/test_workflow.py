import asyncio
import uuid
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.incident import Incident, IncidentCategory, IncidentStatus, ResolutionStatus
from app.services.incident_service import IncidentService
from app.schemas.incident import UpdateIncidentStatusRequest, ResolutionRequestCreate, ResolutionRequestReview
from fastapi import HTTPException

async def run_tests():
    print("=== Testing Status Workflow & Resolution Requests ===")
    async with AsyncSessionLocal() as session:
        service = IncidentService(session)

        # 1. Fetch or create test users
        from sqlalchemy import select
        res_users = await session.execute(select(User).limit(2))
        users = list(res_users.scalars().all())
        admin_user = next((u for u in users if u.role == UserRole.ADMIN), None)
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                email=f"admin_{uuid.uuid4().hex[:6]}@safecity.com",
                full_name="Admin Test",
                hashed_password="hash",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin_user)
            await session.flush()

        creator_user = User(
            id=str(uuid.uuid4()),
            email=f"creator_{uuid.uuid4().hex[:6]}@safecity.com",
            full_name="Creator Test",
            hashed_password="hash",
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
        )
        other_user = User(
            id=str(uuid.uuid4()),
            email=f"other_{uuid.uuid4().hex[:6]}@safecity.com",
            full_name="Other Citizen",
            hashed_password="hash",
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
        )
        session.add(creator_user)
        session.add(other_user)
        await session.flush()

        # Get a category
        res_cat = await session.execute(select(IncidentCategory).limit(1))
        category = res_cat.scalar_one_or_none()
        assert category is not None, "No category found in database"

        # 2. Create a test incident in PENDING status
        test_inc = Incident(
            id=str(uuid.uuid4()),
            title="Test Pothole Workflow Incident",
            description="A test incident created to verify status transitions.",
            category_id=category.id,
            severity="medium",
            status=IncidentStatus.PENDING,
            location_lat=11.0168,
            location_lng=76.9558,
            reporter_id=creator_user.id,
        )
        session.add(test_inc)
        await session.flush()
        print(f"Created incident #{test_inc.id[:8]} with status: {test_inc.status.value}")

        # 3. Test Invalid Transition: PENDING -> RESOLVED (must fail)
        try:
            await service.update_status(
                test_inc.id,
                UpdateIncidentStatusRequest(status=IncidentStatus.RESOLVED, admin_note="Resolve directly"),
                admin_user
            )
            assert False, "PENDING -> RESOLVED should have raised 400"
        except HTTPException as e:
            assert e.status_code == 400
            print(f"[OK] Invalid transition PENDING -> RESOLVED correctly blocked: {e.detail}")

        # 4. Test Valid Transition: PENDING -> APPROVED
        approved_inc = await service.update_status(
            test_inc.id,
            UpdateIncidentStatusRequest(status=IncidentStatus.APPROVED, admin_note="Approved by admin"),
            admin_user
        )
        assert approved_inc.status == IncidentStatus.APPROVED.value
        print("[OK] Transition PENDING -> APPROVED succeeded.")

        # 5. Verify status history
        history = await service.get_status_history(test_inc.id)
        assert len(history) >= 1
        assert history[0].from_status == "pending"
        assert history[0].to_status == "approved"
        assert history[0].changed_by_id == admin_user.id
        print(f"[OK] Status history recorded: {history[0].from_status} -> {history[0].to_status} by admin")

        # 6. Test Other User submits resolution request
        res_req = await service.create_resolution_request(
            test_inc.id,
            ResolutionRequestCreate(
                explanation="I repaired the pothole with fresh tarmac.",
                evidence_url="/uploads/pothole_fixed.jpg"
            ),
            other_user
        )
        assert res_req.status == "pending"
        assert res_req.requester_id == other_user.id
        print(f"[OK] User resolution request created #{res_req.id[:8]} with status: {res_req.status}")

        # 7. Test Unauthorized Review: Other user tries to review request (must fail 403)
        try:
            await service.review_resolution_request(
                test_inc.id,
                res_req.id,
                ResolutionRequestReview(action="approve"),
                other_user
            )
            assert False, "Non-creator should not be able to review resolution request"
        except HTTPException as e:
            assert e.status_code == 403
            print(f"[OK] Unauthorized review correctly blocked with 403: {e.detail}")

        # 8. Test Creator Review: APPROVE resolution request
        reviewed_req = await service.review_resolution_request(
            test_inc.id,
            res_req.id,
            ResolutionRequestReview(action="approve"),
            creator_user
        )
        assert reviewed_req.status == "approved"
        print("[OK] Creator approved resolution request.")

        # 9. Verify Incident is now RESOLVED_UNVERIFIED (NOT RESOLVED!)
        refreshed_inc = await service.get_incident(test_inc.id)
        assert refreshed_inc.status == IncidentStatus.RESOLVED_UNVERIFIED.value, f"Expected resolved_unverified, got {refreshed_inc.status}"
        print(f"[OK] Incident status is now: {refreshed_inc.status} (NOT resolved directly).")

        # 10. Test Admin Final Review: Admin approves -> RESOLVED
        # First test: admin resolves without reason (should fail)
        try:
            await service.update_status(
                test_inc.id,
                UpdateIncidentStatusRequest(status=IncidentStatus.RESOLVED, admin_note=""),
                admin_user
            )
            assert False, "Resolving without reason should fail"
        except HTTPException as e:
            assert e.status_code == 400
            print(f"[OK] Resolution without reason correctly blocked: {e.detail}")

        # Admin resolves with reason
        final_inc = await service.update_status(
            test_inc.id,
            UpdateIncidentStatusRequest(status=IncidentStatus.RESOLVED, admin_note="Verified by city engineer on-site"),
            admin_user
        )
        assert final_inc.status == IncidentStatus.RESOLVED.value
        print(f"[OK] Admin final approval produced: {final_inc.status}")

        # 11. Test Creator Rejection Flow with a new incident
        test_inc2 = Incident(
            id=str(uuid.uuid4()),
            title="Test Streetlight Incident",
            description="Streetlight is out.",
            category_id=category.id,
            severity="low",
            status=IncidentStatus.APPROVED,
            location_lat=11.0168,
            location_lng=76.9558,
            reporter_id=creator_user.id,
        )
        session.add(test_inc2)
        await session.flush()

        res_req2 = await service.create_resolution_request(
            test_inc2.id,
            ResolutionRequestCreate(explanation="I think it works now", evidence_url="/uploads/light.jpg"),
            other_user
        )
        rejected_req = await service.review_resolution_request(
            test_inc2.id,
            res_req2.id,
            ResolutionRequestReview(action="reject", rejection_reason="Light is still flickering erratically"),
            creator_user
        )
        assert rejected_req.status == "rejected"
        assert rejected_req.rejection_reason == "Light is still flickering erratically"
        inc2_check = await service.get_incident(test_inc2.id)
        assert inc2_check.status == IncidentStatus.APPROVED.value
        print(f"[OK] Creator rejection preserved previous status ({inc2_check.status}) and stored reason: {rejected_req.rejection_reason}")

        # Cleanup test incidents
        await session.delete(test_inc)
        await session.delete(test_inc2)
        await session.delete(creator_user)
        await session.delete(other_user)
        await session.commit()
        print("=== ALL STATUS WORKFLOW & RESOLUTION TESTS PASSED! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
