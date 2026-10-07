# SafeCity — Diagram Sources (Mermaid)

**Companion to:** `SafeCity_Project_Report.md`
**Source of truth:** the diagrams below are derived exclusively from the implemented code in this repository (`apps/backend`, `apps/web`, `apps/mobile`, `docker/`). The identical Mermaid source appears at the corresponding location in the report.

All diagrams use vertical (`TB`) orientation where applicable so that they render A4-friendly.

| Figure | Diagram | Type | Report Location |
|---|---|---|---|
| Figure 1 | System Architecture | `flowchart TB` | §3.2 |
| Figure 2 | Module Architecture | `flowchart TB` | §3.3 |
| Figure 3 | Use Case Diagram | `flowchart TB` | §3.12.1 |
| Figure 4 | User Activity Diagram | `flowchart TB` | §3.12.2 |
| Figure 5 | Admin Activity Diagram | `flowchart TB` | §3.12.3 |
| Figure 6 | Class Diagram | `classDiagram` | §3.12.4 |
| Figure 7 | Login Sequence | `sequenceDiagram` | §3.12.5 |
| Figure 8 | Incident Reporting Sequence | `sequenceDiagram` | §3.12.6 |
| Figure 9 | Incident Verification Sequence | `sequenceDiagram` | §3.12.7 |
| Figure 10 | Safe Routing Sequence | `sequenceDiagram` | §3.12.8 |
| Figure 11 | Community Alert Sequence | `sequenceDiagram` | §3.12.9 |
| Figure 12 | Emergency Contact Sequence | `sequenceDiagram` | §3.12.10 |
| Figure 13 | Registration / Login BPMN | `flowchart TB` | §3.13.1 |
| Figure 14 | Incident Reporting BPMN | `flowchart TB` | §3.13.2 |
| Figure 15 | Incident Verification BPMN | `flowchart TB` | §3.13.3 |
| Figure 16 | Safe Routing BPMN | `flowchart TB` | §3.13.4 |
| Figure 17 | Community Alert BPMN | `flowchart TB` | §3.13.5 |
| Figure 18 | Emergency Contact BPMN | `flowchart TB` | §3.13.6 |
| Figure 19 | Context DFD | `flowchart TB` | §3.14.1 |
| Figure 20 | Level-1 DFD | `flowchart TB` | §3.14.2 |
| Figure 21 | Incident Management DFD | `flowchart TB` | §3.14.3 |
| Figure 22 | Safe Routing DFD | `flowchart TB` | §3.14.4 |
| Figure 23 | Safety Analysis DFD | `flowchart TB` | §3.14.5 |
| Figure 24 | ER Diagram | `erDiagram` | §3.15.1 |
| Figure 25 | Database Schema Layout | `flowchart TB` | §3.15.2 |
| Figure 26 | API Architecture | `flowchart TB` | §3.17 |
| Figure 27 | Security Architecture | `flowchart TB` | §3.18 |
| Figure 28 | Deployment Architecture | `flowchart TB` | §3.19 |
| Figure 29 | Safe Routing Flowchart | `flowchart TB` | §5.9 |
| Figure 30 | Area Safety Score Flowchart | `flowchart TB` | §5.5 |
| Figure 31 | Incident Risk (Severity) Flowchart | `flowchart TB` | §5.2 |
| Figure 32 | Alert Propagation Flowchart | `flowchart TB` | §5.13 |

---

---

## Figure 1 — System Architecture

```mermaid
flowchart TB
    subgraph CLIENTS["Client Applications"]
        WEB["Web App<br/>React 18 + Vite + TS<br/>guards + Zustand auth"]
        MOB["Mobile App<br/>React Native + Expo 50<br/>JWT interceptor + Secure Store"]
    end

    subgraph API["FastAPI Backend - apps/backend"]
        RT["API Routers /api/v1<br/>auth users incidents admin<br/>notifications learning alerts<br/>routes safety sos search contacts"]
        SVC["Services<br/>auth incident safety_score route<br/>alert emergency contact_request<br/>location_notification severity<br/>password_reset push email"]
        REPO["Repositories<br/>user incident notification<br/>alert emergency contact_request learning"]
        SEC["core: JWT, bcrypt, RBAC deps, CORS, config"]
    end

    subgraph DATA["Data Layer"]
        PG[("PostgreSQL 15 + PostGIS 3.3<br/>15 tables incl. incidents,<br/>notifications, sos_requests")]
        FS[("Upload storage<br/>apps/backend/uploads<br/>served at /uploads")]
    end

    subgraph EXT["External Services"]
        OSRM["OSRM routing API"]
        OSM["OpenStreetMap tiles"]
        EXPO["Expo Push API"]
        SMTP["SMTP - OTP email"]
    end

    WEB -- "HTTPS + Bearer JWT" --> RT
    MOB -- "HTTPS + Bearer JWT" --> RT
    RT --> SVC --> REPO --> PG
    SVC --> FS
    SVC -- "planning" --> OSRM
    SVC -- "push" --> EXPO
    SVC -- "OTP" --> SMTP
    WEB -- "tiles + heat layer" --> OSM
    MOB -- "tiles" --> OSM
```

## Figure 2 — Module Architecture

```mermaid
flowchart TB
    subgraph MOD["SafeCity Modules"]
        M1["Authentication<br/>register login refresh<br/>OTP password reset"]
        M2["User and Profile<br/>profile avatar password<br/>phonebook contacts"]
        M3["Incident Reporting<br/>create list detail images<br/>anonymity severity preview"]
        M4["Verification and Resolution<br/>status transitions resolution<br/>requests status history"]
        M5["Safety Analysis<br/>area score city overview<br/>shared hazard model"]
        M6["Safe Routing<br/>OSRM candidates risk<br/>Pareto selection 3-5 routes"]
        M7["Mapping<br/>markers clustering heatmap<br/>route polylines"]
        M8["Community Alerts<br/>broadcast + radius alerts<br/>admin publish"]
        M9["Notifications<br/>inbox dedup push<br/>location checks"]
        M10["Emergency<br/>SOS user-to-user contacts"]
        M11["Learning Hub<br/>articles + categories"]
        M12["Admin<br/>stats moderation users<br/>categories alerts articles"]
        M13["Search<br/>incidents + articles"]
    end

    M1 --> M2
    M2 --> M10
    M3 --> M4
    M3 --> M5
    M5 --> M6
    M6 --> M7
    M8 --> M9
    M10 --> M9
    M4 --> M9
    M12 --> M3
    M12 --> M8
    M12 --> M11
    M13 --> M3
    M13 --> M11
```

## Figure 3 — Use Case Diagram

