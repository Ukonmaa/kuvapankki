# 1B — MEDIA STORAGE ARCHITECTURE

**Ukonmaan mediavarasto: kuvapankki tänään, äänet ja videot huomenna**

> **Kehitystyön ohjaus: juuritason `ROADMAP.md`** (24.7.2026 alkaen) — seuraavat askeleet, tiekartta ja historia. Tämä dokumentti pysyy mediavaraston teknisenä totuutena.

| | |
|---|---|
| **Versio** | v0.1 (24.7.2026) |
| **Status** | Kuvapankki tuotannossa · ääni/video-linjaus pohdintana (ei toteutuspäätöstä) |
| **Numerointi** | 1B = ytimen (1A-MYTHOLOGIA-FEINNE) rinnalla elävä läpileikkaava infrastruktuuri |
| **Suhde muihin** | Tiivistää ja laajentaa: Atlas §5–5.2 (omistajuus, R2-polku, johdannaiset), Master §infrastruktuuri (v0.13), MF §3.9, `kuvapankki/README.md` |

---

## 1. Rooli järjestelmässä

Mediavarasto on **läpileikkaava infrastruktuuri, ei hierarkian solmu**. Hierarkia
(ydin → näkymät → teokset) kuvaa *loren* kulkua; kukaan ei lue lorea mediavarastosta —
se on **tavuvarasto**, johon eri omistajat viittaavat avaimilla.

Kaksi akselia, joita ei saa sekoittaa (Atlas §5):

```
LOOGINEN OMISTAJUUS (viite elää omistajan tietueessa)
  MF-entiteetti.kuvat      → muotokuvat, esineet, lore-kuvitus
  Atlas / kartta           → pohjakanvaasit, staattiset kartat, johdannaiset
  Sivusto / teos           → hero-kuvat, UI-grafiikka (ei lore-omistajaa)
  (tulevaisuudessa) teos   → äänet, videot, musiikki

FYYSINEN VARASTO (tavut + versiointi)
  YKSI jaettu mediavarasto ← kaikki yllä viittaavat tänne versioidulla avaimella
```

Omistaja säilöö vain **viitteen** (versioidun avaimen); tavut elävät varastossa.
"Encyclopedian kuvat" eivät ole oma kategoria — encyclopedia on näkymä MF:ään,
joten sen kuvat *ovat* MF-entiteettien kuvia.

---

## 2. Kuvapankki — toteutunut osa mediavarastoa

### 2.1 Fyysinen varasto

GitHub-repo **`Ukonmaa/kuvapankki`** → GitHub-kytketty Netlify-site
**`https://ukonmaa-kuvapankki.netlify.app`**. Sama malli kuin ytimen julkaisulla
(`mythologia-feinne.netlify.app`), mutta **ilman build-vaihetta**: jokainen main-push
julkaisee repon tavut sellaisenaan (`netlify.toml`: `publish = "."`, `command = ""`).
Pystytetty 15.7.2026 (tiekartan vaihe 4); samalla **Wix-CDN irrotettiin kokonaan**
Atlaksesta ja karttaeditorista (0 `wixstatic`-viitettä).

### 2.2 Avainmalli — versio avaimessa, immutable-välimuisti

Kaikki viitteet ovat **versioituja avaimia yhden base-URL:n alla**. Sisältö ei koskaan
muutu saman URL:n alla: uusi versio = uusi avain = uusi URL.

```
maps/<karttaId>/kanvaasi-v<n>.webp    interaktiivisen kartan pohjakanvaasi
maps/<karttaId>/kuva-v<n>.webp        staattisen kartan täyskuva / kansikuva
maps/<karttaId>/thumb-v<n>.webp       johdannainen: 512 px, q70, ≤ 100 kt (kortit, listat)
maps/<karttaId>/esikatselu-v<n>.webp  johdannainen: 2048 px, q78, ≤ 900 kt (herot, ensipiirto, TARU)
maps/<karttaId>/tiles/…               (varaus: laatoitus, jos tarvitaan)
entities/<slug>/<kuva>-v<n>.webp      MF-entiteettien kuvat (MF.kuvat viittaa tänne) — varaus
site/…                                sivustojen/UI:n omat assetit — varaus
```

