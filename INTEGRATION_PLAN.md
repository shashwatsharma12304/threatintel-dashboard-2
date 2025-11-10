# MongoDB Integration Plan for Frontend

## Overview

Replace hardcoded mock data with real-time data fetched from MongoDB via Next.js API routes. The frontend design and user flow remain unchanged. **Frontend models will be updated to match MongoDB schema** (not the other way around).

## Architecture

```
Frontend (React/Vite) 
    ↓ HTTP Requests
Next.js API Routes (app/api/*/route.ts)
    ↓ Queries
MongoDB (Threat Radar Data)
```

**Note**: Since the project uses Vite, we have two options:
1. **Option A**: Migrate to Next.js App Router (recommended for full Next.js features)
2. **Option B**: Keep Vite frontend, create Next.js API-only server on separate port

This plan assumes **Option B** - keeping Vite frontend and creating Next.js API server.

## Implementation Steps

### Phase 1: Next.js API Server Setup

#### 1.1 Create Next.js API Server Structure

- **Directory**: `api-server/` (separate Next.js project for API only)
- **Structure**:
  ```
  api-server/
  ├── app/
  │   └── api/
  │       ├── radar/
  │       │   └── route.ts
  │       ├── threats/
  │       │   └── route.ts
  │       ├── activity-chart/
  │       │   └── route.ts
  │       ├── assets-chart/
  │       │   └── route.ts
  │       ├── kpis/
  │       │   └── route.ts
  │       └── filter-options/
  │           └── route.ts
  ├── lib/
  │   └── mongodb.ts          # MongoDB connection utility
  └── package.json
  ```

#### 1.2 MongoDB Connection Utility

- **File**: `api-server/lib/mongodb.ts`
- **Purpose**: Reusable MongoDB connection using pymongo (via Node.js MongoDB driver)
- **Note**: Since backend uses Python/pymongo, we'll use Node.js `mongodb` package for Next.js

#### 1.3 API Route Handlers

**GET `/api/radar`** (`app/api/radar/route.ts`)
- Query MongoDB for latest radar data by `customer_id`
- Returns: Full radar JSON (meta, points, activity_chart, assets_chart)
- Query: `{ "meta.customer_id": "cust-airtel-001" }` sorted by `meta.generated_at` DESC, limit 1

**GET `/api/threats`** (`app/api/threats/route.ts`)
- Extract `points` array from radar data
- Apply frontend filters (severity, status, timeRange, etc.) - filtering happens in API route
- Returns: Array of RadarThreatPoint objects (MongoDB format)

**GET `/api/activity-chart`** (`app/api/activity-chart/route.ts`)
- Extract `activity_chart` from radar data
- Filter to last 7 days only
- Returns: Array of ActivityDataPoint (last 7 days)

**GET `/api/assets-chart`** (`app/api/assets-chart/route.ts`)
- Extract `assets_chart` from radar data
- Limit to top 10 products (if more than 10 exist)
- Returns: Array of AssetImpact (top 10)

**GET `/api/kpis`** (`app/api/kpis/route.ts`)
- Calculate KPIs from radar `points`:
  - active: count of points with status "active" or "new"
  - critical: count with severity "critical" and status != "mitigated"
  - high: count with severity "high" and status != "mitigated"
  - newLast24h: count with first_seen in last 24 hours
  - assetsImpacted: unique count of assets from assets_impacted arrays
- Returns: KpiData object

**GET `/api/filter-options`** (`app/api/filter-options/route.ts`)
- Extract unique values from radar data for filter dropdowns:
  - assets: unique product_name from all assets_impacted
  - sources: unique source from all points
- Returns: `{ assets: string[], sources: string[] }`

### Phase 2: Update Frontend Types to Match MongoDB Schema

#### 2.1 Update Threat Type

- **File**: `src/types/threat.ts`
- **Changes**: Update `Threat` interface to match MongoDB `RadarThreatPoint` schema:
  ```typescript
  export interface Threat {
    id: string;
    threat_name: string;        // Changed from "name"
    title: string;             // New field
    severity: "critical" | "high" | "medium" | "low";  // Lowercase
    status: "new" | "active" | "mitigated";            // Lowercase
    severity_score: number;
    relevance_score: number;
    prioritization_score: number;
    prioritization_band: "critical" | "high" | "medium" | "low";
    primary_surface: string;
    theta_deg: number;
    radius_norm: number;
    assets_impacted: RadarThreatAsset[];  // Full array, not just primary
    cve_ids: string[];                    // Changed from "cves"
    mitre_tactics: string[];
    mitre_techniques: string[];
    source: string;
    source_link: string;
    first_seen: string;
    last_updated: string;
    summary: string;                     // Changed from "description"
    relevance_reasons: string[];
    industries_affected: string[];
    regions_or_countries_targeted: string[];
  }
  
  export interface RadarThreatAsset {
    product_id: string;
    product_name: string;
    owning_team: string;
    is_crown_jewel: boolean;
    internet_facing: boolean;
    data_sensitivity: "low" | "medium" | "high";
  }
  ```

