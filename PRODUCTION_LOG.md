# SafeCity Platform — Production Log & Changelog 🛡️

All platform updates, new features, category expansions, database seeding enhancements, and bug fixes are documented below.

---

## 📅 Release Version: 1.7.2 (October 2026) — Mobile Navigation Safety, Safety Map Parity & Android APK Logo Fixes 📱🗺️🚗

### 🌟 New Features & Enhancements

1. **Explore → Safety Map Parity & Missing Markers Resolution**
   - **Full Incident Visibility**: Replaced 25km-capped `/incidents/nearby` query with `IncidentsApi.listFiltered` (`limit: 500`), displaying all eligible incidents consistent with the web application.
   - **Unverified Marker Differentiation**: Verified markers are styled with severity color badges; unverified markers display grey background (`#6b7280`) with `?` indicator.
   - **Heatmap Layer Parity**: Aligned parameters with the web version (`radius: 35, blur: 20, minOpacity: 0.4, maxZoom: 18`, dynamic `max`, normalized weights `Math.max(0.5, p.weight || 1)`, and 5-stop gradient `#3b82f6` -> `#22c55e` -> `#eab308` -> `#f97316` -> `#ef4444`).
   - **Intuitive Area Safety-Score Checking**: Interactive map tap renders a visible red pulsing pin (`📍`) and accurately scaled 1 km radius circle (`radius: 1000m`), synchronized with the `SafetyScoreCard` and dismissal.

2. **Safe Route → Navigation Safety & Automated Emergency Triggers**
   - **15-Second Continuous Deviation Detection**: Tracks continuous off-route movement against route geometry; after 15 continuous seconds, triggers Web Audio notification chime, haptic vibration, and prominent 20-second countdown acknowledgement dialog.
   - **Acknowledgement Actions**:
     - **"I chose to leave the route"**: Immediately cancels the countdown, prompts/triggers safe route recalculation from current GPS position to destination, and updates the monitored corridor, preventing repeated alerts for the previous route.
     - **"SOS / Need help"**: Immediately cancels the countdown and triggers active emergency SOS workflow.
   - **Automatic SOS on Countdown Expiry**: If 20 seconds elapse without acknowledgement, automatically triggers emergency SOS, sharing live GPS coordinates with emergency contacts with deduplication protection.
   - **Destination Arrival Proximity Detection**: Automatic detection when user reaches within 40 meters (`DESTINATION_ARRIVAL_THRESHOLD_METERS = 40`) of destination, terminating tracking, clearing deviation alerts, and displaying a completion state.
   - **Throttled Live Area Safety Score (≥ 500m movement)**: Live HUD displays current area safety score, updating only after 500m of movement with debouncing, caching, and in-flight request deduplication.

3. **Android APK Logo & Adaptive Icon Assets**
   - Resolved blank/default icon issue caused by JPEG assets masquerading with `.png` extensions.
   - Generated true 32-bit RGBA PNG assets (`icon.png`, `adaptive-icon.png`, `splash.png`).
   - Generated complete Android mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) for `ic_launcher.png`, `ic_launcher_round.png`, and `ic_launcher_foreground.png`.
   - Configured adaptive icon XML drawables (`ic_launcher.xml` and `ic_launcher_round.xml`) referencing `@color/iconBackground` (`#0f172a`).

### 🔧 Files Changed

| Component | Files Changed |
|---|---|
| **Mobile Screens** | `apps/mobile/src/screens/explore/ExploreScreen.tsx`, `apps/mobile/src/screens/route/SafeRouteScreen.tsx` |
| **Mobile Utilities** | `apps/mobile/src/utils/geo.ts` |
| **Android Native & App Config** | `apps/mobile/assets/*`, `apps/mobile/android/app/src/main/res/mipmap-*`, `apps/mobile/app.json`, `app.json`, `apps/mobile/eas.json` |
| **Validation Tests** | `apps/mobile/src/__tests__/mobile_safety_fixes.test.ts` (21 passing unit tests) |

---

## 📅 Release Version: 1.7.1 (October 2026) — Two-Mode Admin Community Alerts & Web Emergency Contacts 📢📍

### 🌟 New Features & Enhancements

