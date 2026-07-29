// Tuottaa entiteettikuvien versioidut johdannaiset gitignoroidusta lähteestä.
// Sisar tiedostolle luo-johdannaiset.mjs (kartat) — sama muuttumattomuussääntö:
// olemassa olevaa versioitua avainta EI koskaan ylikirjoiteta, koska sen URL on
// immutable-välimuistissa (netlify.toml, /entities/*).
//
// Lähde:  entities/_lahde/<entiteetin-id>/<rooli>.png|.webp   (ei repoon)
// Kohde:  entities/<entiteetin-id>/<rooli>-v<n>.webp
//         entities/<entiteetin-id>/<rooli>-thumb-v<n>.webp
//
// Käyttö: npm run entiteettikuvat
import { readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

/** Mitat johdettu näkymien säiliöistä 2x-näytöillä; säädä tästä yhdestä paikasta. */
export const JOHDANNAISET = [
  { jalkiliite: '', sivu: 1200, laatu: 80, maxKt: 300 },
  { jalkiliite: '-thumb', sivu: 512, laatu: 75, maxKt: 120 },
];

const LAHDEPAATTEET = ['.png', '.webp'];

/**
 * Entiteetin id ja rooli avaimessa: sama muoto kuin ytimen skeemassa. Windows on
 * kirjainkoon säilyttävä mutta sen suhteen tunteeton, joten eksynyt iso kirjain ei
 * näy paikallisesti mitenkään — mutta ydin hylkää avaimen. Tarkistus siis tässä,
 * lähimpänä virhettä.
 */
const ID_MUOTO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MUOTO_OHJE = 'pienet kirjaimet, numerot ja väliviivat (ei ääkkösiä, alaviivoja tai välilyöntejä)';

/**
 * @param {object} o
 * @param {string} o.lahdeJuuri   kansio, jonka alla <id>/<rooli>.png
 * @param {string} o.kohdeJuuri   kansio, jonka alle <id>/<rooli>-v<n>.webp
 * @param {number} [o.versio]     avaimen versionumero (oletus 1)
 * @param {Array}  [o.johdannaiset]
 * @returns {Promise<{luotu:string[], ohitettu:string[], ylitykset:string[], viat:string[]}>}
 */
export async function luoEntiteettikuvat({ lahdeJuuri, kohdeJuuri, versio = 1, johdannaiset = JOHDANNAISET }) {
  const luotu = [];
  const ohitettu = [];
  const ylitykset = [];
  const viat = [];
  if (!existsSync(lahdeJuuri)) return { luotu, ohitettu, ylitykset, viat };

  for (const id of await readdir(lahdeJuuri)) {
    const lahdeKansio = join(lahdeJuuri, id);
    if (!(await stat(lahdeKansio)).isDirectory()) continue;
    if (!ID_MUOTO.test(id)) {
      viat.push(`${id}/: kelvoton entiteetti-id — ${MUOTO_OHJE}`);
      continue;
    }

    // Erä ei saa kaatua yhteen vialliseen tiedostoon eikä vaieta tyhjästä kansiosta:
    // molemmat päätyvät viat-listaan nimettyinä, ja käsittely jatkuu seuraavaan.
    let loytyiLahde = false;
    for (const tiedosto of await readdir(lahdeKansio)) {
      const paate = extname(tiedosto).toLowerCase();
      if (!LAHDEPAATTEET.includes(paate)) continue;
      loytyiLahde = true;
      const rooli = basename(tiedosto, paate);
      if (!ID_MUOTO.test(rooli)) {
        viat.push(`${id}/${tiedosto}: kelvoton rooli — ${MUOTO_OHJE}`);
        continue;
      }

      for (const j of johdannaiset) {
        const avain = `${id}/${rooli}${j.jalkiliite}-v${versio}.webp`;
        const kohde = join(kohdeJuuri, avain);
        if (existsSync(kohde)) {
          ohitettu.push(avain);
          continue;
        }
        await mkdir(join(kohdeJuuri, id), { recursive: true });
        try {
          await sharp(join(lahdeKansio, tiedosto))
            .resize({ width: j.sivu, height: j.sivu, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: j.laatu, alphaQuality: 100 })
            .toFile(kohde);
        } catch (virhe) {
          // Yksi vikailmoitus per viallinen lähde: loput johdannaiset kaatuisivat samaan
          // syyhyn, joten break eikä continue.
          viat.push(`${id}/${tiedosto}: viallinen tai tuntematon kuva (${virhe.message})`);
          break;
        }
        const kt = (await stat(kohde)).size / 1024;
        if (kt > j.maxKt) ylitykset.push(`${avain}: ${kt.toFixed(0)} kt > ${j.maxKt} kt`);
        luotu.push(avain);
      }
    }
    if (!loytyiLahde) {
      viat.push(`${id}/: ei käyttökelpoista lähdekuvaa (odotettiin ${LAHDEPAATTEET.join(' tai ')})`);
    }
  }
  return { luotu, ohitettu, ylitykset, viat };
}

// CLI-kuori: ajetaan vain suoraan, ei tuotaessa testistä.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const entities = fileURLToPath(new URL('../entities/', import.meta.url));
  const { luotu, ohitettu, ylitykset, viat } = await luoEntiteettikuvat({
    lahdeJuuri: join(entities, '_lahde'),
    kohdeJuuri: entities,
  });
  for (const a of luotu) console.log(`  + entities/${a}`);
  for (const a of ohitettu) console.log(`  = entities/${a} (oli jo)`);
  for (const v of ylitykset) console.error(`  ! entities/${v}`);
  for (const v of viat) console.error(`  ! entities/${v}`);
  console.log(`Valmis: ${luotu.length} luotu, ${ohitettu.length} ohitettu.`);
  process.exit(ylitykset.length || viat.length ? 1 : 0);
}
