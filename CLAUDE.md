# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# CentriFlow — Claude Code Master Specification
**Version:** 1.0.3
**Last Updated:** 2026-05-13
**Owner:** Brandon Wright, Centricity GIS
**Product:** CentriFlow — Backflow Prevention & Cross-Connection Control SaaS

---

## DEVELOPMENT COMMANDS

> **Status:** Project is in Phase 0–1 (no code scaffolded yet). Commands below reflect the intended setup once scaffolded.

### Prerequisites
```bash
node --version        # Must be v20.x.x (Node 20 LTS)
psql --version        # Must be PostgreSQL 17 with PostGIS
redis-cli ping        # Must return PONG
```

### API (Express — `/api`)
```bash
cd api
npm install
npm run dev           # nodemon src/server.js — hot reload on :3001
npm run migrate       # node src/db/run-migrations.js
npm run seed          # node src/db/seed.js
npm test              # (add jest when test suite is created)
```

### Frontend (Next.js — `/frontend`)
```bash
cd frontend
npm install
npm run dev           # next dev — hot reload on :3000
npm run build         # next build
npm run lint          # next lint
npm run type-check    # tsc --noEmit
```

### Database bootstrap (one-time local setup)
```bash
createdb centriflow_dev
psql centriflow_dev -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql centriflow_dev -c "CREATE EXTENSION IF NOT EXISTS postgis;"
cd api && npm run migrate && npm run seed
```

### Environment files
- Copy `api/.env.example` → `api/.env` and fill in secrets
- Copy `frontend/.env.local.example` → `frontend/.env.local` and fill in secrets
- Never commit `.env` or `.env.local` files

---

## HOW TO USE THIS FILE

This is the living specification for CentriFlow. Claude Code reads this at the start of every session.

**Rules for Claude Code:**
1. Read this entire file before writing any code
2. Never contradict a decision marked `[LOCKED]`
3. After completing any task, update the `## Build Progress` section — check off the step and add the date
4. When adding a new feature not listed here, add it to the appropriate section before building it
5. If you discover something that contradicts this spec, flag it before proceeding
6. Always check `## Known Issues & Gotchas` before touching an existing file

---

## PROJECT OVERVIEW

**Product Name:** CentriFlow
**Company:** Centricity GIS (centricitygis.com)
**Developer:** Brandon Wright — github: ronaldo0501
**Description:** Best-in-class backflow prevention and cross-connection control SaaS. Natively integrated with Cityworks AMS and Trimble Unity Maintain. Also operates 100% standalone for non-Cityworks organizations.

**What it does:**
- Tracks backflow prevention assemblies (devices) for water utilities
- Manages certified tester registry and test report submission
- Automates compliance reminders (email, SMS, postal mail)
- Creates Cityworks Service Requests and Work Orders on test failures
- Collects program fees from property owners via Stripe
- Generates state-compliant annual reports
- Conducts cross-connection surveys
- Validates assemblies against the USC FCCCHR approved list

