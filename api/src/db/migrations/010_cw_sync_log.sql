CREATE TABLE IF NOT EXISTS cw_sync_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type      VARCHAR(30) NOT NULL,
  entity_id        UUID NOT NULL,
  cw_object_type   VARCHAR(10),
  cw_object_id     VARCHAR(100),
  action           VARCHAR(20) NOT NULL,
  request_payload  JSONB,
  response_payload JSONB,
  status           VARCHAR(10) NOT NULL DEFAULT 'pending',
  error_message    TEXT,
  retry_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cw_sync_log_entity ON cw_sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cw_sync_log_org_status ON cw_sync_log(org_id, status);
