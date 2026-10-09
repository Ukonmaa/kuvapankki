# 1B — MEDIA STORAGE ARCHITECTURE

**Ukonmaan mediavarasto: kuvapankki tänään, äänet ja videot huomenna**

> **Kehitystyön ohjaus: juuritason `ROADMAP.md`** (24.7.2026 alkaen) — seuraavat askeleet, tiekartta ja historia. Tämä dokumentti pysyy mediavaraston teknisenä totuutena.

| | |
|---|---|
| **Versio** | v0.5 (9.10.2026) |
| **Status** | Kuvapankki tuotannossa · `entities/` **käytössä: 4 entiteettikuvaa julkaistu** (J8f, J8g) **+ 8 olentokuvaa valmiina, julkaisematta** (J26, §2.5c) · ääni/video-linjaus pohdintana |
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
entities/<id>/<rooli>-v<n>.webp       MF-entiteettien kuvat (MF.kuvat viittaa tänne) — ks. §2.5
entities/<id>/<rooli>-thumb-v<n>.webp  johdannainen: 512 px, q75, ≤ 150 kt
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
- **Bestiaari** (`bestiary-app/index.html`) ja **Ensyklopedia** (`encyclopedia-home.html`):
  oma toisinto samasta `KUVAPANKKI_BASE` + `kuvaUrl(avain)` -parista (J6, 29.7.2026).
- **Kronikka** (`chronicle-app/js/chronicle-data.js`) ja **Maailma**
  (`world-app/js/world-data.js`): sama toisinto (J6-jälkihoito, 29.7.2026). Kumpikaan ei
  vielä renderöi entiteettikuvaa, mutta molemmilla oli `mediaUrl: ""`, joka olisi
  resolvoinut kuvapankin avaimen suhteelliseksi poluksi heti ensimmäisellä kuvalla.
  Sama moduuli tarjoaa myös `paakuvaUrl(entiteetti)`-poiminnan (Bestiaarin kaava) ja
  `TARU_EMBED`-lipun, jonka näkymän taru-silta tuo — upotustilaa ei johdeta kahdesti.
- Viisi toisintoa on **tietoinen valinta**, ei velka: siirtymämalli on "base-URL:n vaihto
  per sovellus" (ks. luku 4), joten R2-siirto on viisi yhden rivin muutosta. Jaettua
  moduulia ei tehty, koska cross-repo-suhteellinen polku on tässä projektissa jo kerran
  osoittautunut ansaksi (`vakikeha.js`).
- **Varaus:** ukonmaa-web (`site/`).

Karttojen koordinaatti-JSON pysyy gitissä (diff/historia siellä missä se tuottaa
arvoa) ja viittaa kanvaasiin avaimella — versiointi ei katoa, se elää avaintasolla.

### 2.5 `entities/` — nimiavaruus ja kuvatuotannon toimitussopimus (J6, 29.7.2026)

> **PÄIVITETTY 3.8.2026 (v0.3): nimiavaruudessa on nyt neljä julkaistua kuvaa.**
> Alla oleva 29.7. kirjattu tila (*"yhtään kuvaa ei ole julkaistu"*) on vanhentunut, ja
> sen taustalla ollut linjaus *"tähän julkaisuun ei tule kuvia lainkaan"* raukesi, koska
> **käyttäjä toimitti kuvat itse**. Ks. §2.5b.
>
> **PÄIVITETTY 9.10.2026 (v0.4, J26): toimitussopimus muuttui kahdessa kohdassa.** (1) Lähde on
> **taustallinen alkuperäinen**, ei alpha-kuva: kuvan pitää toimia millä tahansa taustalla.
> (2) Luettelopaikoissa kuva sovitetaan `contain`-säännöllä ja kodeksisivulla `cover`-säännöllä
> (alla "Sommittelu"-kohta ja §2.5c). Ks. §2.5c.

Nimiavaruus on **käytössä**: putki on rakennettu ja todennettu päästä päähän, mutta
**yhtään kuvaa ei ole julkaistu** — kuvatuotanto tehdään erillisenä projektina, eikä
tähän julkaisuun tule kuvia lainkaan (käyttäjän linjaus 29.7.2026).

**Avain:** `entities/<entiteetin-id>/<rooli>-v<n>.webp`, ja rinnalle `<rooli>-thumb-v<n>.webp`.
Muodon valvoo ytimen skeema (1A §3.9), joten väärä avain kaataa buildin.

