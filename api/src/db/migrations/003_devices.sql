CREATE TABLE IF NOT EXISTS devices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tag_number            VARCHAR(50) NOT NULL,
  assembly_type         VARCHAR(10) NOT NULL,
  size                  VARCHAR(20) NOT NULL,
  manufacturer          VARCHAR(100),
  model_number          VARCHAR(100),
  serial_number         VARCHAR(100),
  hazard_classification VARCHAR(10) NOT NULL DEFAULT 'low',
  service_type          VARCHAR(30),
  location_notes        TEXT,
  install_date          DATE,
  last_test_date        DATE,
  last_test_result      VARCHAR(10) DEFAULT 'not_tested',
  next_test_due         DATE,
  test_frequency_months INTEGER NOT NULL DEFAULT 12,
  pending_test_event    VARCHAR(30),
  test_required_by      DATE,
  usc_approved          BOOLEAN DEFAULT NULL,
  is_lead_free          BOOLEAN DEFAULT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  geom                  GEOMETRY(Point, 4326),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, tag_number)
);

CREATE INDEX IF NOT EXISTS idx_devices_org_status ON devices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_next_due ON devices(next_test_due) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_devices_geom ON devices USING GIST(geom);
