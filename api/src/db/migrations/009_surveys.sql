CREATE TABLE IF NOT EXISTS surveys (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id             UUID REFERENCES properties(id),
  survey_address          VARCHAR(255),
  survey_date             DATE NOT NULL,
  inspector_id            UUID REFERENCES users(id),
  survey_method           VARCHAR(30),
  establishment_type      VARCHAR(50),
  cross_connection_found  BOOLEAN,
  hazard_level            VARCHAR(10),
  assembly_required       BOOLEAN,
  recommended_type        VARCHAR(10),
  recommended_size        VARCHAR(20),
  outcome                 VARCHAR(30),
  next_survey_due         DATE,
  resulting_device_id     UUID REFERENCES devices(id),
  notes                   TEXT,
  photos                  JSONB NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_org ON surveys(org_id);
CREATE INDEX IF NOT EXISTS idx_surveys_property ON surveys(property_id);
