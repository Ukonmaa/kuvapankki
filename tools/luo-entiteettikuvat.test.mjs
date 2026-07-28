// Testit käyttävät GENEROITUA fixture-kuvaa — taidetta ei koskaan committoida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { luoEntiteettikuvat } from './luo-entiteettikuvat.mjs';

// Windows: libvips pitää luetun tiedoston kahvan auki välimuistissaan, jolloin
// väliaikaishakemiston siivous kaatuu EPERM-virheeseen. Välimuisti pois → kahva
// vapautuu heti. Ei vaikuta työkaluun, vain testien siivoukseen.
sharp.cache(false);

/** Luo väliaikaisen työhakemiston ja siihen yhden alpha-lähteen entiteetille. */
async function pystyta(id = 'testiolento') {
  const juuri = mkdtempSync(join(tmpdir(), 'kuvapankki-'));
  const lahdeJuuri = join(juuri, '_lahde');
  const kohdeJuuri = join(juuri, 'ulos');
  mkdirSync(join(lahdeJuuri, id), { recursive: true });
  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } },
  })
    .png()
    .toFile(join(lahdeJuuri, id, 'paakuva.png'));
  return { juuri, lahdeJuuri, kohdeJuuri, id };
}

test('tuottaa paakuvan ja thumbin versioiduilla avaimilla', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri, id } = await pystyta();
  try {
    const tulos = await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    assert.equal(tulos.ylitykset.length, 0);
    assert.ok(existsSync(join(kohdeJuuri, id, 'paakuva-v1.webp')), 'paakuva-v1.webp puuttuu');
    assert.ok(existsSync(join(kohdeJuuri, id, 'paakuva-thumb-v1.webp')), 'paakuva-thumb-v1.webp puuttuu');
    assert.equal(tulos.luotu.length, 2);
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});

test('säilyttää läpinäkyvyyden', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri, id } = await pystyta();
  try {
    await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    const meta = await sharp(join(kohdeJuuri, id, 'paakuva-v1.webp')).metadata();
    assert.equal(meta.hasAlpha, true, 'alpha katosi johdannaisesta');
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});

test('ei ylikirjoita olemassa olevaa versioitua avainta', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri, id } = await pystyta();
  try {
    await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    const ennen = statSync(join(kohdeJuuri, id, 'paakuva-v1.webp')).mtimeMs;
    const toinen = await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    const jalkeen = statSync(join(kohdeJuuri, id, 'paakuva-v1.webp')).mtimeMs;
    assert.equal(ennen, jalkeen, 'olemassa oleva avain kirjoitettiin uudelleen');
    assert.equal(toinen.luotu.length, 0);
    assert.equal(toinen.ohitettu.length, 2);
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});

test('raportoi kokorajan ylityksen', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri } = await pystyta();
  try {
    const tulos = await luoEntiteettikuvat({
      lahdeJuuri,
      kohdeJuuri,
      johdannaiset: [{ jalkiliite: '', sivu: 1200, laatu: 80, maxKt: 0 }],
    });
    assert.equal(tulos.ylitykset.length, 1);
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});