Tästä seuraa suoraan välimuisti- ja CORS-politiikka (`netlify.toml`):
`maps/`, `entities/` ja `site/` tarjoillaan `Cache-Control: public, max-age=31536000,
immutable` ja `Access-Control-Allow-Origin: *` — kaikki kuluttajat saavat lukea,
ja selain saa pitää tavut vuoden, koska avaimen takana oleva sisältö ei ikinä vaihdu.

**Päivityskulku:** kun kuva muuttuu, nostetaan versionumeroa avaimessa (`-v1` → `-v2`),
lisätään uusi tiedosto ja päivitetään viittaava kohde (esim. Atlaksen karttadata).
Vanha versio jää talteen — vanhat julkaisut ja offline-paketit eivät hajoa.

### 2.3 Johdannaiset ja työkalut

Jokaisella kartalla on täyskuvan rinnalla pienet johdannaiset samassa nimiavaruudessa
(Atlas §5.2, toteutettu 17.7.2026). Generointi kuvapankki-repossa: `npm run
johdannaiset` → `tools/luo-johdannaiset.mjs` (sharp). Työkalu **ei koskaan ylikirjoita**
olemassa olevaa avainta (immutable-sääntö koskee myös johdannaisia) ja päättyy
virheeseen, jos kokoraja ylittyy. Karttasivut lataavat progressiivisesti: esikatselu
piirtyy heti, täysi kuva vaihdetaan taustalatauksen valmistuttua.

### 2.4 Kuluttajat ja base-URL-kytkentä

Kuluttaja liittää base-URL:n **ajossa** — avaimet datassa ovat varastoneutraaleja:

- **Atlas** (`atlas-app/js/kuvapankki.js`): `KUVAPANKKI_BASE` + `kuvaUrl(avain)`.
  Karttadata (`data/rekisteri.json`, `data/kartat/*.json`) sisältää vain avaimia.
- **Karttaeditori** (Interaktiivinen kartta): `mapUrl` osoittaa kuvapankkiin.
- **TARU-upotus** (`?embed=taru`): `KUVAPANKKI_BASE` vaihtuu paikalliseksi (`.`) —
  teokseen vendoroidaan vain johdannaiset ja käytössä oleva kanvaasiversio
  (`taru-app/scripts/vendor-views.mjs` suodattaa) → **0 ulkoista hakua** upotettuna.
- **Varaukset:** MF-entiteettikuvat (`entities/`), ukonmaa-web (`site/`).

Karttojen koordinaatti-JSON pysyy gitissä (diff/historia siellä missä se tuottaa
arvoa) ja viittaa kanvaasiin avaimella — versiointi ei katoa, se elää avaintasolla.

### 2.5 Nykytila lukuina (24.7.2026)

8 karttaa, 25 webp-tiedostoa, **~44 Mt** (`maps/`); `entities/` ja `site/` tyhjiä
varauksia. Netlifyn ilmaiskaista 100 Gt/kk on jaettu ytimen julkaisun ja tulevan
webin kanssa — nykyvolyymilla kaukana katosta.

---

## 3. Mediavaraston invariantit

Nämä periaatteet ovat **mediatyypistä ja varastoteknologiasta riippumattomia** — ne
pätevät kuville nyt ja äänille/videoille tulevaisuudessa. Tämä on dokumentin ydin:
*kaava* on pysyvä, *fyysinen varasto* on vaihdettava yksityiskohta.

1. **Versio avaimessa.** Julkaistu avain on muuttumaton; uusi sisältö = uusi avain.
2. **Immutable-välimuisti + CORS `*`** seuraavat suoraan invariantista 1.
3. **Base-URL liitetään ajossa.** Data säilöö avaimia, ei absoluuttisia URL:eja →
   varaston vaihto = yhden base-URL:n vaihto per sovellus.
4. **Omistajuus viitetasolla.** Tavuvarasto ei omista mitään; viite elää omistajan
   tietueessa (MF-entiteetti, karttadata, teos).
5. **Johdannaiset samaan nimiavaruuteen** täysversion rinnalle, generointi
   idempotenttina työkaluna joka ei ylikirjoita.