**Työkalu:** `npm run entiteettikuvat` → `tools/luo-entiteettikuvat.mjs` (karttojen
`luo-johdannaiset.mjs`:n sisar). Sama muuttumattomuussääntö: olemassa olevaa versioitua
avainta **ei koskaan ylikirjoiteta**. Viallinen lähde ei keskeytä erää vaan raportoidaan
nimeltä ja työkalu jatkaa; kelvoton id tai rooli hylätään ennen kirjoitusta; tuntematon
tiedostopääte raportoidaan eikä vaieta. Kokorajan ylitys → `exit 1` vasta erän lopuksi,
ei kesken.

#### Toimitussopimus — mitä kuvatuotanto toimittaa

- **Yksi lähde per entiteetti:** PNG tai WebP, olento rajaamatta. ~~Läpinäkyvä tausta~~ —
  **muutettu 9.10.2026 (J26, käyttäjän linjaus): lähde on taustallinen alkuperäinen.** Alpha-kuvaa
  ei toimiteta, koska läpinäkyvälle mustepiirrokselle kuvan tausta on kortin tumma pinta ja
  piirros katoaa (mitattu Marrasilla). Alpha-lähde vain erillisellä päätöksellä (ROADMAP J49).
- Resoluutio **vähintään 1200 px** pisimmältä sivulta, mieluiten enemmän — työkalu
  pienentää, ei suurenna.
- Tiedostonimi `<rooli>.png`, missä rooli on toistaiseksi aina `paakuva`.
- Kansio **täsmälleen ytimen id:llä** (`menninkainen`, ei `Menninkäinen`). Pienet
  kirjaimet ja väliviivat, ei ääkkösiä eikä alaviivoja; työkalu hylkää muun.
- Lähteet menevät `entities/_lahde/`-puuhun, joka on **gitignoroitu** — repoon tulevat
  vain versioidut johdannaiset.

**Mitä ei tarvitse tehdä:** webp-muunnos, koot, versionumerot, kokorajat ja optimointi
hoituvat työkalulla.

**Mitä pitää tietää:**

- **Versioitu avain on ikuinen.** Kun `paakuva-v1.webp` on julkaistu, sen sisältö ei enää
  muutu. Korjattu kuva on `paakuva-v2.webp` ja vaatii viitteen päivityksen ytimessä.
- **Sommittelu:** kaikki nykyiset kuvapaikat rajaavat `object-fit: cover` -periaatteella
  **eri kuvasuhteilla** (Bestiaarin kortti 4:3, olentosivu 3:4, kodeksirivi 130×88 px,
  Ensyklopedian muotokuva pystysuunnassa). ~~Sommittele niin, että olennon tunnistettava osa
  kestää sekä vaaka- että pystyrajauksen.~~ **Ratkaistu 9.10.2026 (J26):** Bestiaari käyttää
  luettelopaikoissa (kortti, luetteloriviä) `contain`ia ja kodeksisivulla `cover`ia, joten
  kuvaajan ei tarvitse sommitella rajauksen ehdoilla. Monen kuvasuhteen tuki (mukautuva
  kehys, vyöry tekstin alle) on tutkittu ja jonossa: ROADMAP **J49**.
- **Alt-teksti** kirjoitetaan kuvan valmistuttua ja kuvaa **kuvaa**, ei entiteettiä.

#### Mitat ja mittaustulokset

| Johdannainen | Pisin sivu | Laatu | Kokoraja |
|---|---|---|---|
| `<rooli>-v<n>.webp` | 1200 px | 80 | 500 kt |
| `<rooli>-thumb-v<n>.webp` | 512 px | 75 | 150 kt |

Rajat ovat **virherajoja** ("tämä on selvästi väärin"), eivät optimointitavoitteita.
Mitattu 29.7.2026 kahdella oikealla alpha-lähteellä (1024×1024, olentokortit): pääkuva
230 kt ja 335 kt, thumb 90 kt ja 112 kt. Alkuperäiset arvatut rajat (300/120) hylkäsivät
toisen näytteen heti — alpha-webp pakkautuu huonommin kuin opaakki.

