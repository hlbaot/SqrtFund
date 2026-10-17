// Design preview only: no environment credentials, delivery or database access.
import { randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildVerificationEmail } from '../src/lib/verify/emailTemplate.ts';
const destination = new URL('../docs/previews/student-verification.html', import.meta.url);
const illustrativeCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
const { html } = buildVerificationEmail(illustrativeCode);
await mkdir(new URL('.', destination), { recursive: true });
await writeFile(destination, '<!-- Design preview only. The illustrated code cannot verify an account. -->\n' + html);
console.log(`Email design preview: ${fileURLToPath(destination)}`);
