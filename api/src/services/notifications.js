'use strict';

const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'centriflow@centricitygis.com';
const TEMPLATES_DIR = path.join(__dirname, '../templates/email');

// ---------------------------------------------------------------------------
// Winston logger (fall back to console if not available)
// ---------------------------------------------------------------------------

let logger;
try {
  logger = require('winston').createLogger({
    level: 'info',
    format: require('winston').format.combine(
      require('winston').format.timestamp(),
      require('winston').format.json()
    ),
    transports: [new require('winston').transports.Console()],
  });
} catch (_) {
  logger = {
    info: (...a) => console.log('[notifications]', ...a),
    warn: (...a) => console.warn('[notifications]', ...a),
    error: (...a) => console.error('[notifications]', ...a),
  };
}

// ---------------------------------------------------------------------------
// Template loader
// ---------------------------------------------------------------------------

/**
 * Load an HTML email template and replace all {{key}} placeholders.
 * @param {string} templateName  Filename without extension, e.g. 'test-due'
 * @param {Object} vars          Key/value map of placeholder values
 * @returns {string}             Rendered HTML
 */
const loadTemplate = (templateName, vars = {}) => {
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
  let html = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    const safeValue = value !== undefined && value !== null ? String(value) : '';
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue);
  }
  return html;
};

// ---------------------------------------------------------------------------
// Low-level send helpers
// ---------------------------------------------------------------------------

/**
 * Send an email via SendGrid and log the result to notifications_log.
 * Never throws — failures are logged and swallowed.
 */
const sendEmail = async ({ to, subject, html, orgId, deviceId = null, templateType }) => {
  let status = 'sent';
  try {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      html,
    });
    logger.info({ msg: 'Email sent', to, templateType, orgId });
  } catch (err) {
    status = 'failed';
    logger.error({ msg: 'SendGrid send failed', to, templateType, error: err.message });
  }

  // Always log — even on failure
  try {
    await query(
      `INSERT INTO notifications_log
         (org_id, device_id, recipient_email, channel, template_type, status, sent_at)
       VALUES ($1, $2, $3, 'email', $4, $5, NOW())`,
      [orgId, deviceId, to, templateType, status]
    );
  } catch (logErr) {
    logger.error({ msg: 'Failed to write notifications_log (email)', error: logErr.message });
  }
};

/**
 * Send an SMS via Twilio and log the result to notifications_log.
 * Never throws — failures are logged and swallowed.
 */
const sendSMS = async ({ to, body, orgId, deviceId = null, templateType }) => {
  let status = 'sent';
  try {
    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    logger.info({ msg: 'SMS sent', to, templateType, orgId });
  } catch (err) {
    status = 'failed';
    logger.error({ msg: 'Twilio send failed', to, templateType, error: err.message });
  }

  try {
    await query(
      `INSERT INTO notifications_log
         (org_id, device_id, recipient_phone, channel, template_type, status, sent_at)
       VALUES ($1, $2, $3, 'sms', $4, $5, NOW())`,
      [orgId, deviceId, to, templateType, status]
    );
  } catch (logErr) {
    logger.error({ msg: 'Failed to write notifications_log (sms)', error: logErr.message });
  }
};

// ---------------------------------------------------------------------------
// High-level notification functions
// ---------------------------------------------------------------------------

/**
 * Build the address string from a device/property record.
 * Expects device to have address_line1, city, state joined from properties.
 */
const formatAddress = (device) =>
  `${device.address_line1}, ${device.city}, ${device.state}`;

// ── Test Due Reminder ────────────────────────────────────────────────────────

const sendTestDueReminder = async ({ device, owner, org, daysUntilDue }) => {
  const vars = {
    owner_name: owner.owner_name || owner.name || 'Property Owner',
    tag_number: device.tag_number,
    address: formatAddress(device),
    assembly_type: device.assembly_type,
    size: device.size,
    due_date: device.next_test_due,
    days_until_due: daysUntilDue,
    org_name: org.name,
  };

  const html = loadTemplate('test-due', vars);
  const subject = `Action Required: Backflow Test Due in ${daysUntilDue} Days — Tag #${device.tag_number}`;

  const emailTo = owner.owner_email;
  if (emailTo) {
    await sendEmail({
      to: emailTo,
      subject,
      html,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_due',
    });
  }

  const phoneTo = owner.owner_phone;
  if (phoneTo) {
    const smsBody = `${org.name}: Your backflow assembly (Tag #${device.tag_number}) at ${device.address_line1} is due for testing in ${daysUntilDue} days (${device.next_test_due}). Please schedule with a certified tester.`;
    await sendSMS({
      to: phoneTo,
      body: smsBody,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_due',
    });
  }
};

// ── Test Overdue Reminder ────────────────────────────────────────────────────

