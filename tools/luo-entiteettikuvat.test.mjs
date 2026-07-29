// Testit käyttävät GENEROITUA fixture-kuvaa — taidetta ei koskaan committoida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { luoEntiteettikuvat } from './luo-entiteettikuvat.mjs';

// Windows: libvips pitää luetun tiedoston kahvan auki välimuistissaan, jolloin
// väliaikaishakemiston siivous kaatuu EPERM-virheeseen. Välimuisti pois → kahva
// vapautuu heti. Ei vaikuta työkaluun, vain testien siivoukseen.
sharp.cache(false);

/** Kirjoittaa polkuun pienen läpinäkyvän PNG-lähteen. */
async function luoLahdekuva(polku) {
  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } },
  })
    .png()
    .toFile(polku);
}

/** Luo väliaikaisen työhakemiston ilman entiteettejä. */
function pystytaJuuri() {
  const juuri = mkdtempSync(join(tmpdir(), 'kuvapankki-'));
  return { juuri, lahdeJuuri: join(juuri, '_lahde'), kohdeJuuri: join(juuri, 'ulos') };
}

/** Luo väliaikaisen työhakemiston ja siihen yhden alpha-lähteen entiteetille. */
async function pystyta(id = 'testiolento') {
  const { juuri, lahdeJuuri, kohdeJuuri } = pystytaJuuri();
  mkdirSync(join(lahdeJuuri, id), { recursive: true });
  await luoLahdekuva(join(lahdeJuuri, id, 'paakuva.png'));
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
    // Toissijainen paras-yritys -tarkistus: mtime-tarkkuus riittää vain koska webp-pakkaus
    // kestää tikin yli. Varsinainen tae ovat alla olevat luotu/ohitettu-väitteet, koska
    // existsSync-vartija on ennen kirjoitusta — ne eivät riipu kellon tarkkuudesta.
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

test('viallinen lähde ei keskeytä erää', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri } = pystytaJuuri();
  try {
    for (const id of ['aaa-ehja', 'zzz-ehja']) {
      mkdirSync(join(lahdeJuuri, id), { recursive: true });
      await luoLahdekuva(join(lahdeJuuri, id, 'paakuva.png'));
    }
    // Aakkosjärjestyksessä keskelle tekstitiedosto, joka teeskentelee PNG:tä.
    mkdirSync(join(lahdeJuuri, 'mmm-rikki'), { recursive: true });
    writeFileSync(join(lahdeJuuri, 'mmm-rikki', 'paakuva.png'), 'ei tama ole kuva');

    const tulos = await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    assert.ok(existsSync(join(kohdeJuuri, 'aaa-ehja', 'paakuva-v1.webp')), 'viallista edeltävä jäi tuottamatta');
    assert.ok(existsSync(join(kohdeJuuri, 'zzz-ehja', 'paakuva-v1.webp')), 'viallinen keskeytti erän');
    assert.equal(tulos.luotu.length, 4);
    assert.equal(tulos.viat.length, 1, 'yksi viallinen tiedosto = yksi vikailmoitus');
    assert.match(tulos.viat[0], /mmm-rikki/, 'vikailmoitus ei nimeä viallista tiedostoa');
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});

test('kelvoton entiteetti-id ohitetaan', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri } = pystytaJuuri();
  try {
    mkdirSync(join(lahdeJuuri, 'Kalmo'), { recursive: true });
    await luoLahdekuva(join(lahdeJuuri, 'Kalmo', 'paakuva.png'));

    const tulos = await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    assert.equal(tulos.luotu.length, 0, 'kelvottomasta id:stä ei saa syntyä avainta');
    assert.equal(tulos.viat.length, 1);
    assert.match(tulos.viat[0], /Kalmo/, 'vikailmoitus ei nimeä kelvotonta kansiota');
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});

test('tuntematon pääte raportoidaan eikä vaieta', async () => {
  const { juuri, lahdeJuuri, kohdeJuuri } = pystytaJuuri();
  try {
    mkdirSync(join(lahdeJuuri, 'psd-olento'), { recursive: true });
    writeFileSync(join(lahdeJuuri, 'psd-olento', 'kuva.psd'), 'psd-tavuja');

    const tulos = await luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri });
    assert.equal(tulos.luotu.length, 0);
    assert.equal(tulos.viat.length, 1, 'käyttökelpoisen lähteen puuttuminen on raportoitava');
    assert.match(tulos.viat[0], /psd-olento/, 'vikailmoitus ei nimeä kansiota');
  } finally {
    rmSync(juuri, { recursive: true, force: true });
  }
});
