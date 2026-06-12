import nodemailer from 'nodemailer';
import { config } from '../config.js';

/**
 * Transactional email via the Launchpad-managed SMTP relay only (spec §4.4 — no
 * third-party email processor in the MVP). If SMTP isn't configured (e.g. local
 * dev), we log instead of sending so the flow never breaks.
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

/** Notify a manager that a direct report has self-submitted (spec §4.4). */
export async function sendManagerSubmissionEmail(params: {
  managerEmail: string;
  employeeName: string;
  assessmentId: string;
}): Promise<void> {
  const link = `${config.APP_BASE_URL}/manager/calibrate/${params.assessmentId}`;
  const subject = `AI Fluency Assessment — ${params.employeeName} has completed their self-assessment.`;
  const text = `${params.employeeName} has completed their AI Fluency self-assessment.\n\nOpen the conversation guide: ${link}`;

  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.info(`[notify:dev] would email ${params.managerEmail}: ${subject}`);
    return;
  }
  await t.sendMail({ from: config.SMTP_FROM, to: params.managerEmail, subject, text });
}
