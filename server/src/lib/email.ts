import nodemailer from 'nodemailer';
import { config } from '../config.js';

export type EmailResult = 'sent' | 'skipped' | 'failed';

const transport = config.smtpEnabled
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

/** Sends a plain-text email. Returns 'skipped' when SMTP is not configured — never pretends to send. */
export async function sendEmail(to: string | null | undefined, subject: string, body: string): Promise<EmailResult> {
  if (!transport || !to || config.isTest) return 'skipped';
  try {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, text: body });
    return 'sent';
  } catch (err) {
    console.error('[email] send failed:', (err as Error).message);
    return 'failed';
  }
}

export const emailEnabled = () => Boolean(transport);