**Markets:**
- Primary: 7,000+ Cityworks/Trimble Unity water system clients (Centricity's existing relationships)
- Secondary: 44,000+ standalone community water systems

**Competitors:** SwiftComply (was XC2), Tokay Software, HydroSoft — none have Cityworks integration

---

## REPOSITORY STRUCTURE

```
centriflow-app/                    ← Root monorepo (Desktop/centriflow-app)
├── CLAUDE.md                      ← This file — always at root
├── .github/
│   └── workflows/
│       └── deploy.yml             ← CI/CD to Azure
├── frontend/                      ← Next.js 14 app
│   ├── src/
│   │   ├── app/                   ← Next.js App Router pages
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/       ← Protected admin area
│   │   │   │   ├── layout.tsx     ← Sidebar + topbar
│   │   │   │   ├── page.tsx       ← Dashboard home
│   │   │   │   ├── devices/
│   │   │   │   ├── test-reports/
│   │   │   │   ├── violations/
│   │   │   │   ├── testers/
│   │   │   │   ├── surveys/
│   │   │   │   ├── map/
│   │   │   │   ├── fees/
│   │   │   │   ├── reports/       ← Annual report generator
│   │   │   │   ├── import/        ← Data import wizard
│   │   │   │   └── settings/
│   │   │   ├── portal/            ← PUBLIC tester portal (no auth)
│   │   │   ├── onboarding/        ← New client setup wizard
│   │   │   └── centricity-admin/  ← Internal Centricity team panel
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api.ts             ← Typed API client
│   │   ├── types/
│   │   └── hooks/
│   ├── public/
│   ├── package.json
│   └── tailwind.config.ts
├── api/                           ← Node.js/Express backend
│   ├── src/
│   │   ├── server.js              ← Entry point
│   │   ├── app.js                 ← Express app setup
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── organizations.js
│   │   │   ├── devices.js
│   │   │   ├── test-reports.js
│   │   │   ├── violations.js
│   │   │   ├── testers.js
│   │   │   ├── fees.js
│   │   │   ├── surveys.js
│   │   │   ├── cw-setup.js
│   │   │   └── admin.js
│   │   ├── middleware/
│   │   │   ├── auth.js            ← JWT validation
│   │   │   ├── orgResolver.js     ← Subdomain → org lookup
│   │   │   └── rateLimiter.js
│   │   ├── services/
│   │   │   ├── cityworks.js       ← CW API integration
│   │   │   ├── cityworks-auth.js  ← CW token management
│   │   │   ├── notifications.js   ← Email + SMS
│   │   │   ├── postal-mail.js     ← PDF + Lob.com
│   │   │   ├── usc-list.js        ← USC assembly validation
│   │   │   ├── geocoding.js       ← ESRI geocoding
│   │   │   ├── pdf-generator.js   ← Puppeteer PDFs
│   │   │   └── stripe.js          ← Payment processing
│   │   ├── db/
│   │   │   ├── index.js           ← pg pool + query helpers
│   │   │   ├── migrations/        ← Numbered SQL files
│   │   │   ├── run-migrations.js
│   │   │   └── seed.js
│   │   ├── workers/
│   │   │   ├── cw-sync-worker.js
│   │   │   ├── reminder-scheduler.js
│   │   │   ├── violations-worker.js
│   │   │   └── usc-refresh-worker.js
│   │   ├── templates/
│   │   │   └── email/             ← HTML email templates
│   │   └── utils/
│   └── package.json
└── docs/                          ← Additional documentation
```

**CRITICAL — Project location:** Always at `~/Desktop/centriflow-app`. Never OneDrive, never iCloud. Xcode/Azure conflicts happen with cloud sync.

---

## TECH STACK [LOCKED]

### Frontend
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 14 (App Router) | TypeScript, src/ directory |
| Language | TypeScript | 5.x | Strict mode |
| Styling | Tailwind CSS | 3.x | Utility-first |
| State | React built-ins | — | useState, useReducer, Context |
| Data fetching | fetch + SWR | — | SWR for client-side, fetch for server components |
| Charts | Recharts | latest | Dashboard compliance charts |
| Maps | ArcGIS JS API | 4.x | Loaded from CDN in map page |
| PDF upload | Browser File API | — | No third-party uploader needed |
| Icons | Lucide React | latest | Consistent icon set |

### Backend
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | 20 LTS | |
| Framework | Express | 4.x | |
| Language | JavaScript | ES2022 | No TypeScript in API (keep it simple) |
| Database | PostgreSQL | 17 | With PostGIS extension |
| Cache / Queues | Redis | 7.x | Via ioredis |
| Job queues | Bull | 4.x | Background workers |
| Auth | JWT | — | jsonwebtoken package |
| Password hashing | bcryptjs | — | |
| File storage | Azure Blob Storage | — | @azure/storage-blob |
| Email | SendGrid | — | Transactional email |
| SMS | Twilio | — | Reminder SMS |
| Postal mail | Lob.com | — | Pro+ clients only |
| Payments | Stripe + Stripe Connect | — | Fee collection |
| PDF generation | Puppeteer | latest | Server-side, headless Chrome |
| Geocoding | ESRI ArcGIS REST | — | Address → lat/lng |
| HTTP client | axios | — | External API calls |
| UUID | uuid | v4 | All primary keys |
| Date handling | date-fns | — | Never use moment.js |
| Validation | joi | — | Request body validation |
| Logging | winston | — | Structured JSON logs |

### Infrastructure [LOCKED]
| Resource | Service | SKU (start) | SKU (scale) |
|----------|---------|-------------|-------------|
| App hosting | Azure App Service | B2 Basic | P1v3 Premium at 11+ clients |
| Database | Azure PostgreSQL Flexible | Burstable B1ms (PG17) | General D2s at 26+ clients |
| Cache | Azure Cache for Redis | C0 Basic | C1 Standard at 6+ clients |
| File storage | Azure Blob Storage | Hot LRS | Scale storage as needed |
| Secrets | Azure Key Vault | Standard | Standard |
| Auth | Azure AD B2C | Free tier | — |
| CDN | Azure Front Door | Skip for now | Add at 11+ clients |
| DNS | Azure DNS | Standard | Standard |
| Monitoring | Azure App Insights | Free tier | — |
| Email | SendGrid | Existing Centricity account | — |
| CI/CD | GitHub Actions | Free tier | — |

**Azure Region:** West US 2 (all resources)
**Resource Group:** `centriflow-rg`

---

## ENVIRONMENT VARIABLES

### API (.env) — Local Development
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://localhost:5432/centriflow_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=                        # Generate with: openssl rand -base64 32
JWT_REFRESH_SECRET=                # Different secret for refresh tokens
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
SENDGRID_API_KEY=SG...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
ARCGIS_API_KEY=...
AZURE_BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_BLOB_CONTAINER_NAME=centriflow-files
LOB_API_KEY=test_...
ANTHROPIC_API_KEY=sk-ant-...       # For any AI features
CENTRICITY_ADMIN_TOKEN=            # For internal admin panel access
ORG_SUBDOMAIN_MODE=false           # false = Mode 1 (single URL). true = Mode 2 (client subdomains)
BASE_DOMAIN=centriflow.centricitygis.com  # Used by orgResolver to parse subdomains
```

### Frontend (.env.local) — Local Development
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=https://centriflow.centricitygis.com
NEXT_PUBLIC_ARCGIS_API_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Production — Set in Azure App Service Application Settings
Same keys as above with live values (sk_live_, re_live_, etc.)
Never commit .env files. They are in .gitignore.

---

## DATABASE SCHEMA

**Database name (local):** `centriflow_dev`
**Database name (production):** `centriflow`
**Extensions required:** `uuid-ossp`, `postgis`

### Tables

#### `organizations`
Core table — one row per water utility client.
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
name              VARCHAR(255) NOT NULL
slug              VARCHAR(100) UNIQUE NOT NULL  -- used in subdomain: antioch.centriflow.centricitygis.com
state             CHAR(2) NOT NULL
timezone          VARCHAR(50) NOT NULL DEFAULT 'America/Denver'
plan_tier         VARCHAR(20) NOT NULL  -- starter/growth/professional/enterprise
device_limit      INTEGER               -- NULL = unlimited
cw_enabled        BOOLEAN NOT NULL DEFAULT FALSE
cw_base_url       VARCHAR(500)          -- https://cityworks.org.gov
cw_domain         VARCHAR(100)
cw_sync_mode      VARCHAR(20)           -- sr_only/wo_only/sr_and_wo
cw_sr_problem_sid VARCHAR(100)          -- CW SR problem code SID for backflow failures
cw_wo_template_sid VARCHAR(100)         -- CW WO template SID for repairs
fee_config        JSONB                 -- See fee config structure below
org_settings      JSONB                 -- Logo URL, colors, notification prefs
stripe_customer_id VARCHAR(100)
stripe_connect_account_id VARCHAR(100)  -- For city fee collection
status            VARCHAR(20) NOT NULL DEFAULT 'onboarding'  -- onboarding/active/suspended
approved_list_sources TEXT[] DEFAULT ARRAY['usc']
lob_enabled       BOOLEAN DEFAULT FALSE -- Automated mailing via Lob.com
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**fee_config JSONB structure:**
```json
{
  "annual_program_fee": { "enabled": false, "amount": 75.00, "billing_cycle": "annual" },
  "retest_fee": { "enabled": false, "amount": 95.00, "waive_first_occurrence": true },
  "noncompliance_fee": {
    "enabled": false,
    "tiers": [
      { "days_overdue": 30, "amount": 100.00 },
      { "days_overdue": 60, "amount": 250.00 },
      { "days_overdue": 90, "amount": 500.00 }
    ]
  },
  "failure_penalty_fee": { "enabled": false, "amount": 50.00, "legal_confirmed": false },
  "tester_per_test_fee": { "enabled": false, "amount": 10.00 },
  "centriflow_platform_fee": { "amount": 2.50 }
}
```

#### `properties`
Premise/address. One-to-many with devices.
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id           UUID NOT NULL REFERENCES organizations(id)
address_line1    VARCHAR(255) NOT NULL
city             VARCHAR(100) NOT NULL
state            CHAR(2) NOT NULL
zip              VARCHAR(10)
parcel_id        VARCHAR(100)
account_number   VARCHAR(100)
owner_name       VARCHAR(255)
owner_email      VARCHAR(255)
owner_phone      VARCHAR(20)
geom             GEOMETRY(Point, 4326)
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `devices`
Backflow prevention assembly. Core entity.
```sql
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id               UUID NOT NULL REFERENCES organizations(id)
property_id          UUID NOT NULL REFERENCES properties(id)
tag_number           VARCHAR(50) NOT NULL
assembly_type        VARCHAR(10) NOT NULL  -- RP/DC/PVB/SVB/AG/DCDA/RPDA
size                 VARCHAR(20) NOT NULL  -- '3/4"', '1"', '2"', etc.
manufacturer         VARCHAR(100)
model_number         VARCHAR(100)
serial_number        VARCHAR(100)
hazard_classification VARCHAR(10) NOT NULL  -- high/low
service_type         VARCHAR(30)            -- domestic/irrigation/fire/commercial
location_notes       TEXT
install_date         DATE
last_test_date       DATE
last_test_result     VARCHAR(10)            -- pass/fail/not_tested
next_test_due        DATE
test_frequency_months INTEGER NOT NULL DEFAULT 12
pending_test_event   VARCHAR(30)            -- installation/post_repair/post_relocation
test_required_by     DATE
usc_approved         BOOLEAN DEFAULT NULL   -- NULL = not checked yet
is_lead_free         BOOLEAN DEFAULT NULL
status               VARCHAR(20) NOT NULL DEFAULT 'active'  -- active/inactive/removed
geom                 GEOMETRY(Point, 4326)
created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (org_id, tag_number)
```

#### `users`
Staff users for the admin dashboard.
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id       UUID NOT NULL REFERENCES organizations(id)
email        VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255)
name         VARCHAR(255) NOT NULL
role         VARCHAR(20) NOT NULL DEFAULT 'staff'  -- admin/staff/readonly
cw_user_id   VARCHAR(100)
last_login   TIMESTAMPTZ
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `certified_testers`
Cross-org tester registry. org_id is NULL for the master record.
```sql
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id               UUID REFERENCES organizations(id)  -- NULL = cross-org master record
email                VARCHAR(255) NOT NULL
name                 VARCHAR(255) NOT NULL
license_number       VARCHAR(100) NOT NULL
license_state        CHAR(2) NOT NULL
license_expiration   DATE NOT NULL
certifying_body      VARCHAR(100)  -- ABPA/ASSE/TCEQ/etc.
certification_type   VARCHAR(20) DEFAULT 'general'  -- general/cccs/both
company_name         VARCHAR(255)
company_phone        VARCHAR(20)
gauge_serial         VARCHAR(100)
gauge_cal_date       DATE
gauge_cal_cert_url   VARCHAR(500)  -- Azure Blob URL
is_approved          BOOLEAN NOT NULL DEFAULT FALSE
is_verified          BOOLEAN NOT NULL DEFAULT FALSE  -- credential verified by CentriFlow
test_count           INTEGER NOT NULL DEFAULT 0
created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `test_reports`
One record per test event.
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
device_id        UUID NOT NULL REFERENCES devices(id)
tester_id        UUID NOT NULL REFERENCES certified_testers(id)
test_date        DATE NOT NULL
test_event_type  VARCHAR(30) NOT NULL DEFAULT 'annual'
                 -- annual/installation/post_repair/post_relocation/initial
-- Readings (PSI values, labeled per USC 10th Edition)
reading_cv1_initial  DECIMAL(6,2)   -- Check Valve 1 initial
reading_cv1_final    DECIMAL(6,2)   -- Check Valve 1 final
reading_cv2_initial  DECIMAL(6,2)   -- Check Valve 2 (DC, DCDA, RPDA)
reading_cv2_final    DECIMAL(6,2)
reading_rv_opened    DECIMAL(6,2)   -- Relief Valve opens at (RP, RPDA)
reading_air_inlet    DECIMAL(6,2)   -- Air inlet opens at (PVB, SVB)
result           VARCHAR(10) NOT NULL  -- pass/fail
repair_made      BOOLEAN NOT NULL DEFAULT FALSE
repair_description TEXT
retest_required  BOOLEAN NOT NULL DEFAULT FALSE
pdf_url          VARCHAR(500)   -- Azure Blob URL of test report PDF
photo_urls       JSONB          -- Array of photo URLs
notes            TEXT
cw_sr_id         VARCHAR(100)
cw_sr_number     VARCHAR(50)
cw_wo_id         VARCHAR(100)
cw_wo_number     VARCHAR(50)
cw_synced_at     TIMESTAMPTZ
cw_sync_status   VARCHAR(20)   -- pending/synced/failed/not_applicable
status           VARCHAR(20) NOT NULL DEFAULT 'submitted'
                 -- submitted/reviewed/accepted/rejected
submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
reviewed_at      TIMESTAMPTZ
reviewed_by      UUID REFERENCES users(id)
```

#### `violations`
Non-compliance tracking.
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id              UUID NOT NULL REFERENCES organizations(id)
device_id           UUID NOT NULL REFERENCES devices(id)
test_report_id      UUID REFERENCES test_reports(id)
violation_type      VARCHAR(30) NOT NULL  -- overdue/failed_test/no_tester
issued_date         DATE NOT NULL
compliance_deadline DATE NOT NULL
resolved_date       DATE
status              VARCHAR(20) NOT NULL DEFAULT 'open'
                    -- open/in_progress/resolved/waived
notes               TEXT
waived_by           UUID REFERENCES users(id)
waive_reason        TEXT
created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `fees`
All fee records tied to Stripe.
```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id                  UUID NOT NULL REFERENCES organizations(id)
device_id               UUID REFERENCES devices(id)
test_report_id          UUID REFERENCES test_reports(id)
violation_id            UUID REFERENCES violations(id)
fee_type                VARCHAR(30) NOT NULL
                        -- annual/retest/noncompliance/failure/tester_per_test
fee_payer               VARCHAR(20) NOT NULL DEFAULT 'property_owner'
                        -- property_owner/tester
amount                  DECIMAL(10,2) NOT NULL
platform_fee            DECIMAL(10,2)   -- CentriFlow's cut ($2.50 default)
status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                        -- pending/invoiced/paid/waived/refunded
stripe_payment_intent_id VARCHAR(200)
stripe_invoice_id        VARCHAR(200)
stripe_checkout_url      VARCHAR(500)
due_date                 DATE
paid_at                  TIMESTAMPTZ
waived_by                UUID REFERENCES users(id)
waive_reason             TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `surveys`
Cross-connection survey records.
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id                UUID NOT NULL REFERENCES organizations(id)
property_id           UUID REFERENCES properties(id)
survey_address        VARCHAR(255)   -- If property not yet in system
survey_date           DATE NOT NULL
inspector_id          UUID REFERENCES users(id)
survey_method         VARCHAR(30)    -- onsite/self_cert/remote
establishment_type    VARCHAR(50)    -- irrigation/fire/boiler/chemical/industrial/medical/other
cross_connection_found BOOLEAN
hazard_level          VARCHAR(10)
assembly_required     BOOLEAN
recommended_type      VARCHAR(10)   -- RP/DC/PVB/SVB/AG
recommended_size      VARCHAR(20)
outcome               VARCHAR(30)   -- compliant/noncompliant/install_required/followup
next_survey_due       DATE
resulting_device_id   UUID REFERENCES devices(id)
notes                 TEXT
photos                JSONB
created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `cw_sync_log`
Full audit trail of every Cityworks API call.
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id           UUID NOT NULL REFERENCES organizations(id)
entity_type      VARCHAR(30) NOT NULL   -- test_report/violation/device
entity_id        UUID NOT NULL
cw_object_type   VARCHAR(10)            -- SR/WO
cw_object_id     VARCHAR(100)
action           VARCHAR(20) NOT NULL   -- create/update/close/attach
request_payload  JSONB
response_payload JSONB
status           VARCHAR(10) NOT NULL   -- success/error/pending
error_message    TEXT
retry_count      INTEGER NOT NULL DEFAULT 0
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `assembly_approved_models`
USC FCCCHR and state-specific approved assembly lists.
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
list_source     VARCHAR(20) NOT NULL   -- usc/ca/sc/ny/tx
assembly_type   VARCHAR(10) NOT NULL
manufacturer    VARCHAR(100) NOT NULL
model_number    VARCHAR(100) NOT NULL
size            VARCHAR(20) NOT NULL
orientation     VARCHAR(50)
approval_date   DATE
renewal_date    DATE
is_lead_free    BOOLEAN DEFAULT FALSE
is_current      BOOLEAN DEFAULT TRUE
list_updated_at DATE NOT NULL
UNIQUE (list_source, assembly_type, manufacturer, model_number, size)
```

#### `notifications_log`
Every notification sent.
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id           UUID NOT NULL REFERENCES organizations(id)
device_id        UUID REFERENCES devices(id)
recipient_email  VARCHAR(255)
recipient_phone  VARCHAR(20)
channel          VARCHAR(10) NOT NULL   -- email/sms/mail
template_type    VARCHAR(50) NOT NULL
lob_letter_id    VARCHAR(100)
lob_delivery_date DATE
sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
status           VARCHAR(20) DEFAULT 'sent'   -- sent/failed/delivered
```

### Key Indexes
```sql
CREATE INDEX idx_devices_org_status ON devices(org_id, status);
CREATE INDEX idx_devices_next_due ON devices(next_test_due) WHERE status = 'active';
CREATE INDEX idx_devices_geom ON devices USING GIST(geom);
CREATE INDEX idx_properties_geom ON properties USING GIST(geom);
CREATE INDEX idx_test_reports_device_date ON test_reports(device_id, test_date DESC);
CREATE INDEX idx_fees_status ON fees(org_id, status) WHERE status = 'pending';
CREATE INDEX idx_violations_status ON violations(org_id, status) WHERE status = 'open';
CREATE INDEX idx_cw_sync_log_entity ON cw_sync_log(entity_type, entity_id);
CREATE INDEX idx_assembly_lookup ON assembly_approved_models(list_source, assembly_type, LOWER(manufacturer), LOWER(model_number), size) WHERE is_current = TRUE;
```

---

## API DESIGN

### Base URL
- Local: `http://localhost:3001`
- Production: `https://centriflow.centricitygis.com/api`

### Org Resolver Middleware — Dual-Mode Architecture [LOCKED]

**Current mode:** Mode 1 — single URL, org resolved from JWT
**Future mode:** Mode 2 — client subdomains, org resolved from hostname

The middleware is written to handle both modes simultaneously from day one.
Switching from Mode 1 → Mode 2 requires only:
1. Set `ORG_SUBDOMAIN_MODE=true` in Azure App Service settings
2. Add wildcard CNAME DNS record
3. Add SSL coverage (Azure Front Door)
**Zero code changes needed.**

Resolution priority order (all checked every request):
1. Subdomain parse (only active when `ORG_SUBDOMAIN_MODE=true`)
2. `X-Org-Slug` request header (set by frontend on every API call)
3. `req.user.org_id` from JWT (backstop — always works)

**Full implementation — `/api/src/middleware/orgResolver.js`:**
```javascript
const { query } = require('../db');

// Cache org lookups in memory for 5 min to avoid DB hits on every request
const orgCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedOrg = async (identifier, field) => {
  const cacheKey = `${field}:${identifier}`;
  const cached = orgCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.org;

  const result = await query(
    `SELECT id, name, slug, state, plan_tier, cw_enabled, cw_base_url,
            cw_domain, cw_sync_mode, cw_sr_problem_sid, cw_wo_template_sid,
            fee_config, org_settings, approved_list_sources, lob_enabled, status
     FROM organizations WHERE ${field} = $1 AND status != 'suspended'`,
    [identifier]
  );
  const org = result.rows[0] || null;
  if (org) orgCache.set(cacheKey, { org, ts: Date.now() });
  return org;
};

const orgResolver = async (req, res, next) => {
  try {
    // ── MODE 2: Subdomain resolution ─────────────────────────────────────────
    // Active when ORG_SUBDOMAIN_MODE=true
    // Parses: antioch.centriflow.centricitygis.com → slug 'antioch'
    if (process.env.ORG_SUBDOMAIN_MODE === 'true') {
      const host = req.hostname.toLowerCase();
      const baseDomain = (process.env.BASE_DOMAIN || 'centriflow.centricitygis.com').toLowerCase();
      // Match: {slug}.centriflow.centricitygis.com
      const subdomainRegex = new RegExp(`^([a-z0-9-]+)\\.${baseDomain.replace(/\./g, '\\.')}$`);
      const match = host.match(subdomainRegex);

      if (match && match[1] !== 'www' && match[1] !== 'api') {
        const slug = match[1];
        const org = await getCachedOrg(slug, 'slug');
        if (!org) {
          return res.status(404).json({
            success: false,
            error: 'Organization not found',
            code: 'ORG_NOT_FOUND'
          });
        }
        req.org = org;
        return next();
      }
    }

    // ── MODE 1: Header resolution ─────────────────────────────────────────────
    // Frontend sends X-Org-Slug on every request after login
    // Also used as fallback in Mode 2 for the base domain (admin, onboarding)
    const slugFromHeader = req.headers['x-org-slug'];
    if (slugFromHeader) {
      const org = await getCachedOrg(slugFromHeader, 'slug');
      if (org) {
        req.org = org;
        return next();
      }
    }

    // ── BACKSTOP: JWT org_id resolution ───────────────────────────────────────
    // req.user is set by auth middleware (runs before orgResolver)
    // This always works regardless of mode — safe fallback for all requests
    if (req.user?.org_id) {
      const org = await getCachedOrg(req.user.org_id, 'id');
      if (org) {
        req.org = org;
        return next();
      }
    }

    // ── Public routes: no org context needed ──────────────────────────────────
    // Auth routes, tester portal device lookup, and public endpoints
    // don't need req.org — they'll resolve org from the request body or params
    const publicPaths = [
      '/auth/',
      '/api/v1/devices/lookup',
      '/api/v1/testers/register',
      '/api/v1/testers/public',
      '/webhooks/',
      '/health',
    ];
    const isPublic = publicPaths.some(p => req.path.startsWith(p));
    if (isPublic) return next();

    // If we reach here and have no org, return 401
    return res.status(401).json({
      success: false,
      error: 'Unable to resolve organization context',
      code: 'ORG_CONTEXT_MISSING'
    });

  } catch (err) {
    console.error('orgResolver error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error in org resolution',
      code: 'ORG_RESOLVER_ERROR'
    });
  }
};

// Call this when an org's settings are updated so the cache doesn't serve stale data
const invalidateOrgCache = (orgId, slug) => {
  orgCache.delete(`id:${orgId}`);
  if (slug) orgCache.delete(`slug:${slug}`);
};

module.exports = { orgResolver, invalidateOrgCache };
```

**Register in `/api/src/app.js` — order matters:**
```javascript
const { orgResolver } = require('./middleware/orgResolver');

// Order: 1. parse body, 2. auth, 3. resolve org
app.use(express.json());
app.use(authMiddleware);   // Sets req.user from JWT
app.use(orgResolver);      // Uses req.user.org_id as backstop — MUST come after auth
```

**Frontend — set the header on every API call (`/frontend/src/lib/api.ts`):**
```typescript
// After login, store the org slug and send it with every request
const orgSlug = localStorage.getItem('org_slug'); // set at login

headers: {
  'Authorization': `Bearer ${token}`,
  'X-Org-Slug': orgSlug || '',
  'Content-Type': 'application/json',
}
```

**To switch from Mode 1 → Mode 2 when ready:**
1. Azure App Service → Application Settings → `ORG_SUBDOMAIN_MODE` = `true`
2. DNS: Add wildcard CNAME `*.centriflow` → `centriflow-app.azurewebsites.net`
3. SSL: Enable Azure Front Door Standard for wildcard SSL
4. Update tester invite email template to use `{slug}.centriflow.centricitygis.com/portal`
5. Update Centricity admin panel to display each client's subdomain URL
6. Done — no API or frontend code changes needed

### Authentication
All routes except the following require a valid JWT Bearer token:
- `POST /auth/login`
- `POST /auth/register-org`
- `POST /auth/refresh`
- `POST /auth/tester-login`
- `POST /api/v1/reports` (tester portal submission — uses tester JWT)
- `GET /api/v1/devices/lookup` (tester portal device search)
- `POST /api/v1/testers/register` (public tester self-registration)
- `GET /api/v1/testers/public` (public tester directory)

### Org Isolation [LOCKED — CRITICAL]
**Every single database query must filter by org_id.** This is non-negotiable.
```javascript
// CORRECT
const devices = await query(
  'SELECT * FROM devices WHERE org_id = $1 AND status = $2',
  [req.org.id, 'active']
);

// WRONG — never do this
const devices = await query('SELECT * FROM devices WHERE status = $1', ['active']);
```

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "per_page": 50 }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Human readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