1. **Two-Mode Admin Community Alerts (`/admin/alerts` & `AlertService`)**
   - **Mode A: General / Broadcast Alert (`target_scope: 'all_users'`)**:
     - Allows administrators to broadcast high-priority notices, system updates, and city-wide emergency advisories to all registered, active citizens.
     - No coordinates or address required.
     - Dispatches through the unified in-app notification infrastructure (`type: NotificationType.COMMUNITY_ALERT`) and mobile push notifications via Expo Push API.
   - **Mode B: Location-Based Alert (`target_scope: 'location_based'`)**:
     - Allows administrators to target hazardous zones by selecting coordinates and specifying a coverage radius (km).
     - **No street address required**; admins pick locations directly on an interactive Leaflet map preview with dynamic circular coverage overlay (`L.circle`).
     - **PostGIS Proximity Filtering**: Queries active users whose last known location falls within the hazard radius using `ST_DWithin(users.last_location_geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius_m)`.
     - **Location Permission & Availability Compliance**: Citizens who have not granted location permissions or have no known coordinates (`last_location_geom IS NULL`) are strictly excluded from location-based delivery.
     - **Deduplication Protection**: Prevents duplicate deliveries via unique compound deduplication keys (`community_alert:{alert_id}:{user_id}`).
     - **Dynamic Catch-Up Delivery**: When mobile or web users submit location updates via `/contacts/location-check`, the system automatically checks for active geographic alerts in their new zone and delivers any previously unreceived warnings.

2. **Web Emergency Contacts (`/profile` & `EmergencyContactsManager`)**
   - Implemented reciprocal user-to-user emergency contacts inside the Web application under `/profile`.
   - **Search SafeCity Citizens**: Debounced search by full name or email across all registered citizens.
   - **Send Connection Requests**: Option to include an introduction / invitation message.
   - **Incoming & Outgoing Request Management**: Accept or decline incoming requests; review or cancel pending sent requests.
   - **Connected Contacts Hub**: View accepted SafeCity contacts who automatically receive SOS emergency coordinates.
   - **Cross-Platform Synchronization**: Web and Mobile operate against the exact same `/api/v1/contacts` backend endpoints and `contact_requests` table, guaranteeing real-time state parity.
   - Retained offline phonebook fallback for non-app emergency contacts.

3. **Database Migration 007 (`007_location_alerts.py`)**
   - `users`: Added `last_location_lat` (Float), `last_location_lng` (Float), `last_location_geom` (PostGIS Geography Point 4326), `location_updated_at` (DateTime), with GiST spatial index.
   - `community_alerts`: Added `target_scope` (VARCHAR(30), default `'all_users'`) with index.

### 🔧 Files Changed

| Component | Files Changed |
|---|---|
| **Backend Migrations & Models** | `migrations/versions/007_location_alerts.py`, `models/user.py`, `models/alert.py`, `schemas/alert.py` |
| **Backend Services & Routers** | `services/alert_service.py`, `services/location_notification_service.py`, `api/v1/routers/admin.py`, `api/v1/routers/users.py` |
| **Web Frontend API & Components** | `apps/web/src/api/alerts.ts`, `apps/web/src/api/contacts.ts`, `apps/web/src/pages/admin/AdminAlertsPage.tsx`, `apps/web/src/components/contacts/EmergencyContactsManager.tsx`, `apps/web/src/pages/ProfilePage.tsx` |
| **Web Navigation & Routing** | `apps/web/src/components/layout/AdminLayout.tsx`, `apps/web/src/App.tsx` |
| **Verification & Tests** | `apps/backend/test_alerts_and_contacts.py` |

---

## 📅 Release Version: 1.7.0 (October 2026) — User-to-User Contacts, Dark Mode, Push Notifications & Safe Areas 📱🌙

### 🌟 New Features & Enhancements

1. **User-to-User Emergency Contact Requests (`/api/v1/contacts`)**
   - Implemented reciprocal user-to-user emergency contacts with invitation, acceptance, rejection, and revocation lifecycle.
   - Verified SafeCity citizens can search users by email/name and send requests with optional custom messages.
   - When a citizen triggers an SOS emergency, all accepted user-to-user contacts are automatically notified via push notifications and in-app alerts with real-time GPS coordinates.
   - Backed by `contact_requests` table with migration `006_contact_requests`.