```mermaid
flowchart TB
    subgraph SYS["SafeCity System"]
        UC1["Register account"]
        UC2["Login"]
        UC3["Reset password via OTP"]
        UC4["View dashboard"]
        UC5["Report incident<br/>with map location + images"]
        UC6["Report anonymously"]
        UC7["View my incidents"]
        UC8["View live safety map<br/>markers + heatmap + area score"]
        UC9["Plan safe route<br/>compare 3-5 routes"]
        UC10["Receive notifications<br/>nearby incident / unsafe area / alert"]
        UC11["Trigger SOS<br/>notify accepted contacts"]
        UC12["Manage emergency contacts<br/>phonebook + in-app requests"]
        UC13["View community alerts"]
        UC14["Request incident resolution"]
        UC15["Read learning articles"]
        UC16["Approve / reject / resolve incidents"]
        UC17["Publish broadcast or radius alert"]
        UC18["Manage users roles status"]
        UC19["Manage categories and articles"]
        UC20["View platform statistics"]
    end

    CITIZEN(["Citizen - role citizen"]) --> UC1
    CITIZEN --> UC2
    CITIZEN --> UC3
    CITIZEN --> UC4
    CITIZEN --> UC5
    CITIZEN --> UC6
    CITIZEN --> UC7
    CITIZEN --> UC8
    CITIZEN --> UC9
    CITIZEN --> UC10
    CITIZEN --> UC11
    CITIZEN --> UC12
    CITIZEN --> UC13
    CITIZEN --> UC14
    CITIZEN --> UC15

    ADMIN(["Administrator - role admin"]) --> UC2
    ADMIN --> UC16
    ADMIN --> UC17
    ADMIN --> UC18
    ADMIN --> UC19
    ADMIN --> UC20
    ADMIN --> UC8

    MOBILE(["Mobile app user"]) --> UC9
    MOBILE --> UC11
    MOBILE --> UC10
```

## Figure 4 — User Activity Diagram

```mermaid
flowchart TB
    S(["Start"]) --> A1["Open SafeCity web or mobile"]
    A1 --> A2{"Authenticated?"}
    A2 -- "No" --> A3["Register or Login<br/>POST /auth/register or /auth/login"]
    A2 -- "Yes" --> A5
    A3 --> A4{"Credentials valid?"}
    A4 -- "No" --> A3
    A4 -- "Yes" --> A5["Load dashboard"]
    A5 --> A6{"Choose action"}
    A6 -- "Report" --> B1["Select category<br/>title + description"]
    B1 --> B2["Live severity preview<br/>GET /incidents/preview-severity"]
    B2 --> B3["Pick location on map or GPS"]
    B3 --> B4["Attach up to 5 images<br/>set anonymous flag"]
    B4 --> B5["POST /incidents - status pending"]
    A6 -- "Explore" --> C1["Open safety map<br/>markers / heatmap / city score"]
    C1 --> C2["Click area for score<br/>GET /safety/area"]
    A6 -- "Route" --> D1["Set start + destination"]
    D1 --> D2["GET /routes/plan"]
    D2 --> D3["Compare labelled routes<br/>start guidance on mobile"]
    D3 --> D4{"Deviation over 65 m?"}
    D4 -- "Yes" --> D5["Off-route alert + re-plan"]
    D4 -- "No" --> E0
    D5 --> E0["Arrive"]
    A6 -- "Emergency" --> F1["5 s SOS countdown"]
    F1 --> F2["POST /sos with GPS"]
    F2 --> F3["Accepted contacts notified<br/>in-app + push"]
    F3 --> F4["Active SOS screen - live location updates"]
    F4 --> F5["Resolve SOS"]
    A6 -- "Track" --> G1["Open notifications<br/>mark read"]
    G1 --> G2["View incident status updates"]
    A6 -- "Learn" --> H1["Browse learning hub articles"]
    B5 --> I1["Wait for admin verification"]
    I1 --> I2{"Status change?"}
    I2 -- "approved" --> A5
    I2 -- "rejected" --> A5
    E0 --> A5
    F5 --> A5
    G2 --> A5
    H1 --> A5
    I1 --> J1{"Incident fixed?"}
    J1 -- "Yes" --> J2["Submit resolution request<br/>+ evidence"]
    J2 --> J3{"Creator approves?"}
    J3 -- "Yes" --> J4["Status resolved_unverified"]
    J3 -- "No" --> A5
    J4 --> J5["Admin verifies -> resolved"]
    J5 --> A5
    A5 --> END(["End"])
```

## Figure 5 — Admin Activity Diagram

```mermaid
flowchart TB
    S(["Start"]) --> A1["Open /admin"]
    A1 --> A2{"Role is admin?"}
    A2 -- "No" --> A3["Redirect to /dashboard"]
    A2 -- "Yes" --> B1["Admin dashboard<br/>GET /admin/stats"]
    B1 --> B2{"Choose task"}
    B2 -- "Moderate" --> C1["List incidents with filters<br/>GET /admin/incidents"]
    C1 --> C2{"Transition allowed?"}
    C2 -- "No" --> C3["HTTP 400 - invalid transition"]
    C3 --> C1
    C2 -- "Yes" --> C4{"Target is rejected or resolved?"}
    C4 -- "Yes, no note" --> C5["HTTP 400 - reason required"]
    C5 --> C1
    C4 -- "No / note present" --> C6["PATCH /admin/incidents/id/status"]
    C6 --> C7["Write status history<br/>notify reporter"]
    C7 --> B2
    C4 -- "Delete" --> C8["Soft delete incident"]
    C8 --> B2
    B2 -- "Users" --> D1["List / activate / deactivate<br/>change role"]
    D1 --> B2
    B2 -- "Alerts" --> E1{"Mode"}
    E1 -- "broadcast" --> E2["POST /admin/alerts<br/>target_scope all_users"]
    E1 -- "radius" --> E3["Pick point + radius on map<br/>PostGIS ST_DWithin targeting"]
    E2 --> E4["Dispatch notifications + push"]
    E3 --> E4
    E4 --> E5["Deactivate when obsolete<br/>DELETE /admin/alerts/id"]
    E5 --> B2
    B2 -- "Categories" --> F1["Create / update incident categories"]
    F1 --> B2
    B2 -- "Learning" --> G1["Create / update / delete articles"]
    G1 --> B2
    B2 -- "Done" --> Z(["End"])
```

## Figure 6 — Class Diagram

```mermaid
classDiagram
    class User {
        +str id
        +str email
        +str full_name
        +str hashed_password
        +UserRole role
        +bool is_active
        +bool is_verified
        +str push_token
        +float last_location_lat
        +float last_location_lng
        +geometry last_location_geom
        +datetime created_at
    }
    class UserProfile {
        +str id
        +str user_id
        +str avatar_url
        +str phone
        +str bio
        +str city
        +str country
    }
    class Incident {
        +str id
        +str title
        +str description
        +str category_id
        +SeverityLevel severity
        +IncidentStatus status
        +bool is_anonymous
        +float location_lat
        +float location_lng
        +geometry location_geom
        +str reporter_id
        +str anonymous_reporter_id
        +str admin_note
        +datetime deleted_at
    }
    class IncidentCategory {
        +str id
        +str name
        +str slug
        +str icon
        +str color
        +bool is_active
    }
    class IncidentImage {
        +str id
        +str incident_id
        +str url
        +str filename
    }
    class ResolutionRequest {
        +str id
        +str incident_id
        +str requester_id
        +ResolutionStatus status
        +str explanation
        +str evidence_url
        +str rejection_reason
        +str reviewed_by_id
    }
    class IncidentStatusHistory {
        +str id
        +str incident_id
        +str from_status
        +str to_status
        +str changed_by_id
        +str reason
    }
    class Notification {
        +str id
        +str user_id
        +NotificationType type
        +str title
        +str message
        +bool is_read
        +str incident_id
        +str sos_id
        +str metadata_json
        +str dedup_key
    }
    class CommunityAlert {
        +str id
        +str title
        +str message
        +AlertType alert_type
        +str target_scope
        +float location_lat
        +float location_lng
        +float radius_km
        +bool is_active
        +datetime expires_at
    }
    class EmergencyContact {
        +str id
        +str user_id
        +str name
        +str phone
        +str contact_relation
    }
    class ContactRequest {
        +str id
        +str requester_id
        +str contact_id
        +ContactRequestStatus status
        +str message
    }
    class SOSRequest {
        +str id
        +str user_id
        +float location_lat
        +float location_lng
        +SOSStatus status
        +datetime resolved_at
    }
    class PasswordResetOTP {
        +str id
        +str user_id
        +str otp_hash
        +datetime expires_at
        +datetime used_at
        +int attempt_count
    }
    class Article {
        +str id
        +str title
        +str slug
        +str overview
        +str content_dos
        +str content_donts
        +bool is_published
    }
    class ArticleCategory {
        +str id
        +str name
        +str slug
        +bool is_active
    }
    User "1" --> "1" UserProfile : has
    User "1" --> "0..*" Incident : reports
    User "1" --> "0..*" Notification : receives
    User "1" --> "0..*" EmergencyContact : owns
    User "1" --> "0..*" SOSRequest : raises
    User "1" --> "0..*" ContactRequest : requester
    User "1" --> "0..*" PasswordResetOTP : resets
    IncidentCategory "1" --> "0..*" Incident : classifies
    Incident "1" --> "0..*" IncidentImage : attaches
    Incident "1" --> "0..*" ResolutionRequest : receives
    Incident "1" --> "0..*" IncidentStatusHistory : audited_by
    Incident "0..*" --> "0..*" Notification : linked_to
    ArticleCategory "1" --> "0..*" Article : groups
```