#### 2.2 Update Activity Chart Type

- **File**: `src/types/threat.ts`
- **Changes**: `ActivityDataPoint` already matches MongoDB format (no changes needed)

#### 2.3 Update Assets Chart Type

- **File**: `src/types/threat.ts`
- **Changes**: `AssetImpact` already matches MongoDB format (no changes needed)

### Phase 3: Update Frontend Components to Use MongoDB Schema

#### 3.1 Update API Client

- **File**: `src/lib/api.ts`
- **Changes**:
  - Replace mock data imports with API fetch calls to Next.js API routes
  - Add `API_BASE_URL` constant (e.g., `http://localhost:3000/api` for Next.js)
  - Update all functions to call Next.js API:
    - `getThreats()` → `GET /api/threats?severity=...&status=...`
    - `getActivityData()` → `GET /api/activity-chart`
    - `getAssetImpacts()` → `GET /api/assets-chart`
    - `calculateKpis()` → `GET /api/kpis`
    - `getUniqueAssets()` → `GET /api/filter-options` → assets
    - `getUniqueSources()` → `GET /api/filter-options` → sources
  - Remove mock data and in-memory state
  - Keep `subscribeToUpdates()` for polling (poll `/api/radar` every 10 seconds)

#### 3.2 Update Components to Use New Schema

**RadarCanvas Component**
- **File**: `src/components/RadarCanvas.tsx`
- **Changes**: 
  - Use `threat.threat_name` instead of `threat.name`
  - Use `threat.theta_deg` and `threat.radius_norm` directly
  - Use `threat.assets_impacted[0]?.product_name` for asset display
  - Use `threat.severity` (lowercase) - convert to display format in component

**ThreatDetailsPanel Component**
- **File**: `src/components/ThreatDetailsPanel.tsx`
- **Changes**:
  - Use `threat.threat_name` for name
  - Use `threat.summary` for description
  - Use `threat.cve_ids` instead of `threat.cves`
  - Display `threat.assets_impacted` array
  - Use `threat.mitre_tactics` and `threat.mitre_techniques`

**KpiCards Component**
- **File**: `src/components/KpiCards.tsx`
- **Changes**: No changes needed if KPIs are calculated in API

**ActivityChart Component**
- **File**: `src/components/ActivityChart.tsx`
- **Changes**: No changes needed (schema matches)

**AssetsChart Component**
- **File**: `src/components/AssetsChart.tsx`
- **Changes**: No changes needed (schema matches)

**FiltersSidebar Component**
- **File**: `src/components/FiltersSidebar.tsx`
- **Changes**: 
  - Update filter values to use lowercase: "critical", "high", "medium", "low"
  - Update status values to use lowercase: "new", "active", "mitigated"

### Phase 4: Data Filtering & Processing (in API Routes)

#### 4.1 Activity Chart - Last 7 Days

- **Location**: `api-server/app/api/activity-chart/route.ts`
- **Logic**:
  ```typescript
  const activity_data = radar_data.activity_chart || [];
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const filtered = activity_data.filter(point => {
    const pointDate = new Date(point.date);
    return pointDate >= sevenDaysAgo;
  });
  
  return filtered;
  ```

#### 4.2 Assets Chart - Top 10

- **Location**: `api-server/app/api/assets-chart/route.ts`
- **Logic**:
  ```typescript
  const assets_data = radar_data.assets_chart || [];
  // Already sorted by count descending from MongoDB
  return assets_data.slice(0, 10);  // Top 10 only
  ```

#### 4.3 Threats Filtering

- **Location**: `api-server/app/api/threats/route.ts`
- **Logic**: Filter `points` array based on query parameters:
  - `severity`: Filter by severity (lowercase)
  - `status`: Filter by status (lowercase)
  - `assets`: Filter by product_name in assets_impacted
  - `sources`: Filter by source
  - `timeRange`: Filter by first_seen date
  - `search`: Search in threat_name, summary, source

