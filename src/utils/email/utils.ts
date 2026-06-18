import { readFile } from 'fs/promises';
import pathlib from 'path';
import { mg } from './mailgun.js';
import type { MessagesSendResult } from 'mailgun.js/definitions';
import { generateMagicJWT } from '../auth/jwt.js';
const TEMPLATE_DIR = pathlib.join(import.meta.dirname, "templates");

async function loadTemplate(name: string): Promise<string | undefined> {
    return await readFile(pathlib.join(TEMPLATE_DIR, name), "utf-8").catch(_ => undefined);
}

function applyTemplateVariables(template: string, vars: Record<string, string>): string {
    return Object.keys(vars)
        .map(variable => [new RegExp(`\\{\\{\\s*?${variable}\\s*?\\}\\}`, "g"), vars[variable]!] as const)
        .reduce((template, args) => template.replaceAll(...args), template)
}


export async function sendMagicLink(userId: string, email: string): Promise<MessagesSendResult> {
    const templateVariables = { "LINK": `nowpower://register?id=${generateMagicJWT(userId, email)}` };
    const templateHTML = await loadTemplate("magic.html")
        .then(temp => applyTemplateVariables(temp!, templateVariables));
    const templateTXT = await loadTemplate("magic.txt")
        .then(temp => applyTemplateVariables(temp!, templateVariables));

    return await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
        from: process.env.MAILGUN_NOREPLY_EMAIL!,
        to: [email],
        subject: "Verify your account | Nowpower.app",
        text: templateTXT,
        html: templateHTML
    })
}