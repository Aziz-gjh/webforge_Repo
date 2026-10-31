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
  // Ids, names and trip lengths must match src/content.ts: the frontend shows a destination
  // only when its id is here, and the rules check a booking's siteName/tripLength against it.
  // Keep every tripLength at 3 or less (the rules check each hour lock one by one).
  const sites = {
    'elephant-rock': { name: 'Elephant Rock', tripLength: 1, image: '/img/elephant-card.webp',
      blurb: 'A huge rock shaped like an elephant. Best in the late afternoon.' },
    'hegra': { name: 'Hegra', tripLength: 2, image: '/img/hegra.webp',
      blurb: "Nabataean tombs cut into rock. Saudi Arabia's first UNESCO site." },
    'turaif': { name: 'At-Turaif', tripLength: 2, image: '/img/turaif.webp',
      blurb: 'The historic mud-brick district of Diriyah.' },
    'edge': { name: 'Edge of the World', tripLength: 3, image: '/img/edge.webp',
      blurb: 'Tuwaiq cliffs with an open view over the plain.' },
    'balad': { name: 'Al-Balad', tripLength: 1, image: '/img/balad.webp',
      blurb: 'Old Jeddah, with its coral-stone houses and wooden balconies.' },
    'rijal': { name: 'Rijal Almaa', tripLength: 2, image: '/img/rijal.webp',
      blurb: 'A stone village in the mountains of Asir.' },
    'disah': { name: 'Wadi Al-Disah', tripLength: 3, image: '/img/disah.webp',
      blurb: 'A canyon of tall rock pillars with palms and springs.' },
    'soudah': { name: 'Al-Soudah', tripLength: 2, image: '/img/soudah.webp',
      blurb: 'The highest mountains in the Kingdom, cool and green.' },
    'farasan': { name: 'Farasan Islands', tripLength: 3, image: '/img/farasan.webp',
      blurb: 'Red Sea islands with clear water and quiet beaches.' },
    'ahsa': { name: 'Al-Ahsa Oasis', tripLength: 2, image: '/img/ahsa.webp',
      blurb: 'One of the largest palm oases in the world.' },
    'qarah': { name: 'Jabal Qarah', tripLength: 1, image: '/img/qarah.webp',
      blurb: 'Caves and rock passages that stay cool all year.' },
    'habala': { name: 'Habala', tripLength: 2, image: '/img/habala.webp',
      blurb: 'A cliffside village you reach by cable car.' },
  };
  for (const [id, site] of Object.entries(sites)) await put(`sites/${id}`, site);
  await put('settings/schedule', { openHour: 6, closeHour: 19, windowDays: 7 });
}
