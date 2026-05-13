CREATE TABLE IF NOT EXISTS properties (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  address_line1  VARCHAR(255) NOT NULL,
  city           VARCHAR(100) NOT NULL,
  state          CHAR(2) NOT NULL,
  zip            VARCHAR(10),
  parcel_id      VARCHAR(100),
  account_number VARCHAR(100),
  owner_name     VARCHAR(255),
  owner_email    VARCHAR(255),
  owner_phone    VARCHAR(20),
  geom           GEOMETRY(Point, 4326),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(org_id);
CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST(geom);
