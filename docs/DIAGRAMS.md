# SafeCity — System Diagrams

## 1. Complete Application Flow

```mermaid
flowchart TD
    Start([User opens app]) --> Auth{Authenticated?}
    Auth -->|No| Login[Login / Register]
    Login --> JWT[JWT tokens issued]
    JWT --> Dash
    Auth -->|Yes| Dash[Dashboard]
    Dash --> Map[View Safety Map]
    Dash --> Report[Report Incident]
    Dash --> Route[Plan Safe Route]
    Dash --> SOS[Trigger SOS]
    Dash --> Learn[Learning Hub]
    Dash --> Alerts[View Alerts]
    Dash --> Notif[Notifications]
    Dash --> Profile[Profile / Settings]
    Profile --> Logout[Logout]
    Map --> AreaScore[Area Safety Score]
    Route --> OSRM[OSRM + Safety Score]
    Report --> Pending[Status: Pending]
    Pending --> AdminReview[Admin Review]
    AdminReview --> Approved[Approved / Rejected]
    Approved --> NotifUser[Notify Reporter]
```

## 2. Simplified Presentation Flow

```mermaid
flowchart TD
    A[Citizen] --> B[Report Incident]
    A --> C[View Safety Map]
    A --> D[Plan Safe Route]
    A --> E[SOS Emergency]
    B --> F[Admin Verification]
    F --> G[Approved Incidents]
    G --> H[Safety Scores]
    H --> C
    H --> D
```

## 3. System Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        W[Web App<br/>React + Vite]
        M[Mobile App<br/>React Native + Expo]
    end

    subgraph Server["Application Layer"]
        API[FastAPI Backend<br/>/api/v1]
        subgraph Services["Services"]
            AS[AuthService]
            IS[IncidentService]
            SS[SafetyScoreService]
            RS[RouteService]
            ES[EmergencyService]
            PS[PasswordResetService]
        end
    end

    subgraph Data["Data Layer"]
        DB[(PostgreSQL + PostGIS)]
        FS[(File Storage<br/>uploads/)]
    end

    subgraph External["External Services"]
        OSRM[OSRM Routing API]
        SMTP[SMTP Email]
        OSM[OpenStreetMap Tiles]
    end

    W -->|HTTPS/JSON| API
    M -->|HTTPS/JSON| API
    API --> Services
    Services --> DB
    Services --> FS
    RS --> OSRM
    PS --> SMTP
    W --> OSM
```

## 4. Citizen/User Workflow

```mermaid
flowchart TD
    A[Register / Login] --> B[JWT Auth]
    B --> C[Dashboard]
    C --> D[Safety Map]
    D --> E{Action}
    E -->|Click map| F[Area Safety Score]
    E -->|Report| G[Incident Form]
    E -->|Route| H[Safe Route Planning]
    G --> I[Submit + Images]
    I --> J[Pending Review]
    J --> K[Admin Approval]
    K --> L[Notification]
    H --> M[View Safest/Shortest Route]
    C --> N[SOS Trigger]
    N --> O[Emergency Contacts]
    C --> P[Learning Hub]
    C --> Q[Profile Settings]
```

## 5. Administrator Workflow

```mermaid
flowchart TD
    A[Admin Login] --> B[Admin Dashboard]
    B --> C[Incident Management]
    C --> D{Review}
    D -->|Approve| E[Status: Approved]
    D -->|Reject| F[Status: Rejected]
    D -->|Resolve| G[Status: Resolved]
    E --> H[Notify Reporter]
    F --> H
    G --> H
    B --> I[User Management]
    I --> J[Activate / Deactivate / Role]
    B --> K[Category Management]
    B --> L[Alerts Management]
    B --> M[Articles Management]
    B --> N[Analytics & Stats]
```

## 6. Safe Routing Algorithm Flow

```mermaid
flowchart TD
    A[Input: start & dest coords] --> B[OSRM: direct route + alternatives]
    B --> C{Success?}
    C -->|No| D[Fallback direct route]
    C -->|Yes| E[Direct candidates]
    D --> F[Compute midpoint offset]
    E --> F
    F --> G[OSRM: route via offset waypoint]
    G --> H{Success?}
    H -->|No| I[Fallback alternative]
    H -->|Yes| J[Alternative route]
    I --> K[For each route]
    J --> K
    K --> L[Decode polyline]
    L --> M[Haversine distance]
    L --> N[PostGIS: incidents within 200m]
    N --> O[Safety score]
    O --> P[Shortest = min distance]
    O --> Q[Safest = max score]
    P --> R[Return routes]
    Q --> R
```

## 7. Area Safety Index / Risk Calculation Flow

```mermaid
flowchart TD
    A[Input: lat, lng, radius] --> B[PostGIS ST_DWithin query]
    B --> C{Incidents found?}
    C -->|No| D[Score = 100, Safe]
    C -->|Yes| E[For each incident]
    E --> F[Severity weight<br/>L=2, M=5, H=10, C=15]
    F --> G[Recency multiplier<br/>7d=1.5x, 30d=1.2x, older=1x]
    G --> H[Sum weighted penalty]
    H --> I[Score = 100 - penalty]
    I --> J[Density penalty<br/>>5/km2: -10, >2/km2: -5]
    J --> K[Cap at 0]
    K --> L{Score}
    L -->|>= 75| M[Safe]
    L -->|40-74| N[Moderate]
    L -->|< 40| O[Unsafe]