### API Routes Reference

#### Auth
```
POST   /auth/login                    Email/password → JWT
POST   /auth/register-org             New org + admin user
POST   /auth/refresh                  Refresh JWT
POST   /auth/tester-login             Tester portal login
POST   /auth/cw/test-connection       Validate CW credentials
```

#### Devices
```
GET    /api/v1/devices                List (paginated, filterable)
POST   /api/v1/devices                Create
GET    /api/v1/devices/:id            Detail + last 5 tests
PUT    /api/v1/devices/:id            Update
DELETE /api/v1/devices/:id            Soft delete (status=removed)
GET    /api/v1/devices/due            Devices due in 30/60/90 days
GET    /api/v1/devices/lookup         Public — search by tag or address
POST   /api/v1/devices/import         Bulk import (CSV parsed to array)
```

#### Test Reports
```
POST   /api/v1/reports                Submit (tester portal)
GET    /api/v1/reports                List (filtered)
GET    /api/v1/reports/:id            Detail
PUT    /api/v1/reports/:id/review     Admin accept/reject
POST   /api/v1/reports/:id/retest     Submit retest
GET    /api/v1/reports/:id/pdf        Stream PDF
```

#### Testers
```
GET    /api/v1/testers                List org's approved testers
POST   /api/v1/testers/register       Public self-registration
PUT    /api/v1/testers/:id/approve    Admin approve
PUT    /api/v1/testers/:id/reject     Admin reject
GET    /api/v1/testers/public         Public directory (name, company, phone)
```

