# SafeCity Platform — Production Log & Changelog 🛡️

All platform updates, new features, category expansions, database seeding enhancements, and bug fixes are documented below.

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
