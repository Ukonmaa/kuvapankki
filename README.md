# Ukonmaan kuvapankki

Jaettu **kuva- ja tavuvarasto** koko Ukonmaa-järjestelmälle: karttapohjat, entiteettikuvat
ja sivustojen omat assetit. Läpileikkaava infrastruktuuri — **ei** hierarkian solmu
(ks. `Atlas/2-ATLAS-ARCHITECTURE.md` §5 ja `Master Architecture/0-MASTER-ARCHITECTURE.md`).

## Varasto

GitHub-kytketty **Netlify-site** (sama malli kuin ytimen julkaisu). Jokainen main-push
julkaisee tavut sellaisenaan; ei build-vaihetta. Varastopäätös tehty 2026-07-15
(pragmaattinen aloitus; R2-siirtymäpolku dokumentoitu Atlas §5.1).

## Avainmalli (versio avaimessa)

Kaikki viitteet ovat **versioituja avaimia** yhden base-URL:n alla. Sisältö ei koskaan
muutu saman URL:n alla — uusi versio on aina uusi avain:

```
maps/<karttaId>/kanvaasi-v<n>.webp     interaktiivisen kartan pohjakanvaasi
maps/<karttaId>/kuva-v<n>.webp          staattisen kartan kuva / kansikuva
maps/<karttaId>/tiles/…                 (myöhemmin, jos laatoitus tarvitaan)
entities/<slug>/<kuva>-v<n>.webp        MF-entiteettien kuvat (kuvat-kenttä viittaa tänne)
site/…                                  sivustojen ja UI:n omat assetit (ei lore-omistajaa)
```

- **Versiointi:** kun kuva muuttuu, nosta versionumeroa avaimessa (`-v1` → `-v2`) ja
  päivitä viittaava kohde. Vanha versio jää talteen, välimuisti pysyy immutablena.
- **Välimuisti:** `maps/`, `entities/`, `site/` tarjoillaan `immutable`, 1 v (`netlify.toml`).
- **CORS `*`:** kaikki kuluttajat saavat lukea.

## Nykyinen sisältö (2026-07-15, ensimmäinen erä)

Atlaksen 8 karttatiedostoa (aiemmin vain paikallisella levyllä, gitignorattu):

| Avain | Lähde | Rooli |
|-------|-------|-------|
| `maps/ukonmaa-paakartta/kanvaasi-v1.webp` | `ukonmaa-paakartta-kanvaasi.webp` | pääkartan interaktiivinen kanvaasi |
| `maps/ukonmaa-ja-rounanmaa-vedos/kuva-v1.webp` | `ukonmaa-ja-rounanmaa.webp` | maailmanvedos + pääkartan kansikuva |
| `maps/koilis-ikiruska/kuva-v1.webp` | `koilis-ikiruska.webp` | staattinen aluekartta |
| `maps/louhela/kuva-v1.webp` | `louhela.webp` | staattinen aluekartta |
| `maps/marajankylan-seutu/kuva-v1.webp` | `marajankylan-seutu.webp` | staattinen seutukartta |
| `maps/pohjankannel/kuva-v1.webp` | `pohjankannel.webp` | staattinen aluekartta |
| `maps/untamo/kuva-v1.webp` | `untamo.webp` | staattinen kaupunkikartta |
| `maps/vanha-valtakunta-ja-vellamo/kuva-v1.webp` | `vanha-valtakunta-ja-vellamo.webp` | staattinen historiakartta |

## Kuluttajat

- **Atlas** (`atlas-app`): `js/kuvapankki.js` (base + `kuvaUrl()`), `data/rekisteri.json`,
  `data/kartat/ukonmaa-paakartta.json` (`kanvaasi.variantit.*.asset`).
- **Karttaeditori** (`Interaktiivinen kartta`): `mapUrl` osoittaa tänne (Wix-CDN korvattu).
- **Myöhemmin:** `entities/` MF-entiteettikuville, `site/` ukonmaa-webin asseteille.

## Siirtymäsignaalit R2:een (Atlas §5.1)

Kuvapankki > ~1 Gt · Netlify-kaista (100 Gt/kk jaettu) lähestyy kattoa · peliassetit mukaan.

## Johdannaiset

Jokaisella kartalla on täyskuvan rinnalla pienet johdannaiset (generointi: `npm run johdannaiset`):

- `maps/<id>/thumb-v1.webp` — 512 px, q70, ≤ 100 kt (kortit/listat)
- `maps/<id>/esikatselu-v1.webp` — 2048 px, q78, ≤ 900 kt (herot, karttasivun ensipiirto, TARU-upotus)

Versioidut avaimet ovat muuttumattomia: generointi ei koskaan ylikirjoita olemassa olevaa
johdannaista. Uusi sisältö = uusi versionumero avaimeen (esim. `kanvaasi-v2.webp`).