```

## 8. Database ER Diagram

```mermaid
erDiagram
    users ||--|| user_profiles : "1:1"
    users ||--o{ incidents : "reports"
    users ||--o{ notifications : "receives"
    users ||--o{ emergency_contacts : "has"
    users ||--o{ sos_requests : "triggers"
    users ||--o{ password_reset_otps : "has"
    incident_categories ||--o{ incidents : "categorizes"
    incidents ||--o{ incident_images : "has"
    incidents ||--o{ notifications : "references"
    article_categories ||--o{ articles : "categorizes"
```

## 9. Data Flow Diagram

```mermaid
flowchart LR
    subgraph Inputs
        U[User Input]
        G[GPS Location]
    end

    subgraph Processing
        V[Validation<br/>Pydantic]
        B[Business Logic<br/>Services]
        S[Spatial Queries<br/>PostGIS]
    end

    subgraph Storage
        DB[(Database)]
        F[(Files)]
    end

    subgraph Outputs
        R[REST Response]
        M[Map Visualization]
        N[Notifications]
    end

    U --> V
    G --> V
    V --> B
    B --> S
    S --> DB
    B --> F
    DB --> R
    R --> M
    B --> N
```

## 10. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as DB

    U->>F: Login credentials
    F->>B: POST /auth/login
    B->>D: SELECT user WHERE email
    D-->>B: User record
    B->>B: bcrypt verify
    B->>B: JWT encode (access + refresh)
    B-->>F: {access_token, refresh_token}
    F->>F: Store in Zustand
    F->>B: GET /auth/me (Bearer)
    B->>B: JWT decode + type check
    B->>D: SELECT user WHERE id
    D-->>B: User
    B-->>F: User profile
```

## 11. Incident Reporting Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as DB

    U->>F: Fill form + submit
    F->>B: POST /incidents
    B->>B: Validate (Pydantic)
    B->>D: INSERT incident (pending)
    B->>D: Create PostGIS geometry
    D-->>B: Incident ID
    B-->>F: Incident JSON
    F->>B: POST /incidents/{id}/images
    B->>D: INSERT images
    B-->>F: Updated incident
    Note over B,D: Admin review
    B->>D: UPDATE status
    B->>D: INSERT notification
```

## 12. Safe Routing Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant O as OSRM
    participant D as PostGIS

    U->>F: Select start & dest
    F->>B: GET /routes/plan
    B->>O: GET /route/v1/driving (direct + alt)
    O-->>B: Routes JSON
    B->>O: GET /route/v1/driving (via offset)
    O-->>B: Alternative route
    B->>D: ST_DWithin (incidents near route)
    D-->>B: Incidents
    B->>B: Safety score per route
    B-->>F: {routes, shortest_idx, safest_idx}
    F->>F: Render on Leaflet map
```

## 13. SOS Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as DB

    U->>F: Tap SOS
    F->>B: POST /sos {lat, lng}
    B->>D: INSERT sos_request (active)
    D-->>B: SOS ID
    B-->>F: SOS created
    U->>F: Resolve
    F->>B: PATCH /sos/resolve
    B->>D: UPDATE status + resolved_at
    B-->>F: Updated SOS
```

## 14. Component Diagram

```mermaid
graph TB
    subgraph Web["Web Frontend"]
        R[React Router]
        L[Layouts: App, Admin, Auth]
        P[Pages]
        C[Components: Map, UI, Incidents]
        S[Stores: auth, filters]
        Q[React Query hooks]
    end

    subgraph Mobile["Mobile App"]
        N[React Navigation]
        MS[Screens]
        MQ[React Query]
        MST[Zustand]
    end

    subgraph Backend["FastAPI Backend"]
        RT[Routers]
        SV[Services]
        RP[Repositories]
        MD[Models]
    end

    R --> L --> P
    P --> C
    P --> Q
    Q --> S
    N --> MS
    MS --> MQ
    MS --> MST
    Q --> RT
    MQ --> RT
    RT --> SV --> RP --> MD
```

## 15. Deployment Architecture

```mermaid
flowchart TB
    subgraph Docker["Docker Compose"]
        subgraph WebContainer["web (nginx :8080)"]
            NG[Nginx + Static React Build]
        end
        subgraph BackendContainer["backend (:8000)"]
            UV[Uvicorn + FastAPI]
        end
        subgraph DBContainer["db (:5433)"]
            PG[(PostgreSQL 15 + PostGIS 3.3)]
        end
    end

    User[Browser / Mobile] -->|:8080| NG
    User -->|:8000| UV
    NG -->|/api proxy| UV
    UV --> PG
    UV --> OSRM[OSRM Public API]
    UV --> SMTP[SMTP Server]