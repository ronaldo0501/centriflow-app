CREATE TABLE IF NOT EXISTS assembly_approved_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_source     VARCHAR(20) NOT NULL,
  assembly_type   VARCHAR(10) NOT NULL,
  manufacturer    VARCHAR(100) NOT NULL,
  model_number    VARCHAR(100) NOT NULL,
  size            VARCHAR(20) NOT NULL,
  orientation     VARCHAR(50),
  approval_date   DATE,
  renewal_date    DATE,
  is_lead_free    BOOLEAN NOT NULL DEFAULT FALSE,
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,
  list_updated_at DATE NOT NULL,
  UNIQUE (list_source, assembly_type, manufacturer, model_number, size)
);

CREATE INDEX IF NOT EXISTS idx_assembly_lookup ON assembly_approved_models(
  list_source, assembly_type, LOWER(manufacturer), LOWER(model_number), size
) WHERE is_current = TRUE;
