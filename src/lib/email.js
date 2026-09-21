// Client for the InfraPulse email API. Never throws: if the server or SMTP is unavailable
// the email is simulated so report submission is never blocked.

export async function sendEmail({ type = 'confirmation', to, status, report }) {
  if (!to) return { sent: false, simulated: false, skipped: true };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, status, report }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data.ok && !data.simulated) return { sent: true, simulated: false, to };
    return { sent: false, simulated: true, to, reason: data.reason };
  } catch {
    return { sent: false, simulated: true, to, reason: 'Email service unreachable' };
  }
}

export const emailStatusMessage = (result) => {
  if (!result || result.skipped) return null;
  return result.sent
    ? `Confirmation email sent to ${result.to}.`
    : `Demo confirmation prepared for ${result.to}.`;
};
