import { readFile } from 'fs/promises';
import pathlib from 'path';
import { mg } from './mailgun.js';
import type { MessagesSendResult } from 'mailgun.js/definitions';
import { generateMagicJWT } from '../auth/jwt.js';
import type { Readable } from 'stream';
const TEMPLATE_DIR = pathlib.join(import.meta.dirname, 'templates');

/**
 * Loads a template from the template directory and returns its content as a string.
 * If the template cannot be loaded (e.g., it does not exist), it returns undefined.
 * @param name The name of the template file to load (e.g., "magic.html").
 * @returns A promise that resolves to the content of the template as a string, or undefined if the template cannot be loaded.
 */
async function loadTemplate(name: string): Promise<string | undefined> {
  return await readFile(pathlib.join(TEMPLATE_DIR, name), 'utf-8').catch(
    (_) => undefined,
  );
}

/**
 * We use a rudimentary template engine for our email templates,
 * which simply replaces variables in the form of {{ VARIABLE_NAME }} with their corresponding values provided in an object.
 *
 * **Note that this function does not perform any escaping or sanitization, so it should only be used with trusted template content and variable values.**
 * @param template The template string
 * @param vars An object mapping variable names to their replacement values. Note that the variable names should not include the prefix `{{` and suffix `}}`
 * @returns The template string with all variables replaced by their corresponding values from the `vars` object.
 */
function applyTemplateVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return Object.keys(vars)
    .map(
      (variable) =>
        [
          new RegExp(`\\{\\{\\s*?${variable}\\s*?\\}\\}`, 'g'),
          vars[variable]!,
        ] as const,
    )
    .reduce((template, args) => template.replaceAll(...args), template);
}

/**
 * Sends a magic link to a user for login
 * @param userId The ID of the user
 * @param email The email of the user to send the magic link to
 * @param path The path to which the magic link should redirect to
 * @returns A promise that resolves to the result of the Mailgun API call to send the email, which includes information about the sent message.
 */
export async function sendMagicLink(
  userId: string,
  email: string,
  path: string,
): Promise<MessagesSendResult> {
  const templateVariables = {
    LINK: `${process.env.DOMAIN!}email/${path}?id=${generateMagicJWT(userId, email)}`,
  };
  const templateHTML = await loadTemplate('magic.html').then((temp) =>
    applyTemplateVariables(temp!, templateVariables),
  );
  const templateTXT = await loadTemplate('magic.txt').then((temp) =>
    applyTemplateVariables(temp!, templateVariables),
  );

  return await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
    from: process.env.MAILGUN_NOREPLY_EMAIL!,
    to: [email],
    subject: 'Verify your account | Nowpower.app',
    text: templateTXT,
    html: templateHTML,
  });
}

export async function sendDataExport(
  data: Readable,
  email: string,
): Promise<MessagesSendResult> {
  const templateVariables = {};
  const templateHTML = await loadTemplate('data.html').then((temp) =>
    applyTemplateVariables(temp!, templateVariables),
  );
  const templateTXT = await loadTemplate('data.txt').then((temp) =>
    applyTemplateVariables(temp!, templateVariables),
  );
  return await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
    from: process.env.MAILGUN_NOREPLY_EMAIL!,
    to: [email],
    subject: 'Your data export | Nowpower.app',
    text: templateTXT,
    html: templateHTML,
    attachment: {
      filename: `export-${+Date.now()}.json`,
      data,
    },
  });
}
