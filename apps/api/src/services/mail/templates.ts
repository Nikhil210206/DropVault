export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h2>${title}</h2>
  ${body}
  <p style="margin:24px 0">
    <a href="${cta.url}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta.label}</a>
  </p>
  <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${cta.url}</p>
  </body></html>`;
}

export function verificationEmail(url: string): MailContent {
  return {
    subject: 'Verify your DropVault email',
    html: layout('Confirm your email', '<p>Welcome to DropVault! Confirm your email to get started.</p>', {
      label: 'Verify email',
      url,
    }),
    text: `Welcome to DropVault! Verify your email: ${url}`,
  };
}

export function passwordResetEmail(url: string): MailContent {
  return {
    subject: 'Reset your DropVault password',
    html: layout(
      'Reset your password',
      '<p>We received a request to reset your password. This link expires in 1 hour. If you didn’t request it, ignore this email.</p>',
      { label: 'Reset password', url },
    ),
    text: `Reset your DropVault password (expires in 1 hour): ${url}`,
  };
}