## Figure 7 — Login Sequence

```mermaid
sequenceDiagram
    actor U as Citizen / Admin
    participant W as Web or Mobile UI
    participant A as FastAPI Auth Router
    participant S as AuthService
    participant R as UserRepository
    participant D as PostgreSQL
    participant T as JWT Utils

    U->>W: Enter email + password
    W->>A: POST /api/v1/auth/login
    A->>S: login(LoginRequest)
    S->>R: get_by_email(email)
    R->>D: SELECT users WHERE email = ?
    D-->>R: user row or none
    R-->>S: User or None
    alt user missing
        S-->>A: HTTP 401 No user present, please sign up
        A-->>W: 401 error
        W-->>U: Error toast
    else password mismatch
        S-->>A: HTTP 401 Incorrect password
        A-->>W: 401 error
    else account inactive
        S-->>A: HTTP 403 Account is disabled
    else valid
        S->>T: verify_password(plain, hash)
        T-->>S: true
        S->>T: create_access_token(user.id) 30 min HS256
        S->>T: create_refresh_token(user.id) 7 days
        T-->>S: token pair
        S-->>A: TokenResponse
        A-->>W: 200 access + refresh tokens
        W->>W: persist tokens in Zustand / Secure Store
        W-->>U: Redirect to /dashboard
    end
```

## Figure 8 — Incident Reporting Sequence

```mermaid
sequenceDiagram
    actor U as Citizen
    participant W as Report UI
    participant A as Incidents Router
    participant SE as SeverityEngine
    participant IS as IncidentService
    participant IR as IncidentRepository
    participant D as PostgreSQL
    participant P as PostGIS

    U->>W: Select category, title, description
    W->>A: GET /incidents/preview-severity?category_id,title,description
    A->>SE: preview_severity(slug, title, description)
    SE-->>A: {severity, score}
    A-->>W: live badge Auto-detected severity
    U->>W: Click map location, attach images, toggle anonymous
    W->>A: POST /api/v1/incidents (Bearer token)
    A->>IS: create_incident(data, current_user)
    IS->>IR: get_category_by_id(category_id)
    IR->>D: SELECT incident_categories
    D-->>IR: category
    IS->>SE: compute_severity(slug, title, description)
    SE-->>IS: low / medium / high / critical
    IS->>IR: create(...) with auto severity
    Note over IR,D: reporter_id kept only when is_anonymous=false,<br/>otherwise stored as anonymous_reporter_id
    IR->>D: INSERT incidents + geography point SRID 4326
    IR->>P: location_geom POINT(lng lat)
    IR-->>IS: Incident (status = pending)
    IS-->>A: IncidentSchema
    A-->>W: 201 Created
    W->>A: POST /incidents/id/images (up to 5 files)
    A->>IS: upload_images(files, current_user)
    IS->>D: save to uploads/ + INSERT incident_images
    IS-->>W: IncidentSchema with images
    W-->>U: Success - report pending verification
```

## Figure 9 — Incident Verification Sequence

```mermaid
sequenceDiagram
    actor AD as Administrator
    participant UI as Admin Incidents Page
    participant A as Admin Router
    participant IS as IncidentService
    participant IR as IncidentRepository
    participant DB as PostgreSQL
    participant NR as NotificationRepository
    actor R as Reporter

    AD->>UI: Open /admin/incidents, filter by status
    UI->>A: GET /admin/incidents (admin JWT)
    A->>IS: list_incidents(filters)
    IS-->>UI: paged incidents
    AD->>UI: Choose action e.g. Approve
    UI->>A: PATCH /admin/incidents/id/status {status, admin_note}
    A->>A: get_current_admin - RBAC check
    A->>IS: update_status(incident, target, admin)
    IS->>IS: validate VALID_STATUS_TRANSITIONS
    alt transition not allowed
        IS-->>UI: HTTP 400 invalid transition
    else target rejected or resolved without note
        IS-->>UI: HTTP 400 reason required
    else allowed
        IS->>IR: update_status + add_status_history
        IR->>DB: UPDATE incidents, INSERT incident_status_history
        IS->>NR: create(INCIDENT_UPDATE to reporter or anonymous_reporter_id)
        NR->>DB: INSERT notifications
        IS-->>UI: updated IncidentSchema
        UI-->>AD: status badge updated
        NR-->>R: in-app notification of status change
    end
```

## Figure 10 — Safe Routing Sequence

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Route Plan UI
    participant A as Routes Router
    participant RS as RouteService
    participant SS as SafetyScoreService
    participant D as PostgreSQL
    participant O as OSRM API

    U->>UI: Set start and destination on map
    UI->>A: GET /routes/plan?start_lat,start_lng,dest_lat,dest_lng
    A->>RS: get_safe_route(start, dest)
    RS->>SS: fetch_records_near_path([s,d], corridor)
    SS->>D: SELECT incidents ST_DWithin geography corridor
    D-->>SS: incidents within corridor
    SS-->>RS: validated weighted IncidentRecords
    RS->>RS: project_records to local metres
    RS->>O: direct route with alternatives=true
    RS->>O: exclude=motorway, exclude=toll variants
    RS->>O: 12 via-waypoint detour requests
    O-->>RS: candidate geometries (batch, concurrency 6, 15 s deadline)
    alt no clean route and relevant incidents exist
        RS->>RS: build incident-aware avoidance via-points 650 m offset
        RS->>O: avoidance candidate routes
        O-->>RS: additional geometries
    end
    RS->>RS: deduplicate by 50 m cell Jaccard 0.90
    RS->>RS: evaluate exposure within 500 m per candidate
    RS->>RS: Pareto filter + lambda selection 0.05 0.95 0.50 0.25 0.75
    RS->>RS: composite score 65/20/15, labels Safest..Shortest
    RS-->>A: 3-5 routes + indices + avoidance stats
    A-->>UI: RoutePlanResponse
    UI-->>U: Compare labelled routes on map
