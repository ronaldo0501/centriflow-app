CREATE TABLE IF NOT EXISTS certified_testers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  license_number      VARCHAR(100) NOT NULL,
  license_state       CHAR(2) NOT NULL,
  license_expiration  DATE NOT NULL,
  certifying_body     VARCHAR(100),
  certification_type  VARCHAR(20) NOT NULL DEFAULT 'general',
  company_name        VARCHAR(255),
  company_phone       VARCHAR(20),
  gauge_serial        VARCHAR(100),
  gauge_cal_date      DATE,
  gauge_cal_cert_url  VARCHAR(500),
  is_approved         BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  test_count          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testers_org ON certified_testers(org_id);
CREATE INDEX IF NOT EXISTS idx_testers_email ON certified_testers(email);
CREATE INDEX IF NOT EXISTS idx_testers_license ON certified_testers(license_number, license_state);