6. **Offline-paketointi vendoroimalla:** base-URL paikalliseksi, avaimet ennallaan.

---

## 4. Kapasiteetti ja R2-siirtymäpolku

Netlify-aloitus oli tietoinen pragmaattinen päätös (koko infra on jo Netlify+GitHub-
keskeinen, volyymi pieni). Kohdemalli on **objektivarasto** (ensisijaisesti Cloudflare
R2: nollaegress, kerros- ja kuluttajaneutraali, ei git-historian painolastia).

**Siirtymäsignaalit** (Atlas §5.1 — mikä tahansa näistä käynnistää siirron):

- kuvapankki kasvaa yli **~1 Gt** (git-repo + Netlify-deploy alkavat hidastua), tai
- Netlify-kaista (100 Gt/kk, jaettu) lähestyy kattoa, tai
- **peliassetit** tulevat mukaan.

Invarianttien ansiosta siirto on halpa: tavut kopioidaan samoilla avaimilla uuteen
varastoon ja jokaisesta kuluttajasta vaihdetaan yksi base-URL (Atlaksessa
`kuvapankki.js`:n `KUVAPANKKI_BASE`). Data ei muutu lainkaan.

---

## 5. Tulevaisuuspohdinta: videot ja äänet — sama kaava vai oma pankki?

> **Status: linjaus, ei toteutuspäätös.** Ääntä on jo olemassa tuotantolähteinä
> (Drive: `Ääni/Musiikki`, `Ääni/Äänikirjasto`), mutta mikään sovellus ei vielä
> jakele ääntä tai videota. Päätökset tehdään vasta ensimmäisen oikean tarpeen
> kohdalla (todennäköisin: TARU-teoksen äänimaisema tai lukuääni).

### 5.1 Vastaus kahdella tasolla

**Looginen taso — sama kaava, ehdottomasti.** Luvun 3 invariantit yleistyvät
sellaisinaan. Äänille ja videoille ei suunnitella uutta viittausmallia, vaan ne
liittyvät samaan avainmalliin omina juurinaan:

```
audio/<slug>/<nimi>-v<n>.{mp3|opus|m4a}     musiikki, äänimaisemat, lukuääni
video/<slug>/<nimi>-v<n>.{mp4|webm}         videotavut (jos itse isännöidään)
```

Johdannaiskonventio yleistyy myös: kuvan `thumb`/`esikatselu` vastine on äänellä
esim. bitrate-variantti tai näyte (`nayte-v1.mp3`), videolla posterikuva
(`poster-v1.webp` — joka on kuva ja kuuluu kuvien konventioon) ja resoluutiovariantit.

**Fyysinen taso — ei samaa varastoa, vaan suoraan objektivarastoon.** Nykyinen
git-repo + Netlify-site sopii äänelle/videolle huonosti kolmesta syystä:

1. **Koko.** Yksi äänikirjaluku on kymmeniä megatavuja, video satoja — git-historia
   paisuu peruuttamattomasti ja jokainen deploy siirtää koko repon. Kuvien
   ~44 Mt toimii; tunti ääntä + muutama video laukaisisi luvun 4 siirtymäsignaalit
   välittömästi.
2. **Kaista.** 100 Gt/kk jaettu kaista on äänen/videon jakelussa todellinen riski,
   toisin kuin webp-kuvilla.
3. **Toisto.** Ääni ja video striimataan range-pyynnöillä ja mahdollisesti
   adaptiivisella bitratella — objektivarasto/CDN on tähän oikea alusta, git-deploy ei.

Siksi linjaus on: **ääni- ja videopankki pystytetään suoraan R2:een** (tai vastaavaan),
ilman Netlify-välivaihetta. Se voi tarkoittaa käytännössä kahta polkua:

- **Polku A (todennäköinen):** ääni/video-tarve laukaisee koko mediavaraston
  R2-siirron — yksi bucket, jossa `maps/`, `entities/`, `site/`, `audio/`, `video/`
  elävät saman base-URL:n alla. Yksi varasto, yksi kaava, yksi siirto.