2. **Mobile Dark Mode System (`useTheme()`)**
   - Full dark theme color tokens created in `constants/theme.ts` supporting Light, Dark, and System preference.
   - Persistent theme store (`store/themeStore.ts`) with AsyncStorage caching.
   - Refactored mobile components and screens (`HomeScreen`, `ProfileScreen`, `NotificationsScreen`, `LoginScreen`, `RegisterScreen`, `MyIncidentsScreen`, `ReportScreen`, `SafeRouteScreen`, `EmergencyContactsScreen`, `Card`, `Header`, `Input`) to dynamically adapt styles to current theme.
   - Interactive theme switcher in Profile screen (Switch toggle + Light/Dark/System pills).

3. **System Bar & Safe Area Architecture (`SafeScreen`)**
   - Standardized `SafeScreen` component wrapping screens with proper `SafeAreaView` and keyboard avoidance.
   - Custom inset handling for map screens and floating overlay controls to prevent status bar and bottom gesture bar clipping on notched and edge-to-edge Android/iOS devices.

4. **Unified Push & Location Safety Notifications**
   - Integrated Expo Push Notification service (`push_service.py`) and token registration (`POST /api/v1/contacts/push-token`).
   - Extended `NotificationType` enum with `EMERGENCY_CONTACT_REQUEST`, `EMERGENCY_CONTACT_ACCEPTED`, `SOS_ALERT`, `NEARBY_INCIDENT`, and `UNSAFE_AREA`.
   - Proximity and danger-zone check endpoint (`POST /api/v1/contacts/location-check`) calculating safety score and nearby incidents within 5 km using PostGIS `ST_DWithin`.
   - Web `NotificationsPage` upgraded with distinct badge colors, icons, and routing for all new notification types.

5. **Anonymous Incident Ownership & Creator Participation**
   - Incidents reported anonymously now store `anonymous_reporter_id` internally (migration `005_anonymous_reporter_severity`).
   - Anonymous reporters can now track their submitted reports in "My Incidents", receive resolution status notifications, and participate in the resolution review workflow while remaining 100% anonymous to public/admin view.

### 🔧 Files Changed

| Component | Files Changed |
|---|---|
| **Backend Models & Migrations** | `migrations/versions/006_contact_requests.py`, `models/emergency.py`, `models/user.py`, `models/notification.py` |
| **Backend Services & Repositories** | `services/contact_request_service.py`, `services/push_service.py`, `services/location_notification_service.py`, `repositories/contact_request_repository.py`, `repositories/notification_repository.py` |
| **Backend Routers & Schemas** | `api/v1/routers/contacts.py`, `api/v1/router.py`, `schemas/contacts.py`, `schemas/notification.py` |
| **Mobile Core & Theme** | `constants/theme.ts`, `store/themeStore.ts`, `components/common/SafeScreen.tsx`, `utils/pushNotifications.ts` |
| **Mobile Screens & Navigation** | `screens/profile/EmergencyContactsScreen.tsx`, `screens/profile/ProfileScreen.tsx`, `screens/profile/MyIncidentsScreen.tsx`, `screens/report/ReportScreen.tsx`, `screens/route/SafeRouteScreen.tsx`, `navigation/MainStackNavigator.tsx` |
| **Web Frontend** | `src/pages/NotificationsPage.tsx` |

---

## 📅 Release Version: 1.6.1 (September 2026) — Lightweight Health Check & Keep-Alive 🩺

### 🌟 New Features & Enhancements

1. **Lightweight Health Endpoint (`apps/backend/app/main.py`)**
   - Exposed `GET /health` at root level returning HTTP 200 with minimal payload `{"status": "ok"}`.
   - Operates purely in-memory: bypasses database connections, OSRM queries, and authentication middleware for lowest latency and resource cost.
   - Tagged under `"Health"` with clear OpenAPI summary/docstrings.

2. **Render Demo Availability / Keep-Alive Guidance**
   - Documented external uptime / cron setup (e.g., UptimeRobot, cron-job.org) targeting `/health` at ~10-minute intervals to prevent Render free-tier sleep cycles during development and demos.
   - Confirmed production Render start command compatibility (`python -m app.db.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT`).