```

## Figure 11 — Community Alert Sequence

```mermaid
sequenceDiagram
    actor AD as Administrator
    participant UI as Admin Alerts Page
    participant A as Admin Router
    participant AS as AlertService
    participant D as PostgreSQL
    participant NR as NotificationRepository
    participant P as Push Service
    actor U1 as Citizen inside zone
    actor U2 as Citizen outside zone

    AD->>UI: Choose mode broadcast or location-based
    UI->>UI: Radius preview via Leaflet circle
    UI->>A: POST /admin/alerts {title,message,alert_type,target_scope,location, radius, expires_in_hours}
    A->>AS: create_and_dispatch_alert(data)
    AS->>AS: validate coordinates and positive radius for location_based
    AS->>D: INSERT community_alerts with geography point
    alt target_scope = location_based
        AS->>D: SELECT users ST_DWithin last_location_geom radius
        D-->>AS: users inside radius with known location
    else target_scope = all_users
        AS->>D: SELECT all active users
        D-->>AS: all active users
    end
    loop each eligible recipient
        AS->>NR: has_recent_dedup(user, key, 72h)
        AS->>NR: create(COMMUNITY_ALERT, dedup_key)
        NR->>D: INSERT notifications
        AS->>P: send_push_notification if push_token
        P-->>AS: ok or logged failure
    end
    AS-->>UI: alert + recipients_count
    UI-->>AD: toast dispatched to N citizens
    D-->>U1: notification delivered
    Note over U2: not targeted by radius alert<br/>unless she enters the zone later
```

## Figure 12 — Emergency Contact Sequence

```mermaid
sequenceDiagram
    actor A as Requester
    participant UI as Contacts UI
    participant C as Routers contacts and sos
    participant CS as ContactRequestService
    participant NR as NotificationRepository
    participant P as Push Service
    actor B as Recipient
    actor SOS as SOS Caller

    A->>UI: Search users by name or email
    UI->>C: GET /contacts/search?q (min 2 chars)
    C->>CS: search_users
    CS-->>UI: matching citizens
    A->>UI: Send request with optional message
    UI->>C: POST /contacts/requests {contact_id, message}
    C->>CS: send_request(requester, data)
    CS->>CS: block self-request, duplicates; reopen rejected to pending
    CS->>NR: create(EMERGENCY_CONTACT_REQUEST)
    CS->>P: push to recipient
    B->>UI: View incoming request
    B->>C: PATCH /contacts/requests/id/accept
    C->>CS: respond_to_request(accept=true)
    CS->>NR: create(EMERGENCY_CONTACT_ACCEPTED) + push to requester
    Note over A,B: both users now appear in accepted contact lists
    SOS->>C: POST /sos {location_lat, location_lng}
    C->>CS: notify_contacts_of_sos(user, sos_id, lat, lng)
    loop each accepted contact
        CS->>NR: create(SOS_ALERT with metadata lat lng, dedup sos_alert:id:contact)
        CS->>P: push SOS Alert
    end
    CS-->>SOS: contacts notified count
```

## Figure 13 — Registration / Login BPMN

```mermaid
flowchart TB
    START(["Start Event"]) --> T1["Task: Open auth screen"]
    T1 --> G1{"Gateway: has account?"}
    G1 -- "No" --> T2["Task: Fill register form<br/>name email password confirm"]
    T2 --> G2{"Gateway: Zod + Pydantic<br/>validation passed?"}
    G2 -- "No" --> T2B["Task: Show field errors"]
    T2B --> T2
    G2 -- "Yes" --> T3["Task: POST /auth/register<br/>hash password with bcrypt"]
    T3 --> G3{"Gateway: email exists?"}
    G3 -- "Yes" --> ERR1["Task: HTTP 409 conflict message"]
    ERR1 --> T2
    G3 -- "No" --> T4["Task: create user role citizen<br/>issue access + refresh JWT"]
    T4 --> END1(["End Event: session started"])
    G1 -- "Yes" --> T5["Task: enter email + password"]
    T5 --> T6["Task: POST /auth/login"]
    T6 --> G4{"Gateway: credentials valid<br/>and account active?"}
    G4 -- "No" --> ERR2["Task: 401 / 403 message"]
    ERR2 --> T5
    G4 -- "Yes" --> T7["Task: store tokens<br/>load profile GET /auth/me"]
    T7 --> END1
    ERR2 -.->|"forgot password"| T8["Task: POST /auth/forgot-password"]
    T8 --> T9["Task: email 6-digit OTP via SMTP"]
    T9 --> T10["Task: POST /auth/verify-reset-otp"]
    T10 --> G5{"Gateway: OTP valid<br/>max 5 attempts, 10 min?"}
    G5 -- "No" --> T10
    G5 -- "Yes" --> T11["Task: POST /auth/reset-password<br/>with 15 min reset JWT"]
    T11 --> END2(["End Event: password updated"])
```

## Figure 14 — Incident Reporting BPMN

```mermaid
flowchart TB
    START(["Start Event"]) --> T1["Task: Open Report Incident"]
    T1 --> T2["Task: select category from<br/>GET /incidents/categories"]
    T2 --> T3["Task: type title and description<br/>600 ms debounced severity preview"]
    T3 --> G1{"Gateway: preview severity<br/>returned?"}
    G1 -.-> T3
    G1 --> T4["Task: pick location on map<br/>or use GPS + optional address"]
    T4 --> G2{"Gateway: location selected?"}
    G2 -- "No" --> ERR["Task: inline validation error"]
    ERR --> T4
    G2 -- "Yes" --> T5["Task: attach up to 5 images<br/>optional anonymous flag"]
    T5 --> T6["Task: POST /incidents<br/>server computes severity"]
    T6 --> G3{"Gateway: server validation<br/>title 5+, description 10+?"}
    G3 -- "No" --> ERR2["Task: 422 field errors"]
    ERR2 --> T3
    G3 -- "Yes" --> T7["Task: incident persisted<br/>status pending, history row"]
    T7 --> T8["Task: upload images<br/>POST /incidents/id/images"]
    T8 --> T9["Task: show My Incidents<br/>pending badge"]
    T9 --> END(["End Event"])
```

## Figure 15 — Incident Verification BPMN

```mermaid
flowchart TB
    START(["Start Event: incident pending"]) --> T1["Task: admin opens<br/>/admin/incidents"]
    T1 --> G0{"Gateway: role admin?"}
    G0 -- "No" --> DENY["Task: redirect to dashboard"]
    DENY --> ENDX(["End Event: denied"])
    G0 -- "Yes" --> T2["Task: review report, images,<br/>severity, history"]
    T2 --> G1{"Gateway: decision"}
    G1 -- "Approve" --> T3["Task: PATCH status approved<br/>notification to reporter"]
    G1 -- "Reject" --> G1b{"Gateway: reason provided?"}
    G1b -- "No" --> REJ_ERR["Task: HTTP 400 reason required"]
    REJ_ERR --> T2
    G1b -- "Yes" --> T4["Task: status rejected<br/>+ history + notification"]
    G1 -- "Under review" --> T5["Task: status under_review"]
    T3 --> T6["Task: citizen requests resolution<br/>with explanation and evidence"]
    G1 -- "Resolve" --> G1c{"Gateway: reason provided?"}
    G1c -- "No" --> RES_ERR["Task: HTTP 400 reason required"]
    RES_ERR --> T2
    G1c -- "Yes" --> T7["Task: status resolved + history"]
    T5 --> T6
    T6 --> G2{"Gateway: requester is creator?"}
    G2 -- "Yes" --> T8["Task: auto-approved request<br/>incident -> resolved_unverified"]
    G2 -- "No" --> T9["Task: request pending<br/>creator notified"]
    T9 --> G3{"Gateway: creator decision"}
    G3 -- "approve" --> T8
    G3 -- "reject with reason" --> T10["Task: request rejected<br/>incident keeps prior status"]
    T8 --> T11["Task: admin verifies on ground"]
    T11 --> G4{"Gateway: verified fixed?"}
    G4 -- "Yes" --> T12["Task: status resolved with note"]
    G4 -- "No" --> T13["Task: reopen under_review or approved"]
    T12 --> END1(["End Event"])
    T13 --> T2
    T3 --> END1
    T4 --> END1
    T7 --> END1
    T10 --> END1