**Mittauksen sivulöydös, joka kannattaa muistaa: pienentäminen kasvatti tiedostoa**
(1024 → 1000 px nosti 230 → 273 kt ja 335 → 360 kt). Uudelleennäytteistys pehmentää
reunat, jotka pakkautuvat alphan kanssa huonommin kuin terävä alkuperäinen. Älä siis
yritä säästää tavuja pienentämällä.

### 2.5b Ensimmäinen oikea lasti — ja mikä EI kuulu tänne (3.8.2026, J8f/J8g)

Putki sai ensimmäisen lastinsa: **neljä entiteettikuvaa**, kaikki käyttäjän toimittamia.

| Avain | Entiteetti | paakuva | thumb |
|---|---|---:|---:|
| `entities/kultaraha/paakuva-v1.webp` | valuutta | 294 kt | 60 kt |
| `entities/hopearaha/paakuva-v1.webp` | valuutta | 262 kt | 58 kt |
| `entities/kupariraha/paakuva-v1.webp` | valuutta | 248 kt | 42 kt |
| `entities/kaskenraja/paakuva-v1.webp` | paikka | 321 kt | 50 kt |

Putki toimi päästä päähän ilman muutoksia: lähde `_lahde/<id>/paakuva.png` →
`npm run entiteettikuvat` → versioitu avain → ytimen `kuvat`-kenttä → näkymän
`kuvaUrl()`. Kaikki alle kokorajojen. **Kaista- ja bundlevaikutus:** näkymän
julkaisuartefaktiin tulee **0 tavua** — kuvat haetaan URL:sta ajossa.

**Poikkeus toimitussopimuksesta, joka kannattaa tietää:** yhdelläkään neljästä lähteestä
**ei ole alfakanavaa** — kolikot ovat vaalealla pohjalla ja Kaskenraja on RGB-piirros
paperilla. Sopimus lupaa läpinäkyvän taustan, mutta **kuvia ei muokattu**: näkymä
sulauttaa taustan `mix-blend-mode: multiply` -tilalla pergamenttia vasten, jolloin
valkoinen katoaa. **Korjaus tehtiin näkymässä, ei versioidussa avaimessa** — avain pysyy
sinä mitä tekijä toimitti. Tämä on suositeltava järjestys aina kun taustan poisto on
esitystapaa eikä kuvan sisältöä.

#### Mikä EI kuulu `entities/`-nimiavaruuteen

3.8.2026 harkittiin `Encyclopedia/Tietolaatikot/`-kansion 43 tiedoston viemistä tänne.
**Ei viety, ja syy kannattaa muistaa:** ne eivät ole entiteettikuvia vaan **vanhan
esitystavan tietolaatikoita — koristekehys, johon entiteetin lore-teksti on ladottu
kuvaksi.** 42/43 esittää tekstin, jonka Ensyklopedia jo renderöi ytimestä elävänä.

Kolme syytä, jotka pätevät yleisestikin:

1. **Teksti kuvana on hakukelvotonta, ei-valittavaa ja saavuttamatonta.** Ydin on
   tekstin koti; kuvapankki on tavujen koti. Tekstin kopioiminen tavuiksi rikkoo rajan.
2. **Immutable-avain jäädyttää sisällön.** Kun teksti muuttuu ytimessä, kuva ei muutu —
   ja koska avainta ei saa ylikirjoittaa, virhe jää näkyviin siihen asti kunnes joku
   huomaa sen. Todiste oli jo käsillä: `Kaskenraja.jpg` kantaa Atlaksen **vanhaa**
   varatekstiä, ei ytimen uudempaa laitosta.
3. **Kuvapankki ei ole arkisto.** Vanhentuneen esitystavan säilyttäminen on
   varmuuskopiointia, ei julkaisua — ks. ROADMAP **J25**.

**Sääntö: `entities/` on entiteetin *kuvitusta* varten — sitä, mitä teksti ei voi
korvata.** Jos tiedosto olisi yhtä hyvä tekstinä, se kuuluu ytimeen eikä tänne.

### 2.5c Ensimmäinen olentoerä (9.10.2026, J26)

Kahdeksan olentokuvaa, kaikki käyttäjän lyijykynä- ja mustepiirroksia valkoisella tai
paperinsävyisellä pohjalla (kuusi 8.10., Marras ja Menninkäinen 9.10. taustallisina
alkuperäisinä). **Valmiina, julkaisematta** (kuvapankin push on tuotantodeploy, 15 kr; ks.
ROADMAP). Putki on sama kuin §2.5:ssä: `entities/_lahde/<id>/paakuva.png` →
`npm run entiteettikuvat`; työkalua ei muutettu. Työkalu ohitti jo olemassa olevat avaimet
("oli jo"), kun lisäerä ajettiin — immutable-sääntö toimi kuten pitääkin.