### 🔧 Files Changed

| File | Change |
|---|---|
| `apps/backend/app/main.py` | Updated `/health` endpoint to return minimal `{"status": "ok"}` without external dependencies |
| `README.md` | Added Production Health & Availability documentation with keep-alive instructions |
| `PRODUCTION_LOG.md` | This entry |

---

## 📅 Release Version: 1.6.0 (September 2026) — Avoidance-Buffer Safe Routing 🚧


### 🌟 New Features & Enhancements

1. **500 m Avoidance-Buffer Route Filtering (`route_service.py`)**
   - Before candidate deduplication and scoring, `RouteService` now queries PostGIS for all **HIGH** and **CRITICAL** severity, **route-relevant** (same category set as the scoring engine), **APPROVED/RESOLVED** incidents within a 10 km corridor around the requested start→destination line.
   - Each qualifying incident creates a **500 m avoidance zone**.  Any candidate route whose OSRM polyline contains a decoded waypoint inside any avoidance zone is **rejected** from the candidate pool.
   - Avoidance check is a pure-Python haversine pass over the already-decoded polyline waypoints — no extra PostGIS query per candidate.
   - **Fallback**: if every candidate is rejected (danger zones block all routes), the system re-requests OSRM Stage 1 and returns results with `avoidance_warning: true`, so the frontend can surface an advisory instead of showing an empty response.

2. **Updated Route API Response Fields**
   - `avoidance_zone_count` — number of HIGH/CRITICAL incidents that created avoidance zones for this request.
   - `avoidance_filtered_count` — number of candidate routes rejected by the avoidance filter.
   - `avoidance_warning` — `true` when every candidate was filtered and the fallback pool was used.

3. **Logging**
   - `avoidance_zones` query result count logged at `INFO` level.
   - Filtered candidate labels logged at `INFO` level for observability.
   - Fallback trigger logged at `WARNING` level.

4. **Documentation**
   - `README.md` updated with a new *Avoidance-Buffer Route Filtering* section.
   - Module-level docstring in `route_service.py` updated to document Stage 3.

### 🔧 Files Changed

| File | Change |
|---|---|
| `apps/backend/app/services/route_service.py` | Added `_fetch_avoidance_zones`, `_candidate_intersects_avoidance`, updated `_collect_candidates` and `get_safe_route` |
| `README.md` | Added avoidance-buffer documentation section |
| `PRODUCTION_LOG.md` | This entry |

---

## 📅 Release Version: 1.5.0 (September 2026) — Android Mobile App Implementation 📱

 
### 🌟 New Features & Enhancements

1. **Interactive Safety Map Screen (`MapScreen.tsx`)**
   - Embedded Leaflet 1.9.4 + OpenStreetMap / CartoDB Voyager tiles via `react-native-webview`, fully matching SafeCity's web map architecture with zero external API key requirements.
   - User location marker with blue pulsating GPS ring and "Center on Me" FAB button.
   - Rendered real approved incidents from FastAPI `/api/v1/incidents/nearby` using custom teardrop SVG pins colored by severity (`low`, `medium`, `high`, `critical`) with category icons.
   - Interactive bidirectional messaging: tapping a marker sends a postMessage from WebView to React Native opening the **Incident Details Bottom Sheet / Modal**.
   - Added category filter chips (All Categories + individual category chips) and severity filter chips (`All`, `Critical`, `High`, `Medium`, `Low`).
   - Added Map View / List View toggle button with full card list fallback.
   - Comprehensive loading, error, empty, and permission states.

2. **Mobile Incident Reporting Screen (`ReportScreen.tsx`)**
   - Fetches real categories dynamically from `/api/v1/incidents/categories`.
   - 4-tier severity selector with color-coded active states.
   - Validated title and description inputs.
   - **Evidence Photo Attachment**: Integrated `expo-image-picker` with Camera capture and Photo Gallery picker, including thumbnail preview and remove capability.
   - **Automatic GPS Location Capture**: Integrated `expo-location` to automatically fetch current coordinates with reverse geocoding to prefill the address, including a "Refresh GPS" button.
   - **Review Before Submit Modal**: Summarizes title, description, category, severity, address, GPS coordinates, privacy state, and photo thumbnail before sending.
   - **Two-Stage Submission**: Creates incident via `POST /api/v1/incidents` and uploads evidence photo via `POST /api/v1/incidents/{id}/images` using `multipart/form-data`.
   - Resets form state completely upon successful submission and invalidates query caches.