#### Violations
```
GET    /api/v1/violations             List (filtered by status/type)
POST   /api/v1/violations/:id/actions Log enforcement action
PUT    /api/v1/violations/:id/resolve Mark resolved
PUT    /api/v1/violations/:id/waive   Waive with reason
```

#### Fees
```
GET    /api/v1/fees                   List fees
POST   /api/v1/fees/:id/waive         Admin waive
POST   /api/v1/fees/checkout          Create Stripe Checkout session
POST   /api/v1/webhooks/stripe        Stripe webhook handler
```

#### Cityworks
```
POST   /api/v1/cw/test-connection     Test CW credentials
GET    /api/v1/cw/discover            Auto-discover SR codes + WO templates
POST   /api/v1/cw/configure           Save CW field mappings
POST   /api/v1/cw/staging-test        Create [STAGING TEST] SR to verify
GET    /api/v1/cw/sync/status/:id     SR/WO sync status for a test report
GET    /api/v1/cw/sync/log            Audit log of all CW API calls
```

#### Surveys
```
GET    /api/v1/surveys                List surveys
POST   /api/v1/surveys                Create survey record
GET    /api/v1/surveys/:id            Detail
PUT    /api/v1/surveys/:id            Update
```

#### Reports & Export
```
GET    /api/v1/annual-report/:year    Pull annual report data
POST   /api/v1/annual-report/:year/generate  Generate PDF
GET    /api/v1/export/devices.csv     Device inventory CSV
GET    /api/v1/export/compliance.csv  Compliance status CSV
```