| Avain | Lähde (Drive, vain luku) | Mitat → johdannainen | paakuva | thumb |
|---|---|---|---:|---:|
| `entities/ihtiriekko/paakuva-v1.webp` | Ihtiriekko.png | 600×800, ei suurennettu | 47 kt | 11 kt |
| `entities/jattilainen/paakuva-v1.webp` | Jättiläinen.png (versio 1) | 1024×1024 | 127 kt | 27 kt |
| `entities/kalmo/paakuva-v1.webp` | Kalmo.png (taustallinen) | 1024×1024 | 214 kt | 60 kt |
| `entities/maahinen/paakuva-v1.webp` | Maahinen.png (versio 1) | 1024×1024 | 191 kt | 47 kt |
| `entities/piru/paakuva-v1.webp` | Piru.png | 816×1456 → 673×1200 | 196 kt | 25 kt |
| `entities/tontut/paakuva-v1.webp` | Tonttu.jpg | 1024×1024 | 181 kt | 39 kt |
| `entities/marras/paakuva-v1.webp` | Väliaikainen\Marras.jpg (taustallinen) | 1024×1536 → 800×1200 | 135 kt | 21 kt |
| `entities/menninkainen/paakuva-v1.webp` | Väliaikainen\Menninkäinen.png (uusi piirros) | 1024×1024 | 166 kt | 42 kt |

Yhteensä 1 529 kt, kaikki kokorajojen sisällä. Mestarit eivät muuttuneet. ⚠ **Kahden
viimeisen mestarit ovat Driven `Väliaikainen`-kansiossa** eivätkä `Korttien kuvat/`-kansiossa
muiden mukana — ne kannattaa siirtää J37:n hakemistorakenteen mukaan (ei tehty: Drive on
vain luku tässä erässä).

**Mitä erä opetti sopimukselle:**

