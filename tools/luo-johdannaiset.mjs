// Generoi jokaiselle maps/<id>-kansiolle pienet johdannaiset lähdekuvasta
// (kuva-v1.webp, tai kanvaasi-v1.webp jos kuvaa ei ole — interaktiivinen kartta).
// Versioitu avain on muuttumaton: olemassa olevaa johdannaista EI ylikirjoiteta.
// Kokoraja ylittyessä skripti päättyy virheeseen (exit 1) — säädä laatua käsin.
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const JOHDANNAISET = [
  { nimi: 'thumb-v1.webp', sivu: 512, laatu: 70, maxKt: 100 },
  { nimi: 'esikatselu-v1.webp', sivu: 2048, laatu: 78, maxKt: 900 },
];

const juuri = new URL('../maps/', import.meta.url);
let luotu = 0, ohitettu = 0, virheita = 0;

for (const kansio of await readdir(juuri)) {
  const polku = new URL(`${kansio}/`, juuri);
  const lahdeNimi = ['kuva-v1.webp', 'kanvaasi-v1.webp'].find((n) => existsSync(new URL(n, polku)));
  if (!lahdeNimi) { console.warn(`OHITUS ${kansio}: ei lähdekuvaa`); continue; }
  for (const j of JOHDANNAISET) {
    const kohde = new URL(j.nimi, polku);
    if (existsSync(kohde)) { ohitettu++; continue; }
    await sharp(fileURLToPath(new URL(lahdeNimi, polku)))
      .resize({ width: j.sivu, height: j.sivu, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: j.laatu })
      .toFile(fileURLToPath(kohde));
    const kt = (await stat(kohde)).size / 1024;
    const ok = kt <= j.maxKt;
    if (!ok) virheita++;
    console.log(`${ok ? ' ' : '!'} maps/${kansio}/${j.nimi}: ${kt.toFixed(0)} kt${ok ? '' : ` — YLITTÄÄ ${j.maxKt} kt rajan`}`);
    luotu++;
  }
}
console.log(`Valmis: ${luotu} luotu, ${ohitettu} ohitettu (oli jo).`);
process.exit(virheita ? 1 : 0);
