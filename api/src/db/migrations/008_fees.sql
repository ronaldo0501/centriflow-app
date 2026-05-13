CREATE TABLE IF NOT EXISTS fees (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id                UUID REFERENCES devices(id),
  test_report_id           UUID REFERENCES test_reports(id),
  violation_id             UUID REFERENCES violations(id),
  fee_type                 VARCHAR(30) NOT NULL,
  fee_payer                VARCHAR(20) NOT NULL DEFAULT 'property_owner',
  amount                   DECIMAL(10,2) NOT NULL,
  platform_fee             DECIMAL(10,2) DEFAULT 2.50,
  status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(200),
  stripe_invoice_id        VARCHAR(200),
  stripe_checkout_url      VARCHAR(500),
  due_date                 DATE,
  paid_at                  TIMESTAMPTZ,
  waived_by                UUID REFERENCES users(id),
  waive_reason             TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(org_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_fees_device ON fees(device_id);
