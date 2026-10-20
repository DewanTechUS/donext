import nodemailer from 'nodemailer';
import type { Config } from '../config.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  /** False when no email service is set up (emails are only logged). */
  enabled: boolean;
  send: (mail: Mail) => Promise<void>;
}

/**
 * SMTP mailer when SMTP_HOST is set; otherwise prints emails to the log so password
 * reset links still work in local development. In production without SMTP, reset
 * emails cannot be delivered, which is logged loudly at startup.
 */
export function createMailer(config: Config): Mailer {
  if (!config.SMTP_HOST) {
    if (config.NODE_ENV === 'production') {
      console.warn('WARNING: SMTP_HOST is not set — password reset emails will NOT be delivered.');
    }
    return {
      enabled: false,
      async send(mail) {
        if (config.NODE_ENV === 'production') {
          // Never write email bodies (e.g. reset links) to production logs.
          console.error(`Email not sent (SMTP not configured): "${mail.subject}"`);
        } else if (config.NODE_ENV !== 'test') {
          console.log(`\n[email → ${mail.to}] ${mail.subject}\n${mail.text}\n`);
        }
      },
    };
  }

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return {
    enabled: true,
    async send(mail) {
      await transport.sendMail({ from: config.MAIL_FROM, ...mail });
    },
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function listInviteEmail(inviterName: string, listName: string, appUrl: string): Omit<Mail, 'to'> {
  const subject = `${inviterName} invited you to “${listName}” on DoNext`;
  const text = [
    `${inviterName} invited you to the shared list “${listName}” on DoNext.`,
    '',
    `Log in (or sign up with this email address) to accept: ${appUrl}/lists`,
    '',
    '— DoNext',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="margin:0 0 12px;font-size:20px;color:#012360">You're invited to a shared list</h1>
    <p><strong>${escapeHtml(inviterName)}</strong> invited you to <strong>“${escapeHtml(listName)}”</strong> on DoNext.</p>
    <p style="margin:24px 0"><a href="${escapeHtml(appUrl)}/lists" style="background:#006fef;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">Open DoNext</a></p>
    <p style="font-size:14px;color:#475569">Log in — or sign up with this email address — and accept the invitation on the Shared lists page.</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">DoNext · the to-do list you can talk to</p>
  </div></body></html>`;
  return { subject, text, html };
}

export function listJoinedEmail(memberName: string, listName: string, appUrl: string): Omit<Mail, 'to'> {
  const subject = `${memberName} joined “${listName}” on DoNext`;
  const text = [
    `${memberName} accepted your invitation and joined the shared list “${listName}”.`,
    '',
    `Open your lists: ${appUrl}/lists`,
    '',
    '— DoNext',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="margin:0 0 12px;font-size:20px;color:#012360">Invitation accepted</h1>
    <p><strong>${escapeHtml(memberName)}</strong> joined your shared list <strong>“${escapeHtml(listName)}”</strong>.</p>
    <p style="margin:24px 0"><a href="${escapeHtml(appUrl)}/lists" style="background:#006fef;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">Open DoNext</a></p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">DoNext · the to-do list you can talk to</p>
  </div></body></html>`;
  return { subject, text, html };
}

export function passwordResetEmail(name: string, link: string, minutes: number): Omit<Mail, 'to'> {
  const subject = 'Reset your DoNext password';
  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset your DoNext password. Open this link to choose a new one:',
    link,
    '',
    `The link expires in ${minutes} minutes and can be used once.`,
    "If you didn't ask for this, you can ignore this email — your password won't change.",
    '',
    '— DoNext',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="margin:0 0 12px;font-size:20px;color:#012360">Reset your DoNext password</h1>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your password. Tap the button below to choose a new one.</p>
    <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#006fef;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">Choose a new password</a></p>
    <p style="font-size:14px;color:#475569">The link expires in ${minutes} minutes and can be used once. If you didn't ask for this, ignore this email — your password won't change.</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">DoNext · the to-do list you can talk to</p>
  </div></body></html>`;
  return { subject, text, html };
}
