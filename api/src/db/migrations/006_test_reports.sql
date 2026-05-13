CREATE TABLE IF NOT EXISTS test_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id           UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tester_id           UUID NOT NULL REFERENCES certified_testers(id),
  test_date           DATE NOT NULL,
  test_event_type     VARCHAR(30) NOT NULL DEFAULT 'annual',
  reading_cv1_initial DECIMAL(6,2),
  reading_cv1_final   DECIMAL(6,2),
  reading_cv2_initial DECIMAL(6,2),
  reading_cv2_final   DECIMAL(6,2),
  reading_rv_opened   DECIMAL(6,2),
  reading_air_inlet   DECIMAL(6,2),
  result              VARCHAR(10) NOT NULL,
  repair_made         BOOLEAN NOT NULL DEFAULT FALSE,
  repair_description  TEXT,
  retest_required     BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_url             VARCHAR(500),
  photo_urls          JSONB NOT NULL DEFAULT '[]',
  notes               TEXT,
  cw_sr_id            VARCHAR(100),
  cw_sr_number        VARCHAR(50),
  cw_wo_id            VARCHAR(100),
  cw_wo_number        VARCHAR(50),
  cw_synced_at        TIMESTAMPTZ,
  cw_sync_status      VARCHAR(20) NOT NULL DEFAULT 'not_applicable',
  status              VARCHAR(20) NOT NULL DEFAULT 'submitted',
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_test_reports_device_date ON test_reports(device_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_test_reports_tester ON test_reports(tester_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_status ON test_reports(status);