```

## Figure 16 — Safe Routing BPMN

```mermaid
flowchart TB
    START(["Start Event"]) --> T1["Task: user sets start<br/>and destination"]
    T1 --> T2["Task: GET /routes/plan"]
    T2 --> T3["Task: load corridor incidents<br/>one PostGIS query"]
    T3 --> G0{"Gateway: incident query OK?"}
    G0 -- "No" --> NF["Task: flag safety_data_available false"]
    G0 -- "Yes" --> T4["Task: request OSRM candidates<br/>direct + excludes + via detours"]
    NF --> T4
    T4 --> T5["Task: prepare candidates<br/>decode, length, exposure 500 m"]
    T5 --> G1{"Gateway: clean route within<br/>1.5x shortest?"}
    G1 -- "Yes" --> T7["Task: deduplicate by cell Jaccard"]
    G1 -- "No" --> T6["Task: incident-aware avoidance jobs<br/>650 m offset vias via OSRM"]
    T6 --> T5
    T7 --> T8["Task: bound detour ratio 2.0<br/>Pareto frontier risk vs length"]
    T8 --> T9["Task: pick routes for<br/>lambda 0.05 0.95 0.50 0.25 0.75"]
    T9 --> G2{"Gateway: fewer than 3<br/>routes chosen?"}
    G2 -- "Yes" --> T10["Task: top up from remaining pool<br/>minimum 3 maximum 5"]
    G2 -- "No" --> T11["Task: composite score 65/20/15<br/>labels Safest to Shortest"]
    T10 --> T11
    T11 --> T12["Task: return routes, indices,<br/>incidents, risk factors, warnings"]
    T12 --> END(["End Event: routes rendered"])
```

## Figure 17 — Community Alert BPMN

```mermaid
flowchart TB
    START(["Start Event"]) --> T1["Task: admin opens<br/>/admin/alerts"]
    T1 --> G1{"Gateway: target mode"}
    G1 -- "all_users" --> T2["Task: fill title message type<br/>expiry hours default 24"]
    G1 -- "location_based" --> T3["Task: pick point on Leaflet map<br/>set radius km slider"]
    T3 --> G2{"Gateway: coordinates and<br/>positive radius present?"}
    G2 -- "No" --> ERR["Task: HTTP 422 validation error"]
    ERR --> T3
    G2 -- "Yes" --> T4["Task: POST /admin/alerts<br/>store geography point"]
    T2 --> T5["Task: resolve recipients"]
    T4 --> T6["Task: recipients = active users with<br/>ST_DWithin last_location_geom"]
    T5 --> T7["Task: recipients = all active users"]
    T6 --> T8["Task: insert notification per user<br/>dedup key community_alert:id:user"]
    T7 --> T8
    T8 --> G3{"Gateway: push token<br/>registered?"}
    G3 -- "Yes" --> T9["Task: send Expo push"]
    G3 -- "No" --> T10["Task: in-app inbox only"]
    T9 --> T11["Task: respond recipients_count"]
    T10 --> T11
    T11 --> T12["Task: catch-up delivery on<br/>POST /contacts/location-check"]
    T12 --> T13["Task: deactivate via DELETE<br/>when expired or obsolete"]
    T13 --> END(["End Event"])
```

## Figure 18 — Emergency Contact BPMN

```mermaid
flowchart TB
    START(["Start Event"]) --> T1["Task: search citizens<br/>GET /contacts/search"]
    T1 --> T2["Task: send contact request<br/>POST /contacts/requests"]
    T2 --> G1{"Gateway: self-request or<br/>existing relationship?"}
    G1 -- "self" --> E1["Task: HTTP 400"]
    G1 -- "pending exists" --> E2["Task: HTTP 409"]
    G1 -- "accepted exists" --> E3["Task: HTTP 409 already contacts"]
    G1 -- "rejected exists" --> T3["Task: reopen row to pending"]
    G1 -- "none" --> T4["Task: insert contact_requests row"]
    T3 --> T5["Task: notify recipient in-app + push"]
    T4 --> T5
    T5 --> T6["Task: recipient accepts<br/>PATCH accept"]
    T6 --> T7["Task: notify requester<br/>EMERGENCY_CONTACT_ACCEPTED"]
    T7 --> T8["Task: both see accepted contacts"]
    T8 --> G2{"Gateway: SOS triggered<br/>POST /sos?"}
    G2 -- "Yes" --> T9["Task: create active SOS<br/>with GPS coordinates"]
    T9 --> T10["Task: notify all accepted contacts<br/>with SOS lat lng + push"]
    T10 --> T11["Task: live updates PATCH /sos/location"]
    T11 --> T12["Task: resolve PATCH /sos/resolve<br/>resolved or false_alarm"]
    G2 -- "No" --> T13["Task: revoke or delete relationship<br/>DELETE /contacts/requests/id"]
    T12 --> END(["End Event"])
    T13 --> END
```

## Figure 19 — Context DFD

```mermaid
flowchart TB
    C["SafeCity System<br/>smart city safety platform"]
    E1["Citizen - web and mobile"]
    E2["Administrator"]
    E3["PostgreSQL + PostGIS DB"]
    E4["OSRM routing service"]
    E5["Expo Push service"]
    E6["SMTP mail service"]
    E7["OpenStreetMap tiles"]

    E1 -- "register, login, report incidents,<br/>query maps, routes, alerts, SOS" --> C
    C -- "incident lists, scores, routes,<br/>notifications, alert feeds" --> E1
    E2 -- "moderation, users, alerts,<br/>categories, articles" --> C
    C -- "statistics, moderation queues" --> E2
    C -- "CRUD + spatial queries" --> E3
    E3 -- "incidents, users, alerts, notifications" --> C
    C -- "route geometry requests" --> E4
    E4 -- "polylines, distance, duration" --> C
    C -- "push messages" --> E5
    E5 -- "delivery status" --> C
    C -- "OTP emails" --> E6
    C -- "map raster tiles" --> E7
```

## Figure 20 — Level-1 DFD

```mermaid
flowchart TB
    U["Citizen / Admin"]
    DB[("PostgreSQL + PostGIS")]

    P1["1.0 Authentication<br/>register login refresh OTP"]
    P2["2.0 Incident Management<br/>create verify resolve"]
    P3["3.0 Safety Analysis<br/>area score, city overview"]
    P4["4.0 Route Planning<br/>OSRM + risk ranking"]
    P5["5.0 Alert Management<br/>broadcast + radius"]
    P6["6.0 Notification Service<br/>inbox dedup push"]
    P7["7.0 Emergency Service<br/>SOS + contacts"]
    P8["8.0 Learning and Search<br/>articles global search"]

    U -- "credentials, profile" --> P1
    P1 -- "JWT tokens, user object" --> U
    U -- "incident report, images, status action" --> P2
    P2 -- "report status, history" --> U
    U -- "coordinates + radius query" --> P3
    P3 -- "score, risk level, explanation" --> U
    U -- "start and destination" --> P4
    P4 -- "ranked routes + incidents" --> U
    U -- "publish alert" --> P5
    P5 --> P6
    P6 -- "in-app + push notifications" --> U
    U -- "location updates, SOS trigger" --> P7
    P7 --> P6
    P7 -- "SOS state, contacts" --> U
    U -- "search query, article request" --> P8
    P8 -- "results" --> U

    P1 <--> DB
    P2 <--> DB
    P3 <--> DB
    P4 <--> DB
    P5 <--> DB
    P6 <--> DB
    P7 <--> DB
    P8 <--> DB
    P4 -- "OSRM HTTP" --> OSRM["OSRM"]
