import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { MailContent } from './templates';

export interface Mailer {
  send(to: string, content: MailContent): Promise<void>;
}

/** Local/dev + generic SMTP (points at Mailpit in docker-compose). */
class SmtpMailer implements Mailer {
  private readonly transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });

  async send(to: string, content: MailContent): Promise<void> {
    await this.transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    logger.info('Email sent (smtp)', { to, subject: content.subject });
  }
}

/** Production transactional email via Resend. */
class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(to: string, content: MailContent): Promise<void> {
    const { error } = await this.client.emails.send({
      from: env.MAIL_FROM,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    logger.info('Email sent (resend)', { to, subject: content.subject });
  }
}

function createMailer(): Mailer {
  if (env.MAIL_TRANSPORT === 'resend' && env.RESEND_API_KEY) {
    return new ResendMailer(env.RESEND_API_KEY);
  }
  return new SmtpMailer();
}

export const mailer: Mailer = createMailer();