const sendTestOverdueReminder = async ({ device, owner, org, daysOverdue }) => {
  const vars = {
    owner_name: owner.owner_name || owner.name || 'Property Owner',
    tag_number: device.tag_number,
    address: formatAddress(device),
    assembly_type: device.assembly_type,
    size: device.size,
    due_date: device.next_test_due,
    days_overdue: daysOverdue,
    org_name: org.name,
  };

  const html = loadTemplate('test-overdue', vars);
  const subject = `OVERDUE: Backflow Test Required — Tag #${device.tag_number} (${daysOverdue} Days Past Due)`;

  const emailTo = owner.owner_email;
  if (emailTo) {
    await sendEmail({
      to: emailTo,
      subject,
      html,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_overdue',
    });
  }

  const phoneTo = owner.owner_phone;
  if (phoneTo) {
    const smsBody = `URGENT — ${org.name}: Your backflow assembly (Tag #${device.tag_number}) at ${device.address_line1} is ${daysOverdue} days OVERDUE. Schedule testing immediately to avoid violation fees.`;
    await sendSMS({
      to: phoneTo,
      body: smsBody,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_overdue',
    });
  }
};

// ── Test Failed Notice ───────────────────────────────────────────────────────

const sendTestFailedNotice = async ({ device, owner, org, testReport, tester, complianceDeadline }) => {
  const vars = {
    owner_name: owner.owner_name || owner.name || 'Property Owner',
    tag_number: device.tag_number,
    address: formatAddress(device),
    assembly_type: device.assembly_type,
    size: device.size,
    test_date: testReport.test_date,
    tester_name: tester.name,
    compliance_deadline: complianceDeadline,
    org_name: org.name,
  };

  const html = loadTemplate('test-failed', vars);
  const subject = `FAILED: Backflow Test — Repair Required by ${complianceDeadline} — Tag #${device.tag_number}`;

  const emailTo = owner.owner_email;
  if (emailTo) {
    await sendEmail({
      to: emailTo,
      subject,
      html,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_failed',
    });
  }

  const phoneTo = owner.owner_phone;
  if (phoneTo) {
    const smsBody = `${org.name}: Backflow assembly (Tag #${device.tag_number}) at ${device.address_line1} FAILED its test on ${testReport.test_date}. Repair and retest required by ${complianceDeadline}.`;
    await sendSMS({
      to: phoneTo,
      body: smsBody,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_failed',
    });
  }
};

// ── Test Submitted Confirmation ──────────────────────────────────────────────

const sendTestSubmittedConfirmation = async ({ device, owner, org, testReport, tester }) => {
  const vars = {
    owner_name: owner.owner_name || owner.name || 'Property Owner',
    tag_number: device.tag_number,
    address: formatAddress(device),
    result: testReport.result ? testReport.result.toUpperCase() : 'SUBMITTED',
    test_date: testReport.test_date,
    tester_name: tester.name,
    org_name: org.name,
  };

  const html = loadTemplate('test-submitted', vars);
  const subject = `Test Report Received — Tag #${device.tag_number}`;

  const emailTo = owner.owner_email;
  if (emailTo) {
    await sendEmail({
      to: emailTo,
      subject,
      html,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'test_submitted',
    });
  }
  // SMS not sent for confirmation — email only
};

// ── Violation Notice ─────────────────────────────────────────────────────────

const sendViolationNotice = async ({ device, owner, org, violation }) => {
  const violationTypeLabel = {
    overdue: 'Overdue Annual Test',
    failed_test: 'Failed Test — No Retest Submitted',
    no_tester: 'No Certified Tester on Record',
  }[violation.violation_type] || violation.violation_type;

  const vars = {
    owner_name: owner.owner_name || owner.name || 'Property Owner',
    tag_number: device.tag_number,
    address: formatAddress(device),
    violation_type: violationTypeLabel,
    issued_date: violation.issued_date,
    compliance_deadline: violation.compliance_deadline,
    org_name: org.name,
  };

  const html = loadTemplate('violation-notice', vars);
  const subject = `OFFICIAL NOTICE: Backflow Compliance Violation — Tag #${device.tag_number}`;

  const emailTo = owner.owner_email;
  if (emailTo) {
    await sendEmail({
      to: emailTo,
      subject,
      html,
      orgId: org.id,
      deviceId: device.id,
      templateType: 'violation_notice',
    });
  }
};

// ── Tester Approved ──────────────────────────────────────────────────────────

const sendTesterApproved = async ({ tester, org }) => {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/portal`
    : 'https://centriflow.centricitygis.com/portal';

  const vars = {
    tester_name: tester.name,
    org_name: org.name,
    portal_url: portalUrl,
  };

  const html = loadTemplate('tester-approved', vars);
  const subject = `You're Approved — ${org.name} Tester Portal Access`;

  if (tester.email) {
    await sendEmail({
      to: tester.email,
      subject,
      html,
      orgId: org.id,
      deviceId: null,
      templateType: 'tester_approved',
    });
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadTemplate,
  sendEmail,
  sendSMS,
  sendTestDueReminder,
  sendTestOverdueReminder,
  sendTestFailedNotice,
  sendTestSubmittedConfirmation,
  sendViolationNotice,
  sendTesterApproved,
};
