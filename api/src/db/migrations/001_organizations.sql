CREATE TABLE IF NOT EXISTS organizations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      VARCHAR(255) NOT NULL,
  slug                      VARCHAR(100) UNIQUE NOT NULL,
  state                     CHAR(2) NOT NULL,
  timezone                  VARCHAR(50) NOT NULL DEFAULT 'America/Denver',
  plan_tier                 VARCHAR(20) NOT NULL DEFAULT 'starter',
  device_limit              INTEGER,
  cw_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
  cw_base_url               VARCHAR(500),
  cw_domain                 VARCHAR(100),
  cw_sync_mode              VARCHAR(20),
  cw_sr_problem_sid         VARCHAR(100),
  cw_wo_template_sid        VARCHAR(100),
  fee_config                JSONB NOT NULL DEFAULT '{
    "annual_program_fee":   {"enabled": false, "amount": 75.00, "billing_cycle": "annual"},
    "retest_fee":           {"enabled": false, "amount": 95.00, "waive_first_occurrence": true},
    "noncompliance_fee":    {"enabled": false, "tiers": [
      {"days_overdue": 30, "amount": 100.00},
      {"days_overdue": 60, "amount": 250.00},
      {"days_overdue": 90, "amount": 500.00}
    ]},
    "failure_penalty_fee":  {"enabled": false, "amount": 50.00, "legal_confirmed": false},
    "tester_per_test_fee":  {"enabled": false, "amount": 10.00},
    "centriflow_platform_fee": {"amount": 2.50}
  }',
  org_settings              JSONB NOT NULL DEFAULT '{}',
  stripe_customer_id        VARCHAR(100),
  stripe_connect_account_id VARCHAR(100),
  status                    VARCHAR(20) NOT NULL DEFAULT 'onboarding',
  approved_list_sources     TEXT[] NOT NULL DEFAULT ARRAY['usc'],
  lob_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