3. **Location & Camera Permissions Architecture**
   - Configured `app.json` with Android permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`, `READ_EXTERNAL_STORAGE`.
   - Handled `granted`, `denied`, `revoked`, and location unavailable states gracefully, falling back to default Coimbatore coordinates (`11.0168, 76.9558`).

4. **Android Build & Testing Setup (`eas.json` & Gradle)**
   - Configured `eas.json` with a `preview` profile targeting `apk` build type for direct device installation without Google Play Store requirements.
   - Configured `env.ts` with `EXPO_PUBLIC_API_URL` support, defaulting to active Wi-Fi LAN IP (`http://10.89.126.243:8000/api/v1`) for physical devices and `10.0.2.2` for Android emulator.
   - Generated native Android project via `npx expo prebuild --platform android` with Gradle wrapper.

---

## 📅 Release Version: 1.4.0 (August 2026)

### 🌟 New Features & Enhancements

1. **Admin Dashboard Completion (Real DB Data)**
   - Updated [AdminDashboardPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminDashboardPage.tsx) with 6 comprehensive stat cards: Total Users, Total Incidents, Pending, Approved, Rejected, and Resolved.
   - Added **Incident Trends** 7-day daily volume bar chart powered by real DB timestamps (`daily_trend`).
   - Added **Recent Incidents** list displaying the 5 latest reported incidents with status badges and quick view link.
   - Strictly enforced severity order: **Low → Medium → High → Critical** across pie chart and data legends.

2. **Admin Incident Management Completion**
   - Added **Severity Filter** dropdown (`All Severities`, `Low`, `Medium`, `High`, `Critical`) in [AdminIncidentsPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminIncidentsPage.tsx).
   - Added **Delete Incident** action per row with a red confirmation dialog connected to `DELETE /api/v1/admin/incidents/{id}`.
   - Added **Incident Details Modal** displaying full description, location coordinates, reporter info, admin notes, and attached proof images.
   - Updated `list_nearby` spatial PostGIS queries to filter by `APPROVED` incidents only so pending/rejected reports do not leak into public maps.

3. **Admin User Management Completion**
   - Added **Role Filter** dropdown (`All Roles`, `Citizens`, `Admins`) in [AdminUsersPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminUsersPage.tsx) connected to backend `role` query param.
   - Added **User Details Modal** displaying complete profile information (avatar, full name, email, role, member since, phone, location, bio) while keeping secrets (passwords/hashes/tokens/OTPs) strictly hidden.
   - Maintained user account activation/deactivation toggles (`PATCH /admin/users/{id}/activate` and `/deactivate`).

4. **Forgot Password via Email OTP (4-Step Flow)**
   - Created new DB model `PasswordResetOTP` in [password_reset.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/models/password_reset.py) and Alembic migration `003_add_password_reset_otp.py`.
   - Created async SMTP email service [email_service.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/services/email_service.py) using `aiosmtplib` with branded HTML OTP email templates.
   - Created [password_reset_service.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/services/password_reset_service.py) with 6-digit numeric OTP generation, bcrypt OTP hashing, 10-minute expiration, max 5 verification attempts, and 60-second request rate-limiting.
   - Implemented 3 new API endpoints:
     - `POST /api/v1/auth/forgot-password` (Step 1 - Request OTP)
     - `POST /api/v1/auth/verify-reset-otp` (Step 2 - Verify OTP & get reset token)
     - `POST /api/v1/auth/reset-password` (Step 3 - Set new password)
   - Created multi-step frontend page [ForgotPasswordPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/auth/ForgotPasswordPage.tsx) with step indicators, resend OTP, and auto-redirect.
   - Added "Forgot Password?" link to [LoginPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/auth/LoginPage.tsx).

---

## 📅 Release Version: 1.3.0 (August 2026)

### 🌟 New Features & Enhancements

