// InfraPulse HTML email templates. Table-based layout with inline styles for broad email-client support.
const TEAL = '#0fb5ae';
const NAVY = '#0b1f3a';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STATUS_COLORS = {
  Submitted: { bg: '#e0f7f6', fg: '#0a7f7a' },
  Verified: { bg: '#e0f0ff', fg: '#1c5cab' },
  Assigned: { bg: '#efe9ff', fg: '#4a3aa7' },
  'In Progress': { bg: '#fff3d6', fg: '#9a6400' },
  Resolved: { bg: '#dcf5e2', fg: '#12722a' },
};

function shell({ preheader, heading, intro, report, status, footerNote }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.Submitted;
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e6edf3;font-size:13px;color:#5b6b7f;width:38%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e6edf3;font-size:15px;color:${NAVY};font-weight:600;vertical-align:top;">${value}</td>
    </tr>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f7fa;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${NAVY};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7fa;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dfe8ef;">
        <tr>
          <td style="background-color:${TEAL};padding:26px 28px;">
            <div style="font-size:26px;font-weight:800;letter-spacing:.3px;color:#ffffff;">InfraPulse</div>
            <div style="font-size:13px;color:#e6fffd;margin-top:2px;">Improving infrastructure, improving lives</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px 28px;">
            <h1 style="margin:0 0 12px 0;font-size:21px;line-height:1.3;color:${NAVY};">${esc(heading)}</h1>
            <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:${NAVY};">Hello,</p>
            <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:${NAVY};">${intro}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 4px 28px;">
            <div style="background:#f3fbfb;border:1px solid #cdeeed;border-radius:12px;padding:16px 18px;margin:12px 0 4px 0;text-align:center;">
              <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#0a7f7a;font-weight:700;">Report Reference</div>
              <div style="font-size:28px;font-weight:800;color:${NAVY};letter-spacing:1px;margin-top:4px;">${esc(report.id)}</div>
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
              ${row('Category', esc(report.category))}
              ${row('Location', esc(report.location))}
              ${row(
                'Current Status',
                `<span style="display:inline-block;background:${colors.bg};color:${colors.fg};border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700;">${esc(status)}</span>`,
              )}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 26px 28px;">
            <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:${NAVY};">${footerNote}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#5b6b7f;">Keep your reference number to identify this report.</p>
          </td>
        </tr>
        <tr>
          <td style="background:${NAVY};padding:18px 28px;">
            <div style="font-size:15px;font-weight:700;color:#ffffff;">InfraPulse</div>
            <div style="font-size:12px;color:#9fb3c8;margin-top:2px;">Improving infrastructure, improving lives</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderConfirmation(report) {
  return {
    subject: `InfraPulse | Report Received – ${report.id}`,
    html: shell({
      preheader: `InfraPulse has received your report ${report.id}.`,
      heading: 'We have received your report',
      intro:
        'Thank you for helping improve infrastructure in our community.<br />InfraPulse has successfully received your report.',
      report,
      status: 'Submitted',
      footerNote: 'Your report has been recorded and can now be reviewed by the maintenance team.',
    }),
    text: [
      'Hello,',
      '',
      'Thank you for helping improve infrastructure in our community.',
      'InfraPulse has successfully received your report.',
      '',
      `Report Reference: ${report.id}`,
      `Category: ${report.category}`,
      `Location: ${report.location}`,
      'Current Status: Submitted',
      '',
      'Your report has been recorded and can now be reviewed by the maintenance team.',
      'Keep your reference number to identify this report.',
      '',
      'InfraPulse',
      'Improving infrastructure, improving lives',
    ].join('\n'),
  };
}

const UPDATE_COPY = {
  Verified: 'Your report has been verified by the InfraPulse team.',
  Assigned: 'A maintenance technician has been assigned to your report.',
  'In Progress': 'Maintenance work on your report is now under way.',
  Resolved: 'The reported issue has been repaired and verified. Thank you for helping us keep the city moving.',
};

export function renderUpdate(report, status) {
  const line = UPDATE_COPY[status] || 'The status of your report has changed.';
  return {
    subject: `InfraPulse | Report Update – ${report.id} is now ${status}`,
    html: shell({
      preheader: `${report.id} is now ${status}.`,
      heading: `Your report is now ${status}`,
      intro: esc(line),
      report,
      status,
      footerNote: 'You can follow the progress of this report at any time from Report History.',
    }),
    text: `Hello,\n\n${line}\n\nReport Reference: ${report.id}\nCategory: ${report.category}\nLocation: ${report.location}\nCurrent Status: ${status}\n\nInfraPulse\nImproving infrastructure, improving lives`,
  };
}