```

## Figure 21 — Incident Management DFD

```mermaid
flowchart TB
    U["Citizen"]
    AD["Admin"]
    S1["Validate + auto severity<br/>severity_engine"]
    S2["IncidentService"]
    S3["IncidentRepository"]
    DB[("incidents, incident_images,<br/>resolution_requests,<br/>incident_status_history")]
    N["NotificationService"]

    U -- "title, description, category,<br/>location, images, anonymous flag" --> S2
    S2 --> S1 -- "low/medium/high/critical" --> S2
    S2 -- "create with status pending" --> S3
    S3 -- "INSERT + status history" --> DB
    AD -- "PATCH status + admin_note" --> S2
    S2 -- "transition table check" --> S2
    S2 -- "update + history row" --> S3
    U -- "resolution request + evidence" --> S2
    S2 -- "creator auto-approve else pending" --> S3
    AD -- "list with filters, soft delete" --> S2
    S2 -- "status change" --> N -- "incident_update notification" --> U
    DB -- "approved incidents, heatmap points" --> S2 -- "list, detail, nearby, heatmap" --> U
```

## Figure 22 — Safe Routing DFD

```mermaid
flowchart TB
    U["User - web or mobile"]
    R["GET /routes/plan"]
    RS["RouteService"]
    SS["SafetyScoreService"]
    DB[("incidents within corridor<br/>PostGIS ST_DWithin")]
    OSRM["OSRM route API"]
    G["Geometry pipeline<br/>Projection, SegmentIndex,<br/>densify, cells"]

    U -- "start_lat, start_lng,<br/>dest_lat, dest_lng" --> R
    R --> RS
    RS -- "corridor point list" --> SS
    SS -- "weighted IncidentRecords" --> DB
    SS -- "validated records" --> RS
    RS -- "direct, exclude, via, avoidance jobs" --> OSRM
    OSRM -- "candidate polylines" --> RS
    RS -- "decode, length, cells, exposure" --> G
    G -- "risk_index, score per candidate" --> RS
    RS -- "dedup, Pareto, lambda selection" --> RS
    RS -- "3-5 routes + labels + indices" --> R
    R -- "RoutePlanResponse" --> U
```

## Figure 23 — Safety Analysis DFD

```mermaid
flowchart TB
    U["Citizen - map click or dashboard"]
    M["GET /safety/area, /safety/city"]
    SS["SafetyScoreService"]
    DB[("incidents approved + unverified<br/>within radius")]
    W["Weight model<br/>base x recency x verification x resolved"]
    AGG["aggregate_risk<br/>cluster decay + category soft cap"]
    OUT["score = 100 x exp(-risk)"]
    LNS["LocationNotificationService"]

    U -- "lat, lng, radius_km" --> M
    M --> SS
    SS -- "fetch records in radius" --> DB
    DB -- "rows" --> SS
    SS -- "IncidentRecord.hazard_w" --> W
    W -- "w" --> AGG
    SS -- "kernel + area normalisation" --> AGG
    AGG -- "risk" --> OUT
    OUT -- "score, risk_level, confidence,<br/>explanation" --> M
    M -- "score panel" --> U
    LNS -- "user position, radius 1 km" --> SS
    OUT -- "score below 40" --> LNS -- "unsafe_area notification" --> U