### Phase 5: Configuration & Environment

#### 5.1 Next.js API Server Environment

- **File**: `api-server/.env.local`
  ```
  MONGODB_URI=mongodb://...
  MONGODB_DB_NAME=...
  MONGODB_COLLECTION_NAME=...
  CUSTOMER_ID=cust-airtel-001
  ```

#### 5.2 Frontend Configuration

- **File**: `src/lib/config.ts` (new)
  ```typescript
  export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  ```
- **File**: `.env` (update)
  ```
  VITE_API_URL=http://localhost:3000/api
  ```

## File Structure

```
project-root/
├── api-server/                    # Next.js API server
│   ├── app/
│   │   └── api/
│   │       ├── radar/
│   │       │   └── route.ts
│   │       ├── threats/
│   │       │   └── route.ts
│   │       ├── activity-chart/
│   │       │   └── route.ts
│   │       ├── assets-chart/
│   │       │   └── route.ts
│   │       ├── kpis/
│   │       │   └── route.ts
│   │       └── filter-options/
│   │           └── route.ts
│   ├── lib/
│   │   └── mongodb.ts
│   └── package.json
├── src/                           # Vite frontend (unchanged structure)
│   ├── lib/
│   │   ├── api.ts                 # (update) API client
│   │   └── config.ts              # (new) Configuration
│   ├── types/
│   │   └── threat.ts              # (update) Match MongoDB schema
│   └── components/                # (update) Use new schema fields
└── backend/                       # (NO CHANGES) Python scripts remain unchanged
```

## API Request/Response Examples

### GET /api/radar

**Response:**
```json
{
  "meta": {
    "generated_at": "2025-11-07T09:14:37.572696Z",
    "customer_id": "cust-airtel-001",
    "total_threats": 54
  },
  "points": [ ... ],
  "activity_chart": [ ... ],
  "assets_chart": [ ... ]
}
```

### GET /api/threats?severity=critical&status=active

**Response:**
```json
[
  {
    "id": "...",
    "threat_name": "...",
    "severity": "critical",
    "status": "active",
    "assets_impacted": [ ... ],
    ...
  }
]
```

### GET /api/activity-chart

**Response:**
```json
[
  {
    "date": "2025-11-01",
    "Critical": 2,
    "High": 3,
    "Medium": 0,
    "Low": 0
  },
  ...
]  // Only last 7 days
```

### GET /api/assets-chart

**Response:**
```json
[
  {
    "asset": "Corporate Email & Collaboration (M365)",
    "count": 22
  },
  ...
]  // Top 10 only
```

## Key Differences from Original Plan

1. **No Backend Changes**: Python backend (`backend/`) remains completely unchanged
2. **Frontend Adapts to MongoDB**: Frontend types and components updated to match MongoDB schema
3. **Next.js API Routes**: Use Next.js App Router API routes instead of Flask/FastAPI
4. **Separate API Server**: Next.js API server runs separately from Vite frontend
5. **Schema Matching**: Frontend uses MongoDB field names directly (e.g., `threat_name` not `name`)

## Testing Checklist

- [ ] Next.js API server starts successfully
- [ ] MongoDB connection works from Next.js
- [ ] All API endpoints return correct data
- [ ] Activity chart shows only last 7 days
- [ ] Assets chart shows only top 10
- [ ] Frontend displays data correctly with new schema
- [ ] Filters work on frontend
- [ ] Component updates handle new field names
- [ ] Error handling works
- [ ] Loading states display properly
- [ ] No console errors

## Deployment Considerations

1. **CORS**: Next.js API routes handle CORS automatically
2. **Environment**: Use different API URLs for dev/prod
3. **Ports**: 
   - Vite frontend: `localhost:5173` (or 8080)
   - Next.js API: `localhost:3000`
4. **Polling**: Current `subscribeToUpdates()` can poll `/api/radar` every 10 seconds
5. **Performance**: MongoDB queries should be indexed on `meta.customer_id` and `meta.generated_at`

## Next Steps (Optional Enhancements)

1. **Migrate to Next.js**: Move entire frontend to Next.js App Router for unified stack
2. **WebSocket/SSE**: Replace polling with real-time updates
3. **Multiple Customers**: Support customer selection in UI
4. **Historical Data**: Show data from different time periods
5. **Caching**: Add Next.js caching for frequently accessed data
