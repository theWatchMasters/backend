import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

/**
 * An instance of the Mailgun client
 */
export const mg: ReturnType<typeof mailgun.client> = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY!,
});
