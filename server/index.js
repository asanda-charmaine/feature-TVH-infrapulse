// InfraPulse API - a small companion server that sends citizen emails over SMTP.
// The app itself is fully client-side, so if this server or SMTP is unavailable the
// browser simulates the email and the demo carries on.
import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderConfirmation, renderUpdate } from './emailTemplate.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

const env = process.env;
const smtpConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_FROM_EMAIL);
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function createTransport() {
  const port = Number(env.SMTP_PORT || 587);
  const useTls = String(env.SMTP_USE_TLS ?? 'true').toLowerCase() !== 'false';
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
    requireTLS: useTls && port !== 465,
    auth: env.SMTP_USERNAME ? { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD } : undefined,
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, smtpConfigured: smtpConfigured() }));

// Browser preview of the email template: /api/email/preview?type=confirmation|update&status=Resolved
app.get('/api/email/preview', (req, res) => {
  const sample = {
    id: 'INF-2026-00421',
    category: 'Pothole / Road Damage',
    location: 'Pretorius Street, Pretoria CBD',
  };
  const { html } =
    req.query.type === 'update' ? renderUpdate(sample, String(req.query.status || 'Assigned')) : renderConfirmation(sample);
  res.type('html').send(html);
});

app.post('/api/email/send', async (req, res) => {
  const { to, type = 'confirmation', status, report } = req.body || {};
  if (!isEmail(to)) return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' });
  if (!report?.id) return res.status(400).json({ ok: false, error: 'Report details are required.' });

  const message = type === 'update' ? renderUpdate(report, status) : renderConfirmation(report);

  if (!smtpConfigured()) {
    return res.json({ ok: true, simulated: true, reason: 'SMTP is not configured', subject: message.subject });
  }
  try {
    await createTransport().sendMail({
      from: `"${env.SMTP_FROM_NAME || 'InfraPulse'}" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    res.json({ ok: true, simulated: false, subject: message.subject });
  } catch (err) {
    // Never block the citizen: report the failure, the client falls back to a demo confirmation.
    console.error('[email] send failed:', err.message);
    res.json({ ok: true, simulated: true, reason: `SMTP unavailable (${err.code || err.message})`, subject: message.subject });
  }
});

// Serve the production build when present (npm start).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(env.API_PORT || 8787);
app.listen(port, () => {
  console.log(`[api] InfraPulse API on http://localhost:${port}  (SMTP ${smtpConfigured() ? 'configured' : 'not configured - demo mode'})`);
});
