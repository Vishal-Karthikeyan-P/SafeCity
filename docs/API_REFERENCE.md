# SafeCity — API Reference

## 1. Overview

Base URL: `/api/v1`
Swagger UI: `/docs`
Health Check: `/health`

## 2. Authentication

All endpoints except `/auth/*` and `/incidents/categories` require a Bearer token in the `Authorization` header.

### 2.1 Auth Module (`/auth`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | No | Register new citizen |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/forgot-password` | No | Request OTP for password reset |
| POST | `/auth/verify-reset-otp` | No | Verify 6-digit OTP |
| POST | `/auth/reset-password` | No | Reset password with token |
| GET | `/auth/me` | Yes | Get current user |

**Request/Response details**:

- **POST `/auth/register**
  - Body: `{email, password, full_name}`
  - Response: `{access_token, refresh_token, token_type}`
  - Validation: password ≥ 8 chars, full_name ≥ 2 chars

- **POST `/auth/login`**
  - Body: `{email, password}`
  - Response: `{access_token, refresh_token, token_type}`
  - Errors: 401 (no user / incorrect password), 403 (inactive)

- **POST `/auth/forgot-password`**
  - Body: `{email}`
  - Response: `{message: "If the email is registered, an OTP has been sent."}`
  - Always generic to prevent enumeration

- **POST `/auth/verify-reset-otp`**
  - Body: `{email, otp}`
  - Response: `{reset_token, message}`
  - OTP: 6 digits, max 5 attempts, 60s cooldown

- **POST `/auth/reset-password`**
  - Body: `{reset_token, new_password, confirm_password}`
  - Response: `{message}`

## 3. Users Module (`/users`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/users/me` | Yes | Get my profile |
| PUT | `/users/me` | Yes | Update profile |
| POST | `/users/me/avatar` | Yes | Upload avatar (jpg/png/webp, <5MB) |
| POST | `/users/me/change-password` | Yes | Change password |
| DELETE | `/users/me` | Yes | Soft-delete account |
| GET | `/users/me/contacts` | Yes | List emergency contacts |
| POST | `/users/me/contacts` | Yes | Add contact (max 5) |
| PATCH | `/users/me/contacts/{id}` | Yes | Update contact |
| DELETE | `/users/me/contacts/{id}` | Yes | Delete contact |

## 4. Incidents Module (`/incidents`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/incidents/categories` | No | List active categories |
| GET | `/incidents/nearby` | No | Spatial query (lat, lng, radius_km) |
| GET | `/incidents` | No | List incidents (paginated, filters) |
| GET | `/incidents/heatmap` | No | Heatmap points |
| POST | `/incidents` | Yes | Create incident |
| GET | `/incidents/my` | Yes | My incidents |
| GET | `/incidents/{id}` | No | Get single incident |
| POST | `/incidents/{id}/images` | Yes | Upload images (max 5) |

**Query params for GET `/incidents`**:
- `page` (default 1), `limit` (default 10, max 1000)
- `category_id`, `severity`, `status`, `date_from`, `date_to`, `search`, `sort_by`

**Query params for GET `/incidents/nearby`**:
- `lat` (required, -90 to 90), `lng` (required, -180 to 180)
- `radius_km` (default 5.0, 0.1 to 50)
- `category_id`, `severity` (optional)

**POST `/incidents` body**:
- `title` (≥5 chars), `description` (≥10 chars)
- `category_id`, `severity` (default medium)
- `is_anonymous` (default false)
- `location_lat`, `location_lng` (validated ranges)
- `location_address` (optional)

## 5. Safety Module (`/safety`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/safety/area` | No | Area safety score |
| GET | `/safety/city` | No | City overview |

**GET `/safety/area` params**:
- `lat` (required), `lng` (required)
- `radius_km` (default 1.0, 0.1 to 50)

**Response**:
```json
{
  "score": 85.5,
  "risk_level": "safe",
  "incident_count": 3,
  "density_per_km2": 0.95,
  "top_categories": [{"name": "Crime", "icon": "🚨", "count": 2}],
  "recent_7d": 1,
  "recent_30d": 2
}
```

