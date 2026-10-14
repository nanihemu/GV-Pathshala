import nodemailer from 'nodemailer';
import { brand } from '../config/brand';
import { env } from '../config/env';

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) {
    console.log(`[email, not sent: SMTP_URL is empty] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM ?? brand.defaultMailFrom, to, subject, text });
}