#### Admin (Centricity internal)
```
GET    /centricity-admin/orgs         All organizations
POST   /centricity-admin/orgs/new     Provision new org
GET    /centricity-admin/orgs/:id     Org detail
PATCH  /centricity-admin/orgs/:id     Update org
GET    /centricity-admin/billing      MRR/ARR overview
GET    /centricity-admin/cw-health    CW sync health across all orgs
```

---

## CITYWORKS INTEGRATION [LOCKED]

### Authentication
- CW uses token-based auth via `POST /Services/Authentication/authenticate`
- Token cached in Redis: key `cw_token:{orgId}`, TTL 8 hours
- Auto-refresh before expiry
- Credentials stored in org settings JSONB (encrypted in production via Azure Key Vault)

### Sync Modes
Configured per org. Options: `sr_only`, `wo_only`, `sr_and_wo` (recommended default)

### Trigger Events
| CentriFlow Event | CW Action |
|-----------------|-----------|
| Test result = FAIL | Create SR (problem code from org config) + optional WO |
| Retest = PASS | Close SR + Close WO |
| Device overdue 30+ days | Create SR |
| Violation resolved | Update + close SR |
| Test report PDF attached | Attach file to SR |

### SR Creation Payload
```javascript
{
  ProblemSid: org.cw_sr_problem_sid,
  AddressId: device.cw_address_id,
  Location: device.property.address_line1,
  Description: `CentriFlow: Backflow device ${tag} failed test on ${date}. Assembly: ${type} ${size} at ${address}. Repair or replace and retest by ${deadline}.`,
  XCoord: device.lng,
  YCoord: device.lat,
  CustomAttributes: [
    { AttributeName: 'CentriFlow_DeviceId', Value: device.id },
    { AttributeName: 'CentriFlow_ReportId', Value: report.id },
    { AttributeName: 'CentriFlow_TagNumber', Value: device.tag_number },
    { AttributeName: 'CentriFlow_Deadline', Value: deadline }
  ]
}
```