**GET `/safety/city` params**:
- `city_lat` (default 11.0168), `city_lng` (default 76.9558)
- `radius_km` (default 20.0, 1 to 100)

## 6. Routes Module (`/routes`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/routes/plan` | No | Plan safe route |

**GET `/routes/plan` params**:
- `start_lat`, `start_lng`, `dest_lat`, `dest_lng` (all required)

**Response**:
```json
{
  "routes": [
    {
      "geometry": "encoded_polyline",
      "distance_m": 3200.5,
      "duration_s": 600.0,
      "safety_score": 85.0,
      "route_risk_level": "safe",
      "incidents": []
    }
  ],
  "shortest_route_idx": 0,
  "safest_route_idx": 1
}
```

## 7. SOS Module (`/sos`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/sos` | Yes | Trigger SOS |
| PATCH | `/sos/resolve` | Yes | Resolve SOS |

**POST `/sos` body**: `{location_lat, location_lng}`
**PATCH `/sos/resolve` body**: `{status: "resolved" | "false_alarm"}`

## 8. Alerts Module (`/alerts`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/alerts` | No | List active alerts |

**GET `/alerts` params: `page` (default 1), `limit` (default 10, max 100)

## 9. Learning Module (`/learning`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/learning/categories` | No | List article categories |
| GET | `/learning/articles` | No | List articles |
| GET | `/learning/articles/{slug_or_id}` | No | Get article |

**GET `/learning/articles` params**: `page`, `limit`, `category_id`, `search`

## 10. Notifications Module (`/notifications`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | Yes | List my notifications |
| PATCH | `/notifications/{id}/read` | Yes | Mark as read |
| POST | `/notifications/read-all` | Yes | Mark all as read |

## 11. Search Module (`/search`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/search` | No | Global search |

**GET `/search` params**: `q` (required, min 2 chars)

**Response**: `{results: [{id, type, title, description, url}], total}`

## 12. Admin Module (`/admin`)

All admin endpoints require `role=admin`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/stats` | Platform stats |
| GET | `/admin/incidents` | List all incidents |
| PATCH | `/admin/incidents/{id}/status` | Update status |
| DELETE | `/admin/incidents/{id}` | Soft delete |
| GET | `/admin/users` | List users |
| PATCH | `/admin/users/{id}/activate` | Activate user |
| PATCH | `/admin/users/{id}/deactivate` | Deactivate user |
| PATCH | `/admin/users/{id}/role` | Change role |
| GET | `/admin/categories` | List categories |
| POST | `/admin/categories` | Create category |
| PATCH | `/admin/categories/{id}` | Update category |
| GET | `/admin/alerts` | List alerts |
| POST | `/admin/alerts` | Create alert |
| DELETE | `/admin/alerts/{id}` | Delete alert |
| GET | `/admin/articles` | List articles |
| POST | `/admin/articles` | Create article |
| PATCH | `/admin/articles/{id}` | Update article |
| DELETE | `/admin/articles/{id}` | Delete article |

## 13. Module Dependency Diagram

```mermaid
graph TD
    A[Frontend Web] -->|HTTP| B[API Gateway
    B --> C[Auth Router]
    B --> D[Users Router]
    B --> E[Incidents Router]
    B --> F[Safety Router]
    B --> G[Routes Router]
    B --> H[SOS Router]
    B --> I[Alerts Router]
    B --> J[Learning Router]
    B --> K[Notifications Router]
    B --> L[Search Router]
    B --> M[Admin Router]

    C --> C1[AuthService]
    C --> C2[PasswordResetService]
    D --> D1[UserRepository]
    E --> E1[IncidentService]
    E --> E2[IncidentRepository]
    F --> F1[SafetyScoreService]
    G --> G1[RouteService]
    G --> G2[SafetyScoreService]
    H --> H1[EmergencyService]
    I --> I1[AlertService]
    J --> J1[LearningService]
    K --> K1[NotificationRepository]
    M --> M1[IncidentService]
    M --> M2[UserRepository]
    M --> M3[AlertRepository]
    M --> M4[LearningRepository]