- **Polku B (jos kuvapankkia ei haluta liikuttaa vielä):** kuvapankki jää Netlifyyn
  ja ääni/video saa oman R2-bucketin omalla base-URL:llaan. Tämä on arkkitehtuurin
  kannalta yhtä kelvollinen, koska invariantti 3 sallii **base-URL:n per mediatyyppi**
  — kuluttajalla olisi `KUVAPANKKI_BASE`-rinnalla `AANIPANKKI_BASE`. Hinta on kaksi
  varastoa ylläpidettävänä.

### 5.2 Erikoistapaus: suoratoistovideo

Jos video on lyhyt ja ladattava (teaseri, TARU-välianimaatio), se on tavuja ja kuuluu
mediavarastoon avaimella. Jos taas tarvitaan **pitkää adaptiivista suoratoistoa**
(esitystallenteet, trailerit julkisilla sivuilla), oikea ratkaisu on striimauspalvelu
(Cloudflare Stream, YouTube/Vimeo-upotus) — silloin omistajan tietueessa oleva viite
on palvelun tunniste tai upotus-URL, ei mediavaraston avain. Tämä ei riko kaavaa:
invariantti 4 (viite omistajan tietueessa) pätee, tavut vain elävät palvelussa,
joka hoitaa transkoodauksen ja jakelun. Raja kulkee siis käyttötavassa:
**ladattava tavu → mediavarasto; adaptiivinen striimi → striimauspalvelu.**

### 5.3 Offline- ja teospaketointi äänellä

TARU-/teospaketoinnin vendorointimalli (§2.4) yleistyy äänelle suoraan: teokseen
niputetaan vain teoksen käyttämät ääniavaimet (vastine `vendor-views.mjs`-suodatukselle),
base vaihdetaan paikalliseksi, avaimet säilyvät. Videolle vendoroidaan
posterikuva + tarvittaessa kevyt variantti; striimauspalvelu-video ei voi olla
offline-teoksen riippuvuus — teokseen valitaan silloin ladattava variantti tai
video jätetään online-ominaisuudeksi.

### 5.4 Päätössäännöt tulevalle istunnolle

Kun ensimmäinen ääni-/videotarve konkretisoituu:

1. **Älä lisää ääntä/videota kuvapankki-repoon** — ei edes "väliaikaisesti".
2. Valitse polku A tai B (§5.1) sen mukaan, halutaanko kuvapankin R2-siirto tehdä
   samalla. Oletussuositus: **A**, jos siirtoon on aikaa; **B**, jos ääni tarvitaan heti.
3. Sovella lukua 3 sellaisenaan: versioidut avaimet, immutable, base ajossa,
   johdannaiset/variantit, vendorointi offlineen.
4. Pitkä suoratoisto → striimauspalvelu (§5.2), ei mediavarasto.

---

## 6. Dokumentin suhde muihin

| Dokumentti | Rooli |
|---|---|
| **Tämä (1B)** | Mediavaraston kokonaiskuva: kuvapankin toiminta + invariantit + ääni/video-linjaus |
| `kuvapankki/README.md` | Repon käyttöohje: avaimet, sisältöluettelo, työkalut |
| Atlas `2-ATLAS-ARCHITECTURE.md` §5–5.2 | Omistajuusanalyysi, R2-perustelut, johdannaiskonventio (alkuperäislähde) |
| Master `0-MASTER-ARCHITECTURE.md` | Järjestelmätason status (kuvapankki = läpileikkaava infrastruktuuri) |
| MF `1A-MYTHOLOGIA-FEINNE-ARCHITECTURE.md` §3.9 | `kuvat`-kentän viitemalli ytimessä |

Ristiriitatilanteessa tämä dokumentti on mediavaraston osalta ensisijainen;
lore-hierarkian osalta ensisijainen on Master.

---

## Versioloki

| Versio | Pvm | Muutos |
|---|---|---|
| v0.1 | 24.7.2026 | Ensimmäinen versio: kuvapankin nykytila dokumentoitu (varasto, avainmalli, johdannaiset, kuluttajat, luvut), mediavaraston invariantit eriytetty (§3), ääni/video-tulevaisuuslinjaus polkuineen A/B + striimausraja + päätössäännöt (§5). |