- **Taustallinen lähde, ei alpha** (käyttäjän linjaus 8.10.2026: *"kaikki taustattomat tulee
  korvata taustallisella"*). Syy on mitattavissa: Marras on musta mustepiirros läpinäkyvällä
  pohjalla (58 % + 25 % osittain läpinäkyvää), ja Bestiaryn tummalla kortilla se on lähes
  näkymätön. Alpha-hahmo myös painaa eniten (alpha-Marras 484 kt / raja 500; taustallinen
  Marras 135 kt) — alpha-webp pakkautuu huonommin kuin opaakki. **Läpinäkyvä tiedostonimi ei
  kerro läpinäkyvyyttä:** Marras.png oli alpha-kuva, vaikka sen nimessä ei lukenut "ei
  taustaa". Molemmat alpha-kuvat korvattiin 9.10. taustallisilla alkuperäisillä, ja
  läpinäkyviä -v1-avaimia ei julkaistu.
- **Rinnakkaisversiot:** käyttäjä valitsi yhden per entiteetti. Valitsemattomat
  (Jättiläinen2, Maahinen2, Tonttu2 ja kaikki "ei taustaa" -versiot) jäävät vain Driveen;
  ne ovat eri piirroksia, ei kaksoiskappaleita. Skeema sallii toisen kuvan `lisakuva`na,
  mutta yksikään näkymä ei vielä renderöi sitä.
- **JPG-lähde:** työkalu ottaa vain `.png` ja `.webp`, joten `Tonttu.jpg` purettiin PNG:ksi
  gitignoroituun `_lahde/`-puuhun (pikselit ennallaan; webp on siis toisen polven pakkaus).
- **Resoluutio:** Ihtiriekko on 600×800 eli alle sopimuksen 1200 px:n; työkalu ei suurenna,
  ja kuva riittää 3:4-kehykseen. Sopimuksen alaraja on tulevalle kuvatuotannolle edelleen
  1200 px.
- **Thumbit** (`-thumb-v1`) ovat käytössä Bestiaryn kortissa (J49, 9.10.): `srcset` pikkukuva 1x, täysi
  kuva 2x — tavallisella näytöllä 8 kuvaa 1 257 kt → 272 kt. Pikkukuvan avain johdetaan pääkuvan
  avaimesta (`-vN.webp` → `-thumb-vN.webp`), joten datassa on vain pääkuvan avain.
- **Mitat:** työkalu mittaa pääkuvat (`npm run entiteettikuvat -- --mitat` → JSON-rivit; normaaliajo
  tulostaa uusien mitat), ja ne kirjataan ytimen `kuvat[].leveys/korkeus`-kenttiin (1A §3.9), jotta
  näkymä asettaa kuva-alan suhteen ennen latausta.
- **TARU vendoroi `kuvapankki/entities/` kokonaan** sekä Bestiaryn että Ensyklopedian mukaan
  (`vendor-views.mjs`), joten erä lisää ~1,5 Mt kahteen kertaan TARU:n `public/views/`-
  aineistoon seuraavassa TARU-julkaisussa.

### 2.6 Nykytila lukuina (24.7.2026; entities-rivi 9.10.2026)

8 karttaa, 25 webp-tiedostoa, **~44 Mt** (`maps/`); `entities/` **4 julkaistua entiteettiä
(8 tiedostoa, ~1,3 Mt) + 8 julkaisematonta (16 tiedostoa, ~1,5 Mt)** eli julkaisun jälkeen
12 entiteettiä, 24 tiedostoa, ~2,8 Mt; `site/` tyhjä varaus. Netlifyn ilmaiskaista 100 Gt/kk on jaettu
ytimen julkaisun ja tulevan webin kanssa — nykyvolyymilla kaukana katosta.

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
| v0.5 | 9.10.2026 | **J49 — mitat ja pikkukuva.** `tools/luo-entiteettikuvat.mjs` sai `mittaaEntiteettikuvat()`-funktion ja CLI-valitsimen `--mitat` (pääkuvien mitat ytimen `kuvat[]`-kenttiin); normaaliajo tulostaa uusien kuvien mitat. Testit 9/9 (+2). §2.5c: thumbit otettu käyttöön Bestiaryn kortissa (`srcset`). Tiedostoja ei lisätty. |
| v0.4 | 9.10.2026 | **J26 — ensimmäinen olentoerä.** Uusi §2.5c: kahdeksan olentokuvaa (`entities/<id>/paakuva-v1.webp` + thumb, yht. 1 529 kt, kokorajojen sisällä) valmiina, julkaisematta; Marras ja Menninkäinen lisättiin 9.10. taustallisina alkuperäisinä. **Toimitussopimus muuttui:** lähde on taustallinen alkuperäinen eikä alpha (käyttäjän linjaus; mitattu: läpinäkyvä mustepiirros katoaa tummalla kortilla), ja sommittelurajoitus ("kestää vaaka- ja pystyrajauksen") poistui, koska luettelopaikat käyttävät `contain`ia ja kodeksisivu `cover`ia. §2.6 luvut päivitetty. Työkalua ei muutettu. |
| v0.3 | 3.8.2026 | **J8f/J8g — ensimmäinen oikea lasti.** `entities/` sai neljä julkaistua kuvaa (kolme kolikkoa + Kaskenraja); uusi §2.5b (putken toiminta päästä päähän, poikkeus: ei alfakanavaa → tausta poistetaan näkymässä `multiply`-tilalla) ja luku "mikä EI kuulu `entities/`-nimiavaruuteen" (Tietolaatikot). *(Rivi lisätty jälkikäteen 9.10.; versio oli otsikossa mutta lokissa puuttui.)* |
| v0.2 | 29.7.2026 | **J6 — entiteettikuvien putki.** `entities/`-nimiavaruus otettu käyttöön: uusi §2.5 (avainmalli, työkalu `luo-entiteettikuvat.mjs`, kuvatuotannon toimitussopimus, mitatut kokorajat 500/150 kt). §2.4 sai Bestiaarin ja Ensyklopedian kuluttajiksi ja perustelun kolmelle resolveritoisinnolle. Huom: **putki on valmis, kuvia ei ole julkaistu yhtään** — kuvatuotanto on erillinen projekti. |
| v0.1 | 24.7.2026 | Ensimmäinen versio: kuvapankin nykytila dokumentoitu (varasto, avainmalli, johdannaiset, kuluttajat, luvut), mediavaraston invariantit eriytetty (§3), ääni/video-tulevaisuuslinjaus polkuineen A/B + striimausraja + päätössäännöt (§5). |