```

## Figure 24 — ER Diagram

```mermaid
erDiagram
    USERS ||--o| USER_PROFILES : owns
    USERS ||--o{ INCIDENTS : reports
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ EMERGENCY_CONTACTS : saves
    USERS ||--o{ SOS_REQUESTS : raises
    USERS ||--o{ CONTACT_REQUESTS : requester
    USERS ||--o{ CONTACT_REQUESTS : recipient
    USERS ||--o{ PASSWORD_RESET_OTPS : resets
    INCIDENT_CATEGORIES ||--o{ INCIDENTS : classifies
    INCIDENTS ||--o{ INCIDENT_IMAGES : has
    INCIDENTS ||--o{ RESOLUTION_REQUESTS : receives
    INCIDENTS ||--o{ INCIDENT_STATUS_HISTORY : audited_by
    INCIDENTS ||--o{ NOTIFICATIONS : references
    SOS_REQUESTS ||--o{ NOTIFICATIONS : references
    ARTICLE_CATEGORIES ||--o{ ARTICLES : groups

    USERS {
        uuid id PK
        varchar email UK
        varchar full_name
        varchar hashed_password
        enum role
        bool is_active
        bool is_verified
        varchar push_token
        float last_location_lat
        float last_location_lng
        geography last_location_geom
        datetime location_updated_at
        datetime created_at
    }
    USER_PROFILES {
        uuid id PK
        varchar user_id FK
        varchar avatar_url
        varchar phone
        varchar bio
        varchar city
        varchar country
    }
    INCIDENT_CATEGORIES {
        uuid id PK
        varchar name UK
        varchar slug UK
        varchar icon
        varchar color
        bool is_active
    }
    INCIDENTS {
        uuid id PK
        varchar title
        text description
        uuid category_id FK
        enum severity
        enum status
        bool is_anonymous
        float location_lat
        float location_lng
        geography location_geom
        uuid reporter_id FK
        uuid anonymous_reporter_id FK
        text admin_note
        datetime deleted_at
    }
    INCIDENT_IMAGES {
        uuid id PK
        uuid incident_id FK
        varchar url
        varchar filename
    }
    RESOLUTION_REQUESTS {
        uuid id PK
        uuid incident_id FK
        uuid requester_id FK
        enum status
        text explanation
        varchar evidence_url
        text rejection_reason
        uuid reviewed_by_id FK
    }
    INCIDENT_STATUS_HISTORY {
        uuid id PK
        uuid incident_id FK
        varchar from_status
        varchar to_status
        uuid changed_by_id FK
        text reason
    }
    NOTIFICATIONS {
        uuid id PK
        varchar user_id FK
        enum type
        varchar title
        text message
        bool is_read
        uuid incident_id FK
        uuid sos_id FK
        text metadata_json
        varchar dedup_key
    }
    COMMUNITY_ALERTS {
        uuid id PK
        varchar title
        text message
        enum alert_type
        varchar target_scope
        float location_lat
        float location_lng
        float radius_km
        geography location_geom
        bool is_active
        datetime expires_at
    }
    EMERGENCY_CONTACTS {
        uuid id PK
        varchar user_id FK
        varchar name
        varchar phone
        varchar contact_relation
    }
    CONTACT_REQUESTS {
        uuid id PK
        varchar requester_id FK
        varchar contact_id FK
        enum status
        text message
    }
    SOS_REQUESTS {
        uuid id PK
        varchar user_id FK
        float location_lat
        float location_lng
        geography location_geom
        enum status
        datetime resolved_at
    }
    PASSWORD_RESET_OTPS {
        uuid id PK
        varchar user_id FK
        varchar otp_hash
        datetime expires_at
        datetime used_at
        int attempt_count
    }
    ARTICLE_CATEGORIES {
        uuid id PK
        varchar name UK
        varchar slug UK
        bool is_active
    }
    ARTICLES {
        uuid id PK
        varchar title
        varchar slug UK
        text overview
        text content_dos
        text content_donts
        text emergency_steps
        text helpline_numbers
        text legal_info
        uuid category_id FK
        bool is_published
    }
```

## Figure 25 — Database Schema Layout

```mermaid
flowchart TB
    subgraph AUTH["Identity"]
        T1["users<br/>PK id, UK email, role enum<br/>push_token, last_location_geom GiST"]
        T2["user_profiles<br/>PK id, FK user_id unique"]
        T3["password_reset_otps<br/>PK id, FK user_id<br/>otp_hash, attempt_count"]
    end

    subgraph INC["Incidents"]
        T4["incident_categories<br/>PK id, UK name, UK slug"]
        T5["incidents<br/>PK id, FK category_id<br/>severity, status, location_geom GiST<br/>reporter_id, anonymous_reporter_id<br/>deleted_at soft delete"]
        T6["incident_images<br/>PK id, FK incident_id"]
        T7["resolution_requests<br/>PK id, FK incident_id, requester_id<br/>status, explanation, evidence_url"]
        T8["incident_status_history<br/>PK id, FK incident_id<br/>from_status, to_status, changed_by_id"]
    end

    subgraph CM["Communication"]
        T9["notifications<br/>PK id, FK user_id, incident_id, sos_id<br/>type, dedup_key index user_id+dedup_key"]
        T10["community_alerts<br/>PK id, target_scope<br/>location_geom GiST, expires_at"]
    end

    subgraph EM["Emergency"]
        T11["emergency_contacts<br/>PK id, FK user_id"]
        T12["contact_requests<br/>PK id, FK requester_id, contact_id<br/>UK requester_id+contact_id"]
        T13["sos_requests<br/>PK id, FK user_id, location_geom GiST"]
    end

    subgraph LR["Learning"]
        T14["article_categories<br/>PK id, UK name, UK slug"]
        T15["articles<br/>PK id, FK category_id, UK slug"]
    end

    T1 --> T2
    T1 --> T3
    T1 --> T9
    T4 --> T5
    T5 --> T6
    T5 --> T7
    T5 --> T8
    T5 --> T9
    T13 --> T9
    T1 --> T11
    T1 --> T12
    T1 --> T13
    T14 --> T15
```

## Figure 26 — API Architecture

```mermaid
flowchart TB
    subgraph C["Clients"]
        W["Web - axios instance<br/>baseURL /api/v1, Bearer + 401 refresh"]
        M["Mobile - axios instance<br/>Secure Store token, queued refresh"]
    end

    subgraph R["Routers - FastAPI prefix /api/v1"]
        RA["/auth<br/>register login refresh<br/>forgot-password verify-reset-otp<br/>reset-password me"]
        RU["/users<br/>me profile avatar change-password<br/>contacts location"]
        RI["/incidents<br/>categories nearby list heatmap<br/>preview-severity create my detail<br/>images evidence resolution-requests<br/>status-history"]
        RADM["/admin<br/>stats incidents status users<br/>categories alerts articles"]
        RN["/notifications<br/>list read read-all"]
        RL["/learning<br/>categories articles"]
        RAL["/alerts<br/>list active"]
        RR["/routes/plan"]
        RSF["/safety/area /safety/city"]
        RSOS["/sos<br/>active create location resolve"]
        RSE["/search"]
        RC["/contacts<br/>search requests push-token location-check"]
    end

    subgraph MW["Cross-cutting"]
        AUTHMW["HTTPBearer + get_current_user<br/>get_current_admin"]
        VALMW["Pydantic request/response schemas<br/>422 validation errors"]
        CORS["CORSMiddleware allowlist"]
    end

    W --> CORS --> RA
    M --> CORS --> RA
    W --> AUTHMW
    M --> AUTHMW
    AUTHMW --> RU
    AUTHMW --> RI
    AUTHMW --> RN
    AUTHMW --> RR
    AUTHMW --> RSOS
    AUTHMW --> RC
    AUTHMW --> RADM
    RA --> VALMW
    RI --> VALMW
    RADM --> VALMW
    RAL --> RSF
    RL --> RSE
```

## Figure 27 — Security Architecture

```mermaid
flowchart TB
    REQ["Incoming HTTPS request"] --> CORS["CORS origin allowlist"]
    CORS --> ROUTE["Route resolution"]
    ROUTE --> GUARD{"Protected route?"}
    GUARD -- "public" --> PUB["Endpoints<br/>register, login, categories,<br/>incident list/detail, heatmap,<br/>safety scores, routes, search, articles"]
    GUARD -- "authenticated" --> JWT["HTTPBearer: decode JWT<br/>HS256, type=access, exp check"]
    JWT --> ACT{"user.is_active?"}
    ACT -- "no" --> F403["403 Inactive user"]
    ACT -- "yes" --> ROLE{"admin route?"}
    ROLE -- "no" --> HANDLER["Endpoint handler"]
    ROLE -- "yes" --> ADM{"role == admin?"}
    ADM -- "no" --> F403B["403 Admin access required"]
    ADM -- "yes" --> HANDLER
    HANDLER --> SCHEMA["Pydantic validation<br/>length, range, email, OTP format"]
    SCHEMA --> BIZ["Service rules<br/>status transitions, max 5 contacts,<br/>one active SOS, dedup keys"]
    BIZ --> DBW["Repository write<br/>bcrypt hash, soft delete, history rows"]
    DBW --> RESP["JSON response<br/>anonymous reporter fields stripped"]

    subgraph PROTECT["Credential and data protection"]
        P1["bcrypt password hashing<br/>72-byte truncation"]
        P2["JWT access 30 min / refresh 7 d<br/>separate type claims"]
        P3["OTP stored as bcrypt hash<br/>5 attempts, 60 s cooldown, 10 min TTL"]
        P4["Reset token JWT 15 min type password_reset"]
        P5["Generic messages prevent<br/>user enumeration"]
        P6["Expo push tokens validated<br/>prefix ExponentPushToken"]
    end
```

## Figure 28 — Deployment Architecture

```mermaid
flowchart TB
    subgraph DOCKER["Docker Compose - docker-compose.yml"]
        DBX[("db container<br/>postgis/postgis:15-3.3<br/>port 5433 to host, volume postgres_data")]
        BK["backend container<br/>python 3.11-slim, uvicorn :8000<br/>runs python -m app.db.init_db on start<br/>volume uploads_data"]
        WB["web container<br/>node:20-alpine build -> nginx:alpine :80->80<br/>serves dist + SPA fallback"]
    end

    subgraph HOSTED["Hosted targets - DEPLOYMENT_GUIDE.md"]
        VERCEL["Vercel - web SPA<br/>vercel.json rewrites to index.html"]
        RENDER["Render - FastAPI service<br/>EXPO_PUBLIC_API_BASE_URL in eas.json"]
        SUPA["Supabase - PostgreSQL + PostGIS"]
        EC2["AWS EC2 - self-hosted OSRM<br/>Tamil Nadu extract (guide)"]
        GHREL["GitHub Releases - Android APK"]
    end

    subgraph MOB["Mobile delivery"]
        EAS["EAS build profile preview<br/>buildType apk<br/>API https://safecity-k280.onrender.com"]
    end

    DBX --> BK
    BK --> WB
    WB --> USERS["Browser clients"]
    VERCEL --> USERS
    RENDER --> SUPA
    RENDER --> EC2
    EAS --> PHONES["Android devices"]
    PHONES --> RENDER
    GHREL --> PHONES
    USERS --> VERCEL
    USERS --> RENDER
```

## Figure 29 — Safe Routing Flowchart

```mermaid
flowchart TB
    S(["GET /routes/plan"]) --> A1["Validate coordinates"]
    A1 --> A2["Corridor = base 6000 m + 0.25 x trip<br/>cap 25 km; single ST_DWithin query"]
    A2 --> A3["Project records + OSRM jobs to<br/>local equirectangular metres"]
    A3 --> A4["Stage A: direct with alternatives,<br/>exclude motorway, exclude toll,<br/>12 via-waypoint jobs"]
    A4 --> A5["Prepare candidates: decode polyline,<br/>length, duration, densify 500 m,<br/>SegmentIndex exposure"]
    A5 --> B1{"Any candidate with<br/>0 relevant incidents<br/>and length <= 1.5 x shortest?"}
    B1 -- "No and relevant incidents exist" --> A6["Stage B: avoidance vias at<br/>650 m perpendicular to worst clusters<br/>max 10 jobs"]
    A6 --> A5
    B1 -- "Yes" --> C1["Deduplicate: 50 m cells,<br/>drop Jaccard >= 0.90,<br/>keep lambda 0.5 better"]
    C1 --> C2["Detour bound: keep ratio <= 2.0,<br/>else keep 3 shortest"]
    C2 --> C3["Pareto frontier on<br/>risk_index vs length"]
    C3 --> D1["lambda 0.05: prefer clean route<br/>else min cost"]
    D1 --> D2["lambda 0.95 min cost"]
    D2 --> D3["lambda 0.50"]
    D3 --> D4["lambda 0.25"]
    D4 --> D5["lambda 0.75"]
    D5 --> E1{"chosen < 3?"}
    E1 -- "Yes" --> E2["Top up with distinct rest<br/>min 3, max 5"]
    E1 -- "No" --> E3["Sort by lambda"]
    E2 --> E3
    E3 --> F1["Composite = 0.65 safety<br/>+ 0.20 distance + 0.15 duration"]
    F1 --> F2["Labels: Safest, Safer, Balanced,<br/>Shorter, Shortest + role indices"]
    F2 --> F3["Attach up to 50 incidents,<br/>top-3 risk factors, warnings"]
    F3 --> Z(["Response JSON"])
```

## Figure 30 — Area Safety Score Flowchart

```mermaid
flowchart TB
    S(["GET /safety/area?lat,lng,radius_km"]) --> A1{"lat/lng valid?"}
    A1 -- "No" --> X1["Return score 50, moderate,<br/>confidence none, explanation"]
    A1 -- "Yes" --> A2["Clamp radius to 0.05..50 km"]
    A2 --> A3["Fetch incidents within radius<br/>exclude rejected and soft-deleted<br/>limit 20000, newest first"]
    A3 --> B1{"any incident<br/>inside radius?"}
    B1 -- "No" --> X2["Return score 100, safe,<br/>confidence low, note absence of reports"]
    B1 -- "Yes" --> C1["Per incident compute<br/>hazard_w = base x recency x verify<br/>recency = 0.15 + 0.85 x 0.5^(age/60)"]
    C1 --> C2["Kernel = (1 - 0.5 u^2)/0.75<br/>u = d/radius, mean 1 over disc"]
    C2 --> C3["Contribution = hazard_w x kernel<br/>/ (100 x max(area_km2, 0.5))"]
    C3 --> D1["Cluster discount 0.5^rank<br/>in category + 55 m cell"]
    D1 --> D2["Category soft cap<br/>K = 2.0 x crit/maxcrit<br/>cap x (1 - exp(-sum/K))"]
    D2 --> D3["risk = sum of capped categories"]
    D3 --> E1["score = 100 x exp(-risk)"]
    E1 --> E2{"score"}
    E2 -- "below 40" --> E3["risk_level unsafe"]
    E2 -- "40 to 74" --> E4["risk_level moderate"]
    E2 -- "75 and above" --> E5["risk_level safe"]
    E3 --> F1
    E4 --> F1
    E5 --> F1
    F1["Confidence from evidence mass<br/>low < 1 <= medium < 5 <= high"]
    F1 --> G1["Compose explanation,<br/>severity counts, top categories,<br/>recent 7d / 30d, density"]
    G1 --> Z(["JSON response"])
```

## Figure 31 — Incident Risk (Severity) Flowchart

```mermaid
flowchart TB
    S(["Incident submitted or preview requested"]) --> A1["Read category slug"]
    A1 --> A2{"slug in base table?"}
    A2 -- "Yes" --> B1["base = category baseline 0-100<br/>e.g. gas_leak 85, crime 70,<br/>poor_lighting 40, default 40"]
    A2 -- "No" --> B2["base = 40"]
    B1 --> C1["Scan title for keywords"]
    B2 --> C1
    C1 --> C2{"match tier"}
    C2 -- "critical word" --> C3["title boost = 30"]
    C2 -- "high word" --> C4["title boost = 18"]
    C2 -- "medium word" --> C5["title boost = 8"]
    C2 -- "none" --> C6["title boost = 0"]
    C3 --> D1["Scan description, dampened x 0.60"]
    C4 --> D1
    C5 --> D1
    C6 --> D1
    D1 --> E1["total = min(100, base + title_boost + desc_boost)"]
    E1 --> F1{"threshold map"}
    F1 -- "total >= 80" --> G1["severity critical"]
    F1 -- "60 to 79" --> G2["severity high"]
    F1 -- "38 to 59" --> G3["severity medium"]
    F1 -- "below 38" --> G4["severity low"]
    G1 --> H1["Persist severity on incident<br/>or return preview to client"]
    G2 --> H1
    G3 --> H1
    G4 --> H1
    H1 --> Z(["End"])
```

## Figure 32 — Alert Propagation Flowchart

```mermaid
flowchart TB
    S(["Trigger"]) --> T1["Trigger A: admin publishes<br/>POST /admin/alerts"]
    S --> T2["Trigger B: mobile posts<br/>POST /contacts/location-check"]
    S --> T3["Trigger C: admin broadcasts<br/>target_scope all_users"]

    T1 --> A1{"target_scope"}
    A1 -- "location_based" --> A2["Validate lat lng and radius > 0<br/>store geography point"]
    A1 -- "all_users" --> A3["Store without geometry"]
    A2 --> A4["Recipients: active users where<br/>ST_DWithin(last_location_geom, centre, radius)"]
    A3 --> A5["Recipients: all active users"]
    A4 --> B1["For each recipient:<br/>dedup_key community_alert:id:user<br/>skip if seen in 72 h"]
    A5 --> B1
    B1 --> B2["Insert COMMUNITY_ALERT notification<br/>metadata alert_id scope lat lng radius"]
    B2 --> B3{"push_token present?"}
    B3 -- "yes" --> B4["POST Expo push send<br/>icon prefix per scope"]
    B3 -- "no" --> B5["In-app only"]
    B4 --> C1["Return recipients_count"]
    B5 --> C1

    T2 --> D1["Update user last_location_geom"]
    D1 --> D2["Nearby incidents: approved,<br/>last 2 h, 5 km, top 5,<br/>dedup 24 h per incident"]
    D1 --> D3["Unsafe area: area score radius 1 km<br/>score < 40, grid 0.01 degree,<br/>dedup 6 h"]
    D1 --> D4["Catch-up: active location alerts<br/>covering current point<br/>dedup 72 h per alert"]
    D2 --> E1["Notification + push"]
    D3 --> E1
    D4 --> E1
    C1 --> Z(["End - user inbox updated"])
    E1 --> Z
```











