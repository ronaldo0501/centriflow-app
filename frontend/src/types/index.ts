export interface Device {
  id: string;
  org_id: string;
  property_id: string;
  tag_number: string;
  assembly_type: 'RP' | 'DC' | 'PVB' | 'SVB' | 'AG' | 'DCDA' | 'RPDA';
  size: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  hazard_classification: 'high' | 'low';
  service_type?: string;
  location_notes?: string;
  install_date?: string;
  last_test_date?: string;
  last_test_result: 'pass' | 'fail' | 'not_tested';
  next_test_due?: string;
  test_frequency_months: number;
  status: 'active' | 'inactive' | 'removed';
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface TestReport {
  id: string;
  device_id: string;
  tester_id: string;
  test_date: string;
  test_event_type: string;
  result: 'pass' | 'fail';
  repair_made: boolean;
  retest_required: boolean;
  pdf_url?: string;
  cw_sync_status: string;
  status: 'submitted' | 'reviewed' | 'accepted' | 'rejected';
  submitted_at: string;
  tag_number?: string;
  assembly_type?: string;
  address_line1?: string;
  city?: string;
  tester_name?: string;
  license_number?: string;
}

export interface Violation {
  id: string;
  org_id: string;
  device_id: string;
  violation_type: 'overdue' | 'failed_test' | 'no_tester';
  issued_date: string;
  compliance_deadline: string;
  resolved_date?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'waived';
  notes?: string;
  tag_number?: string;
  assembly_type?: string;
  address_line1?: string;
  city?: string;
  owner_name?: string;
  owner_email?: string;
}

export interface Tester {
  id: string;
  email: string;
  name: string;
  license_number: string;
  license_state: string;
  license_expiration: string;
  certifying_body?: string;
  company_name?: string;
  company_phone?: string;
  is_approved: boolean;
  is_verified: boolean;
  test_count: number;
}

export interface Survey {
  id: string;
  org_id: string;
  property_id?: string;
  survey_address?: string;
  survey_date: string;
  outcome: 'compliant' | 'noncompliant' | 'install_required' | 'followup';
  cross_connection_found?: boolean;
  hazard_level?: string;
  assembly_required?: boolean;
  recommended_type?: string;
  inspector_name?: string;
  address_line1?: string;
  city?: string;
  next_survey_due?: string;
}

export interface Fee {
  id: string;
  fee_type: string;
  fee_payer: string;
  amount: number;
  platform_fee: number;
  status: 'pending' | 'invoiced' | 'paid' | 'waived' | 'refunded';
  due_date?: string;
  paid_at?: string;
  tag_number?: string;
  address_line1?: string;
  owner_name?: string;
  owner_email?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'readonly';
}