### CW API Endpoints Used
```
POST /Services/Authentication/authenticate
POST /Services/ServiceRequest/Create
POST /Services/ServiceRequest/Update
POST /Services/WorkOrder/Create
POST /Services/WorkOrder/Update
POST /Services/Attachment/AddAttachment
GET  /Services/Domain/GetDomains          (setup wizard — get SR problem codes)
GET  /Services/WorkOrder/GetTemplates     (setup wizard — get WO templates)
GET  /Services/Employee/GetEmployees      (setup wizard — get employee list)
GET  /Services/GIS/GetAddressInfo         (device geocoding)
```

### Error Handling
- CW failures NEVER block a test submission
- Failed syncs go to retry queue (3 attempts, exponential backoff)
- After 3 failures: mark as failed, alert admin via email
- All CW calls logged to `cw_sync_log` regardless of success/failure

---

## BUSINESS RULES

### Assembly Types [LOCKED]
Valid values: `RP`, `DC`, `PVB`, `SVB`, `AG`, `DCDA`, `RPDA`

### Test Readings by Assembly Type (USC 10th Edition)
| Assembly | Fields Required |
|----------|----------------|
| RP | cv1_initial, cv1_final, rv_opened |
| DC | cv1_initial, cv1_final, cv2_initial, cv2_final |
| PVB | cv1_initial, cv1_final, air_inlet |
| SVB | cv1_initial, cv1_final, air_inlet |
| AG | No readings — air gap inspection only |
| DCDA | cv1_initial, cv1_final, cv2_initial, cv2_final (double detector) |
| RPDA | cv1_initial, cv1_final, rv_opened (reduced pressure detector) |

### Test Event Types [LOCKED]
`annual` / `installation` / `post_repair` / `post_relocation` / `initial`

When to trigger non-annual events:
- `installation` → device created with status = active
- `post_repair` → repair_made = true on a test_report
- `post_relocation` → device.location_notes updated (location changed)
- `initial` → device imported with no test history

### Pass/Fail Logic
The tester selects PASS or FAIL. CentriFlow validates readings look plausible (no negative values, no unrealistic PSI) but does NOT auto-determine pass/fail from readings — the certified tester makes that determination per USC procedure.

### Hazard Classification [LOCKED]
`high` / `low` — determined at the premise/device level. High hazard requires RP assemblies minimum.

### Compliance Deadline
Default: 30 days from test failure to retest/repair. Configurable per org.

### Tester License Validation
- Check license_expiration > today before accepting a test submission
- Check gauge_cal_date is within 12 months (configurable per org)
- Tester must be is_approved = true for the submitting org
- SC exception: license must be issued by SCDES specifically

