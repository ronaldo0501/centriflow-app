CREATE TABLE IF NOT EXISTS notifications_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id         UUID REFERENCES devices(id),
  recipient_email   VARCHAR(255),
  recipient_phone   VARCHAR(20),
  channel           VARCHAR(10) NOT NULL,
  template_type     VARCHAR(50) NOT NULL,
  lob_letter_id     VARCHAR(100),
  lob_delivery_date DATE,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            VARCHAR(20) NOT NULL DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications_log(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_device ON notifications_log(device_id);
