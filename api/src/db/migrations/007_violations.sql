CREATE TABLE IF NOT EXISTS violations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id           UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  test_report_id      UUID REFERENCES test_reports(id),
  violation_type      VARCHAR(30) NOT NULL,
  issued_date         DATE NOT NULL,
  compliance_deadline DATE NOT NULL,
  resolved_date       DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'open',
  notes               TEXT,
  waived_by           UUID REFERENCES users(id),
  waive_reason        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(org_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_violations_device ON violations(device_id);