1. **Scrollable Category Dropdowns (All Pages)**
   - Updated [select.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/components/ui/select.tsx) `SelectViewport` to include `max-h-60 overflow-y-auto`, making all category dropdowns scrollable with a fixed height across all pages: Map, Safety Map, Incidents, Report Incident, Admin Incidents, Admin Learning.

2. **User Incidents Page — Sort By Severity & Date**
   - Added **Sort By** dropdown in [IncidentFilters.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/components/incidents/IncidentFilters.tsx) with options:
     - `Sort by Severity` (Default — Critical → High → Medium → Low)
     - `Sort by Date (Newest First)`
     - `Sort by Date (Oldest First)`
   - Extended Zustand filter store [filters.ts](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/store/filters.ts) with `sort_by` field.
   - Extended public [incidents.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/api/v1/routers/incidents.py) endpoint with `sort_by` query parameter.
   - Added `date_asc` sort branch to [incident_repository.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/repositories/incident_repository.py).

3. **Live Map — Unverified Incidents Toggle**
   - Added a toggle button **"Unverified"** in [MapPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/MapPage.tsx) header controls — enabled by default.
   - When enabled, pending/unverified incidents are displayed as **greyed-out markers** at 65% opacity on the map.
   - Unverified markers display a distinct ⚠️ popup indicating pending verification.
   - Added `unverifiedIncidents` prop to [IncidentMap.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/components/map/IncidentMap.tsx), rendered as a separate layer below approved incidents.

4. **Admin Dashboard Category Chart — Extended Sort Options**
   - Updated `Incidents by Category` chart in [AdminDashboardPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminDashboardPage.tsx) with new sort options:
     - `By Severity (Default)` — highest incident count first
     - `Date — Highest Count` — descending by count
     - `Date — Lowest Count` — ascending by count
     - `Name (A–Z)` / `Name (Z–A)` — alphabetical

---

## 📅 Release Version: 1.2.0 (August 2026)

### 🌟 New Features & Enhancements

1. **Comprehensive 97 Incident Categories Expansion**
   - Expanded incident category taxonomy across frontend and backend from 8 generic categories to **97 granular categories**.
   - Categories cover core safety, crime, theft, assault, traffic, vehicle breakdowns, utility outages, public infrastructure, environmental hazards, public health, cybersecurity, emergency distress, and accessibility.
   - Fully backward-compatible with all pre-existing category slugs.

2. **Admin Dashboard Category Analytics (Top 10 & Interactive Sorting)**
   - Updated the **Incidents by Category** graph in [AdminDashboardPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminDashboardPage.tsx) to display **only the Top 10 categories**.
   - Added an interactive **Sort By** dropdown menu in the chart header:
     - `Highest Count` (Default)
     - `Lowest Count`
     - `Name (A–Z)`
     - `Name (Z–A)`

3. **Admin Incidents Sorting Options (Dropdown Filter)**
   - Added a **Sort By** dropdown menu on the [AdminIncidentsPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminIncidentsPage.tsx) table filter bar.
   - Sets **Severity** as the default sort option.
   - Users can choose to sort by **Severity**, **Status**, **Date (Newest First)**, and **Category**.
   - Optimized backend DB query engine in [incident_repository.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/repositories/incident_repository.py) to perform these SQL case operations.

4. **Seeding Program Optimization (55 Category-Rich Incidents)**
   - Updated [seed_db.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/db/seed_db.py) to generate 55 realistic incident reports covering max unique categories.
   - Intelligent category-to-severity mapping (e.g. Emergencies/Crimes/Fires mapped to `High`/`Critical`, Utilities/Cleanliness mapped to `Low`/`Medium`).
   - Realistic Coimbatore GPS coordinates with jitter, detailed street addresses, and image attachments.

5. **Notifications Deduplication & Display Rule**
   - Implemented notification ID deduplication in [DashboardPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/DashboardPage.tsx) and [NotificationsPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/NotificationsPage.tsx).
   - Display **only up to 3 unique notifications** on the citizen dashboard. If fewer than 3 exist, only available items are displayed without artificial placeholders.

6. **Shortest Route Calculation Optimization**
   - Enhanced [route_service.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/services/route_service.py) with OSRM candidate route alternatives (`alternatives=true`).
   - Implemented exact Haversine geodesic distance calculation to compare segment lengths accurately and ensure `shortest_route_idx` selects the true shortest route.

