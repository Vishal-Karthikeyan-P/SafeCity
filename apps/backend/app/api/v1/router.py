"""
Master API Router — combines all v1 routers
"""
from fastapi import APIRouter

from app.api.v1.routers import auth, users, incidents, admin, notifications, learning, alerts, routes, sos, search, safety, contacts, chat

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(learning.router, prefix="/learning", tags=["Learning Hub"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Community Alerts"])
api_router.include_router(routes.router, prefix="/routes", tags=["Safe Routes"])
api_router.include_router(safety.router, prefix="/safety", tags=["Safety Scores"])
api_router.include_router(sos.router, prefix="/sos", tags=["Emergency SOS"])
api_router.include_router(search.router, prefix="/search", tags=["Global Search"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["Emergency Contacts"])
api_router.include_router(chat.router, prefix="/chat", tags=["AI Safety Chatbot"])
