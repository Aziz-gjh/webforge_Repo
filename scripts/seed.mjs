// Writes the starting data (Sites + Schedule settings) with the Firebase CLI's login, so nobody
// has to type it into the console. Admin access bypasses the rules, which forbid these writes.
//
//   firebase projects:list > /dev/null      # refreshes the CLI's access token
//   node scripts/seed.mjs <projectId>
//   node scripts/seed.mjs <projectId> provider <uid>   # make that account the Provider
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [projectId, cmd, uid] = process.argv.slice(2);
if (!projectId) throw new Error('usage: node scripts/seed.mjs <projectId> [provider <uid>]');

const store = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const token = store.tokens?.access_token;
if (!token) throw new Error('Not logged in: run `firebase login`');

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const toValue = v => typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v };
const toFields = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

async function put(path, data) {
  const res = await fetch(`${base}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  console.log('wrote', path);
}

if (cmd === 'provider') {
  if (!uid) throw new Error('usage: node scripts/seed.mjs <projectId> provider <uid>');
  await put(`providers/${uid}`, {});
} else {
  const sites = {
    'elephant-rock': { name: 'Elephant Rock', tripLength: 1, image: '/sites/elephant-rock.webp',
      blurb: 'A 52-metre sandstone giant shaped like an elephant, best seen as the sun drops behind it.' },
    'old-town': { name: 'AlUla Old Town', tripLength: 1, image: '/sites/old-town.webp',
      blurb: 'Walk the lanes of a mud-brick village lived in for 800 years, beneath its hilltop fort.' },
    'hegra': { name: 'Hegra', tripLength: 2, image: '/sites/hegra.webp',
      blurb: 'Saudi Arabia\'s first UNESCO World Heritage Site: over 100 Nabataean tombs carved into rock.' },
    'harrat-viewpoint': { name: 'Harrat Viewpoint', tripLength: 2, image: '/sites/harrat-viewpoint.webp',
      blurb: 'Drive up to the volcanic plateau for a sweeping view over the AlUla valley.' },
  };
  for (const [id, site] of Object.entries(sites)) await put(`sites/${id}`, site);
  await put('settings/schedule', { openHour: 6, closeHour: 19, windowDays: 7 });
}