---

### 🐛 Bug Fixes & Technical Adjustments

1. **Seeder KeyError Fix**
   - Resolved `KeyError: 'medical_emergency'` in `seed_db.py` by introducing safe `.get()` fallback template selection for any category slug.

2. **Severity Chart Ordering & Original Palette**
   - Restored exact original pie chart color palette in `AdminDashboardPage.tsx`:
     - **Low**: `#0b00acff` (Deep Blue)
     - **Medium**: `#008300ff` (Green)
     - **High**: `#dad601ff` (Gold)
     - **Critical**: `#ff0000ff` (Red)
   - Enforced strict ordering: **Low → Medium → High → Critical** across data, labels, tooltips, and legends.

3. **Admin Incident Category Filter**
   - Added a Category filter dropdown to [AdminIncidentsPage.tsx](file:///d:/MCA/Mini%20Project/Safe%20City/apps/web/src/pages/admin/AdminIncidentsPage.tsx) connected to backend API endpoint params.

---

## 🛠️ Commands for Updating & Re-seeding Database

To apply category expansions and re-seed 55 realistic Coimbatore incidents:

```bash
cd apps/backend
python -m app.db.init_db
```

---

## 📅 Release Version: 1.3.0 (October 2026)

### 🌟 New Features & Enhancements

1. **Gemini-Powered AI Safety Assistant (FastAPI Backend)**
   - Integrated Google Gemini API using `google-genai` SDK with an asynchronous `httpx` REST fallback for high availability.
   - Strictly enforced backend-only secrets handling (`GEMINI_API_KEY` is never exposed to web or mobile clients).
   - Configurable model (`GEMINI_MODEL=gemini-2.5-flash`), output token limit (`800`), temperature (`0.2`), and timeout (`15.0s`).
   - Implemented in-memory sliding-window rate limiting (`20 req/min`) and character length limit (`600 chars`).

2. **Strict Safety Guardrails & Anti-Hallucination Engine**
   - **Zero-Cost Prompt Injection Defense**: Pre-flight regex filters block jailbreak attempts and system prompt disclosures with 0 Gemini API calls.
   - **Immediate Danger Protocol**: Detects active emergency threats and returns immediate priority instructions to call **112** and trigger SafeCity SOS without conversational delay.
   - **Zero-Cost Off-Topic Filtering**: Rejects non-safety queries (recipes, sports, code, trivia) with a concise canned scope message.
   - **Domain Grounding**: Grounds responses exclusively in verified SafeCity features, verified Indian emergency helplines (112, 100, 101, 108, 1091, 1098, 14567, 1930), verified legal statutes (POSH Act 2013, POCSO Act 2012, IT Act 2000, Good Samaritan Law, IPC/BNS in India), and dynamic Learning Hub articles.

3. **Facebook Messenger-Style Web Chat Widget**
   - Added floating action button at the bottom-right corner with status badge, tooltip, and pulse glow.
   - Compact Messenger-style popup window with minimize, maximize/full-screen, and close controls.
   - Session chat history, quick suggestions carousel, typing animations, error banners, and clear-chat control.
   - Responsive layout designed to never obscure core page controls.
   - Embedded interactive "Ask SafeCity AI" banner on `/learning` (Learning Hub) with pre-filled question pills.

4. **Dedicated Full-Screen Android Chat Experience**
   - Added chatbot launcher icon beside the notification bell at the top-right of the Home dashboard.
   - Created full-screen `ChatScreen` with `SafeScreen` integration conforming to Android status-bar and navigation-bar rules.
   - Keyboard-aware scrolling and input management.
   - Direct 1-tap `112` emergency call shortcut in the top header.
   - Seamless dark/light theme alignment matching citizen preferences.

5. **Quality Assurance & Security Verification**
   - Passed 8/8 comprehensive pytest unit and integration tests covering relevant queries, off-topic rejection, injection blocking, immediate danger triggers, rate limiting, and secret concealment.
   - Verified 0 TypeScript compilation errors on both Web and Mobile (`tsc --noEmit`).
   - Verified zero exposure of `GEMINI_API_KEY` across all client bundles and git-tracked assets.