### Fee Rules
- Failure penalty fee: `legal_confirmed` must be true before any fee can be created of this type
- Retest fee: only charged when retest_required = true AND waive_first_occurrence = false (or it's not the first occurrence)
- Noncompliance fees: auto-created by violations worker at 30/60/90 day thresholds
- Annual program fees: created by annual scheduler, not on demand

---

## FRONTEND CONVENTIONS

### File Naming
- Pages: `page.tsx`
- Layouts: `layout.tsx`
- Components: `PascalCase.tsx` (e.g. `DeviceCard.tsx`)
- Utilities: `camelCase.ts` (e.g. `formatDate.ts`)
- Types: `camelCase.types.ts`

### Component Structure
```typescript
// Every component file structure:
import { ... } from "react"
import { ... } from "@/components/..."
import type { ... } from "@/types/..."

interface Props {
  // Props typed here
}

export default function ComponentName({ prop1, prop2 }: Props) {
  // Component logic
}
```

### API Client (`/frontend/src/lib/api.ts`)
Always use this — never raw fetch in components.
```typescript
// Usage:
const devices = await api.get('/api/v1/devices?status=active')
const report = await api.post('/api/v1/reports', formData)
```

### Tailwind Classes
- Mobile-first: always start with base, add `md:` and `lg:` for larger screens
- iPad target: design for 768px width minimum
- No inline styles — Tailwind only
- Use `cn()` utility for conditional classes

### Status Pills
Consistent status colors across the app:
- `pass` / `active` / `compliant` → green
- `fail` / `overdue` / `violation` → red
- `due` / `pending` / `warning` → amber/orange
- `submitted` / `in_progress` → blue
- `inactive` / `removed` / `skipped` → gray

---

## DEPLOYMENT

### Azure Setup Steps (for Brandon)
Do these once in the Azure Portal (portal.azure.com):

1. **Create Resource Group**
   - Name: `centriflow-rg`
   - Region: West US 2

2. **Create PostgreSQL Flexible Server**
   - Name: `centriflow-db`
   - Version: PostgreSQL 17
   - SKU: Burstable B1ms
   - Storage: 32 GB
   - Admin username: `cfadmin`
   - Create a strong password (save it in a password manager)
   - After creation: go to Extensions → enable `uuid-ossp` and `postgis`
   - Go to Networking → Add your local IP address to the firewall

3. **Create Redis Cache**
   - Name: `centriflow-cache`
   - SKU: Basic C0 (upgrade to Standard C1 at 6+ clients)
   - Enable non-SSL port: NO (use SSL only)

4. **Create App Service Plan**
   - Name: `centriflow-plan`
   - OS: Linux
   - SKU: B2 Basic
   - Region: West US 2

5. **Create API App Service**
   - Name: `centriflow-api`
   - Plan: `centriflow-plan`
   - Runtime: Node 20 LTS
   - After creation: Settings → General Settings → Always On: ON

6. **Create Frontend App Service**
   - Name: `centriflow-app`
   - Same plan, same runtime
   - After creation: Always On: ON

7. **Create Storage Account**
   - Name: `centriflowfiles` (must be lowercase, no dashes)
   - Redundancy: LRS
   - After creation: create a Blob Container named `centriflow-files` with Private access

8. **Create Key Vault**
   - Name: `centriflow-vault`
   - For now, we'll store env vars as App Service Application Settings
   - Add Key Vault later for Cityworks credentials

9. **Get connection strings**
   - PostgreSQL: Connection strings tab → copy the connection string
   - Redis: Access Keys → copy Primary connection string
   - Blob Storage: Access Keys → copy Connection String

### GitHub Actions Deployment
Set these secrets in GitHub repo Settings → Secrets:
- `AZURE_API_PUBLISH_PROFILE` → Download from centriflow-api App Service → Get publish profile
- `AZURE_FRONTEND_PUBLISH_PROFILE` → Download from centriflow-app App Service → Get publish profile

### Custom Domain Setup
CentriFlow runs as a subdomain of centricitygis.com — **no new domain purchase needed.**
Target URL: `https://centriflow.centricitygis.com`
API URL: `https://centriflow.centricitygis.com/api`
Client subdomains: `https://antioch.centriflow.centricitygis.com`

Steps:
1. Azure: centriflow-app App Service → Custom domains → Add domain → enter `centriflow.centricitygis.com`
2. In your DNS provider for centricitygis.com: Add CNAME record → `centriflow` → `centriflow-app.azurewebsites.net`
3. Azure: Enable App Service Managed Certificate (free SSL) for `centriflow.centricitygis.com`
4. For the API: Add CNAME → `centriflow-api` → `centriflow-api.azurewebsites.net` (or route via the same app with a path prefix `/api`)
5. For client subdomains (e.g. `antioch.centriflow.centricitygis.com`): Add a wildcard CNAME → `*.centriflow` → `centriflow-app.azurewebsites.net`

**Note on wildcard SSL:** Azure App Service Managed Certificates do not support wildcard domains. For client subdomains, either: (a) use a single-domain cert per client subdomain added on demand, or (b) use Azure Front Door Standard which supports wildcard SSL — add this when you have 3+ active clients.

---

## BUILD PROGRESS

Track completed items here. Update after every session.

### Phase 0 — Accounts & Prerequisites
- [x] GitHub repo `ronaldo0501/centriflow-app` created
- [x] Azure resource group `centriflow-rg` created (West US 2)
- [x] DNS CNAME added in centricitygis.com DNS → `centriflow` → `centriflow-app.azurewebsites.net`
- [x] Stripe account created, Connect enabled (Platform model selected)
- [x] SendGrid — existing Centricity GIS account, domain already verified
- [x] Twilio account confirmed, phone number and credentials collected
- [x] Lob.com account created, test API key collected
- [x] ESRI — Centricity is an ESRI partner, existing account and API key available

### Phase 1 — Local Dev Environment
- [x] Node.js 20 LTS installed (v20.20.2)
- [x] PostgreSQL 17 installed with PostGIS 3.6
- [x] `centriflow_dev` database created
- [x] PostGIS extension enabled on `centriflow_dev`
- [x] Redis installed and running (redis-cli ping = PONG)
- [x] Azure CLI installed (2.85.0)
- [x] Claude Code installed (2.1.131)

### Phase 2 — Project Scaffold
- [x] `/Desktop/centriflow-app` folder created
- [x] Git repo initialized and linked to GitHub
- [x] `/frontend` Next.js 14 app scaffolded (Next.js 14.2, TypeScript, Tailwind, App Router)
- [x] `/api` Express app created
- [x] All API npm dependencies installed
- [x] Folder structure created (`routes/`, `middleware/`, `services/`, etc.)
- [x] `.env` files created (not committed)
- [x] `CLAUDE.md` at project root
- [x] Initial commit pushed to GitHub

### Phase 3 — Database Schema
- [x] `/api/src/db/migrations/` folder created
- [x] 001_organizations.sql
- [x] 002_properties.sql
- [x] 003_devices.sql
- [x] 004_users.sql
- [x] 005_certified_testers.sql
- [x] 006_test_reports.sql
- [x] 007_violations.sql
- [x] 008_fees.sql
- [x] 009_surveys.sql
- [x] 010_cw_sync_log.sql
- [x] 011_assembly_approved_models.sql
- [x] 012_notifications_log.sql
- [x] `run-migrations.js` created and tested
- [x] All migrations run successfully on `centriflow_dev`
- [x] `seed.js` created with test org and sample data
- [x] All PostGIS indexes created

### Phase 4 — Authentication
- [x] JWT auth middleware (`/middleware/auth.js`)
- [x] Org resolver middleware (`/middleware/orgResolver.js`)
- [x] Standalone login route (`POST /auth/login`)
- [x] Org registration route (`POST /auth/register-org`)
- [x] Token refresh route (`POST /auth/refresh`)
- [x] Tester portal login (`POST /auth/tester-login`)
- [x] Cityworks auth service (`/services/cityworks-auth.js`)
- [ ] CW test-connection endpoint (Phase 6)
- [x] Auth tested locally with Postman/curl

### Phase 5 — Core API Routes
- [x] Organizations routes (`/routes/organizations.js`)
- [x] Devices routes (`/routes/devices.js`) — full CRUD
- [x] Devices bulk import endpoint
- [x] Test reports routes (`/routes/test-reports.js`)
- [ ] CW sync trigger on test FAIL (Phase 6)
- [x] Violations routes (`/routes/violations.js`)
- [x] Testers routes (`/routes/testers.js`)
- [x] Fees routes (`/routes/fees.js`)
- [ ] Stripe webhook handler (Phase 5 billing sprint)
- [x] Surveys routes (`/routes/surveys.js`)
- [x] All routes tested with seed data

### Phase 6 — Cityworks Integration
- [ ] CW integration service (`/services/cityworks.js`)
  - [ ] `createFailureSR()`
  - [ ] `createRepairWO()`
  - [ ] `closeSRandWO()`
  - [ ] `createOverdueSR()`
  - [ ] `attachFileToCW()`
- [ ] CW sync queue worker (`/workers/cw-sync-worker.js`)
- [ ] CW setup routes (`/routes/cw-setup.js`)
  - [ ] Test connection endpoint
  - [ ] Auto-discovery endpoint
  - [ ] Configure endpoint
  - [ ] Staging test endpoint
- [ ] CW sync tested end-to-end against a real CW instance

### Phase 7 — Notification Engine
- [ ] Notification service (`/services/notifications.js`)
- [ ] Email templates created (all 10 types)
- [ ] Reminder scheduler (`/workers/reminder-scheduler.js`)
- [ ] Violations worker (`/workers/violations-worker.js`)
- [ ] Postal mail generator (`/services/postal-mail.js`)
  - [ ] PDF letter generation (Puppeteer)
  - [ ] Bulk PDF export
  - [ ] Lob.com API integration
- [ ] All workers registered and running locally

### Phase 8 — Frontend Admin Dashboard
- [x] Next.js routing structure set up (2025-05-13)
- [x] API client (`/lib/api.ts`) created (2025-05-13)
- [x] Auth pages (login, session management) (2025-05-13)
- [x] Dashboard home page (2025-05-13)
- [x] Device list page (2025-05-13)
- [x] Device detail page (2025-05-13)
- [x] Test reports page (2025-05-13)
- [x] Violations page (2025-05-13)
- [x] Testers page (2025-05-13)
- [x] Map view (ArcGIS) (2026-05-13)
- [x] Import wizard (4-step) (2026-05-13)
- [x] Settings page (2025-05-13)
- [x] PUBLIC tester portal (`/portal`) (2025-05-13)
- [x] Annual report generator page (2026-05-13)
- [x] Surveys page (2025-05-13)

### Phase 9 — USC List + Assembly Validation
- [ ] USC list downloader/importer (`/services/usc-list.js`)
- [ ] Monthly refresh worker (`/workers/usc-refresh-worker.js`)
- [ ] `validateAssembly()` function
- [ ] Assembly validation on device create/edit
- [ ] USC validation shown in import wizard
- [ ] Manual refresh endpoint

### Phase 10 — Azure Deployment
- [ ] All Azure resources created (see Deployment section above)
- [ ] Production env vars set in App Service Application Settings
- [ ] GitHub Actions `deploy.yml` created
- [ ] First successful deployment to Azure
- [ ] Custom domain configured (centriflow.centricitygis.com)
- [ ] SSL certificate active
- [ ] Production database migrations run
- [ ] Smoke test — can create org, login, create device

### Phase 11 — Onboarding Wizard + Internal Admin
- [ ] 7-step client onboarding wizard (`/onboarding`)
- [ ] Centricity internal admin panel (`/centricity-admin`)
  - [ ] Org list + provisioning
  - [ ] Billing dashboard
  - [ ] CW sync health monitor

### Phase 12 — First Client Launch
- [ ] Cedar Hills Water District (test org) set up
- [ ] Import wizard tested with real device data
- [ ] Tester portal tested with real tester
- [ ] Cityworks SR creation tested end-to-end
- [ ] Annual report generated successfully
- [ ] Email + SMS reminders verified
- [ ] First real paying client onboarded

---

## V2 BACKLOG (Build after first clients)

These are planned but not blocking launch:

- [ ] **Proposal Generator** — Centricity admin portal. Inputs: city name, state, population, device count. Outputs: formatted PDF proposal with competitor pricing comparison, CentriFlow tier recommendation, 5-yr TCO, fee revenue projections, state regulatory callouts. Goal: generate city-specific proposal in under 2 minutes. (Logged: 2025-05-13)
- [ ] State-specific annual report templates beyond CO + UT (add AZ, TX, CA)
- [ ] ABPA + ASSE credential verification API integration
- [ ] TX TCEQ license API verification
- [ ] Written cross-connection control program document generator
- [ ] Reclaimed/recycled water tracking (water_source_type on devices)
- [ ] Backflow contamination event log
- [ ] Installation permit tracking
- [ ] Customer tester booking marketplace
- [ ] HydroSoft-style managed program service tier (Centricity runs the program)
- [ ] Cross-org tester network (register once, work with any CentriFlow city)
- [ ] Public compliance lookup portal (bsionlinetracking.com competitor)
- [ ] SOC2 Type 2 certification process
- [ ] Mobile app (offline-capable React Native)

---

## KNOWN ISSUES & GOTCHAS

*Add to this section whenever you hit something unexpected. Check here before editing existing files.*

- PostgreSQL with PostGIS: always run `CREATE EXTENSION IF NOT EXISTS postgis;` and `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` on the database before migrations
- Azure App Service on Linux: build output must be in the app root, not a subdirectory. Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true` in App Service settings for Next.js
- Next.js App Router: server components can't use browser APIs (localStorage, window). Anything with `useState`/`useEffect` needs `"use client"` at the top
- Stripe webhooks: must use raw body parser for the webhook route, not `express.json()`. Set this up before the global JSON middleware
- Bull queues: Redis connection string for Azure Cache uses `rediss://` (with SSL) not `redis://`
- Puppeteer on Azure: install Chromium separately. Add `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and use `puppeteer-core` with `@sparticuz/chromium` for Azure compatibility
- PostGIS geometry: always store as SRID 4326 (WGS84 lat/lng). Use `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` for inserts
- Cityworks API: some CW instances are on-premise behind firewalls. For those clients, they'll need to whitelist the CentriFlow Azure outbound IP. Get Azure outbound IPs from App Service → Properties → Outbound IP addresses

---

## CONTACTS & RESOURCES

| Resource | URL / Info |
|----------|-----------|
| GitHub repo | github.com/ronaldo0501/centriflow-app |
| Azure portal | portal.azure.com → centriflow-rg |
| Stripe dashboard | dashboard.stripe.com |
| Resend dashboard | resend.com/emails |
| Twilio console | console.twilio.com |
| Lob.com dashboard | dashboard.lob.com |
| ESRI developer | developers.arcgis.com |
| USC FCCCHR list | fccchr.usc.edu |
| ABPA | abpa.org (West Jordan, UT — potential partner) |
| CentriFlow URL | centriflow.centricitygis.com |
| Centricity GIS | centricitygis.com |

---

## CHANGELOG

| Date | Version | Change |
|------|---------|--------|
| 2025-05-13 | 1.0.0 | Initial CLAUDE.md created. Full product spec locked in after extensive design sessions. |
| 2025-05-13 | 1.0.1 | Domain updated — no standalone domain purchase. CentriFlow will run as centriflow.centricitygis.com subdomain of existing Centricity GIS domain. Client subdomains will be antioch.centriflow.centricitygis.com pattern. Custom domain setup section rewritten accordingly. |
| 2025-05-13 | 1.0.2 | Added full dual-mode org resolver middleware architecture [LOCKED]. Starts in Mode 1 (single URL, org from JWT/header). Flips to Mode 2 (client subdomains) via ORG_SUBDOMAIN_MODE env var — zero code changes. Full orgResolver.js implementation included with in-memory cache, registration order, and frontend header pattern. Added ORG_SUBDOMAIN_MODE + BASE_DOMAIN to env vars. |
| 2026-05-13 | 1.0.3 | Added required CLAUDE.md prefix and DEVELOPMENT COMMANDS section with local dev, database bootstrap, and environment file setup instructions. |
| 2026-05-13 | 1.0.4 | Replaced Resend with SendGrid (existing Centricity account). Marked Twilio and SendGrid as complete in Phase 0 checklist. |
| 2026-05-13 | 1.0.5 | Phase 8 complete — full Next.js frontend built: login, dashboard, devices list+detail, test reports, violations, testers, surveys, fees, settings, and public tester portal. All pages compile cleanly. Map view, import wizard, and annual report page deferred. |
| 2026-05-13 | 1.0.6 | Phase 8 fully complete — added ArcGIS map view, 4-step CSV import wizard (with client-side validation, preview, drag-and-drop), and annual report page (stats, compliance charts, CSV/PDF export). Annual report API route added to backend. All 17 frontend routes build clean. |

*Claude Code: update this table after every significant session with a one-line summary of what was built.*

---

*End of CLAUDE.md — Version 1.0.0*
*This file is the source of truth for CentriFlow. Keep it updated.*
