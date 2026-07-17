// Käyttö: node tools/pakkaa.mjs <lahde> <kohde> [--sivu N] [--laatu Q]
//   --sivu  : pisin sivu pikseleinä (ei suurenna); ilman → vain uudelleenpakkaus
//   --laatu : webp-laatu, oletus 78
// Sama lahde ja kohde sallitaan: kirjoitetaan .tmp-tiedostoon ja vaihdetaan.
import sharp from 'sharp';
import { parseArgs } from 'node:util';
import { readFile, rename, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { sivu: { type: 'string' }, laatu: { type: 'string', default: '78' } },
});
const [lahdeArg, kohdeArg] = positionals;
if (!lahdeArg || !kohdeArg) {
  console.error('Käyttö: node tools/pakkaa.mjs <lahde> <kohde> [--sivu N] [--laatu Q]');
  process.exit(1);
}
const lahde = resolve(lahdeArg);
const kohde = resolve(kohdeArg);
const kirjoitusKohde = lahde === kohde ? kohde + '.tmp' : kohde;

// Luetaan lähde puskuriin: Windows ei salli rename-korvausta, jos libvipsillä on
// tiedostokahva auki samaan tiedostoon (in-place-tila).
let putki = sharp(await readFile(lahde));
if (values.sivu) {
  const s = Number(values.sivu);
  putki = putki.resize({ width: s, height: s, fit: 'inside', withoutEnlargement: true });
}
await putki.webp({ quality: Number(values.laatu) }).toFile(kirjoitusKohde);
if (kirjoitusKohde !== kohde) {
  try {
    await rename(kirjoitusKohde, kohde);
  } catch (e) {
    await unlink(kirjoitusKohde).catch(() => {});
    throw e;
  }
}
const koko = (await stat(kohde)).size;
console.log(`${kohde}: ${(koko / 1024).toFixed(0)} kt`);
