# QRNG Art — predlog razvoja

> Analiza projekta qrng-art.com: šta valja, šta koči, kako ulepšati scenarije, kako unovčiti i u šta sve ovo može da preraste.
> Datum: 2026-11-18

---

## 1. TL;DR — iskrena ocena

**Koncept je jak, izvedba slike je trenutno slaba karika.**

- **USP (ono što drugi nemaju):** svaka slika ima *dokazivo kvantno poreklo* (1000 brojeva iz ANU QRNG), dnevni ritual („slika dana") i potpunu reproducibilnost. To je dobra priča, laka za marketing i za poklone.
- **Tehnička osnova je solidna:** deterministički renderer, arhiva, QRNG reveal, favorites sa share linkovima, /algorithmic studio sa share kodovima, hi-res i video exportom, dvojezičnost.
- **Glavni plafon:** slike trenutno izgledaju kao *flat clip-art*: ravni oblici, bez teksture, bez dubine, i sa malom razlikom između dana u istom scenariju. Ljudi ne plaćaju za priču ako slika sama po sebi nije lepa.

**Preporuka:** prvo 2–3 nedelje na vizuelni kvalitet (post-fx, palete, rarity), pa tek onda prodavnica. Najrealniji izvori prihoda su **„Usvoji dan" (1-of-1)** i **personalizovani kvantni poklon sa sertifikatom**, uz print-on-demand.

---

## 2. Šta radi dobro

| Oblast | Zašto je dobro |
|---|---|
| Determinističnost | Isti 1000 brojeva uvek daju istu sliku. Na tome se može graditi sertifikat i vlasništvo. |
| Arhiva po datumu | Prirodan „kalendar". Datum je emotivan proizvod (rođendani, godišnjice). |
| QRNG reveal | Transparentnost: korisnik vidi brojeve koji su napravili sliku. |
| QRNG pool + refill | Otporno na pad ANU API-ja ([qrng-pool/refill.php](qrng-pool/refill.php)). |
| /algorithmic studio | Već ima hi-res PNG, ZIP setove, WebM loop i share kodove. Pola „Pro" proizvoda je već napravljeno. |
| OG slike | [src/app/api/og-image/route.ts](src/app/api/og-image/route.ts) već renderuje na serveru preko `@napi-rs/canvas`. |

---

## 3. Glavni problemi

### 3.1 Niska varijansa u pojedinim scenarijima
Na screenshotu arhive **10., 12. i 16. novembar izgledaju skoro identično** (zalazak nad vodom).
- [src/lib/scenarios/ocean-sunset.ts](src/lib/scenarios/ocean-sunset.ts): hue neba varira samo ±20–30°, voda je potpuno fiksna (`hslToRgb(235, …)`), sunce je uvek na horizontu i uvek iste boje (`[255,180,100]`).
- [src/lib/scenarios/city-night.ts](src/lib/scenarios/city-night.ts): siluete zgrada su obični pravougaonici, nebo je uvek tamnoplavo.

### 3.2 Flat izgled
- Nema teksture (grain, papir), nema atmosferske perspektive (dalji slojevi nisu svetliji ni maglovitiji), nema senki između slojeva.
- Šumske krošnje su krugovi ([forest.ts](src/lib/scenarios/forest.ts)), a pustinja i plaža dele isti `ridgePoints` izgled peska.
- Boje se biraju slobodno u HSL-u, pa kombinacije često nisu harmonične (npr. žuto-zelene dune pod narandžastim nebom).

### 3.3 Samo 8 scenarija
Sa 12,5% šanse po scenariju korisnik posle desetak dana vidi „sve". Fale iznenađenja.

### 3.4 Izmene scenarija retroaktivno menjaju arhivu ⚠️
[ArtCanvas.tsx](src/components/ArtCanvas.tsx) renderuje na klijentu iz sačuvanih vrednosti. **Svaka izmena koda u scenarijima menja sve stare slike u arhivi.** To je u redu dok je projekat hobi, ali je neprihvatljivo kad neko *kupi* sliku ili sertifikat za neki datum.

### 3.5 Budžet od 1000 vrednosti
[qrng.ts](src/lib/qrng.ts) posle 1000 vrednosti prelazi na `xorshift32 ⊕ ciklični QRNG`. Scenariji sa 250–600 zvezda (svaka troši ~4 vrednosti) brzo potroše kvantni budžet. Tehnički je to OK, ali za iskrenu priču „100% kvantno" vredi:
- trošiti QRNG vrednosti na *odluke* (kompozicija, paleta, retki događaji),
- a za masovne detalje (zvezde, lišće, grain) koristiti PRNG seedovan iz QRNG-a, i to jasno napisati na sajtu.

### 3.6 Slika dana trenutno nije kvantna ⚠️ (odloženo)
[api/art/[date]/route.ts](src/app/api/art/[date]/route.ts) i [api/og-image/route.ts](src/app/api/og-image/route.ts) koriste `seedFromDate()` iz [qrng-server.ts](src/lib/qrng-server.ts): SHA-256 hash datuma → xorshift → 1000 brojeva. ANU QRNG i `qrng_pool` koristi samo `/api/generate` (Igraonica i studio).
- **Odluka (2026-11-19):** ostaje ovako za sada; prvo vizuelna poboljšanja.
- **Plan za kasnije:** tabela `daily_art` (datum → 1000 brojeva + izvor + vreme). Prvi zahtev dana uzima red iz `qrng_pool` i trajno ga vezuje za datum; datumi pre prelaska ostaju na `seedFromDate`, pa se arhiva ne menja. Ovo je preduslov za sertifikat i „Usvoji dan" (5.1).
- Trag je ostavljen i u README, sekcija „Otvorena pitanja / TODO".

---

## 4. Ulepšavanje scenarija

Poređano po odnosu efekta i uloženog rada.

### 4.0 Preduslov: `renderVersion` ✅ urađeno 2026-11-19
- Verzija se određuje **po datumu** (bez izmena baze): [render-version.ts](src/lib/render-version.ts), `NEXT_PUBLIC_RENDER_V2_FROM`.
- [router.ts](src/lib/scenarios/router.ts) ima `renderArt(ctx, stream, w, h, version)`, a stari kod je u [src/lib/scenarios/v1/](src/lib/scenarios/v1/) i više se ne menja.
- Svi novi vizuelni radovi idu u `v2`. Prodata slika je „zamrznuta" na svojoj verziji.
- Dodati snapshot test: hash PNG-a za nekoliko fiksnih setova brojeva po verziji. Ako se hash promeni, nešto je slučajno pokvareno.

### 4.1 Globalni post-fx sloj (najveći dobitak za najmanje rada) — 🟡 delimično urađeno 2026-11-19
> Urađeno: grain, vinjeta, split-tone (color grading), S-kontrast u [post-fx.ts](src/lib/post-fx.ts). Ostaje: atmosferska perspektiva (traži `depth` iz scenarija) i bloom oko sunca/meseca (traži poziciju sunca iz scenarija).

Novi fajl `src/lib/post-fx.ts`, poziva se na kraju `renderArt`:
1. **Film grain**: šum niskog intenziteta (alpha 0.03–0.06) preko cele slike. Odmah ubija „vektorski clip-art" utisak.
2. **Vinjeta**: radijalni gradijent ka tamnim ivicama.
3. **Atmosferska perspektiva**: svaki dalji sloj (brda, drveće, zgrade) dobija mešanje sa bojom neba (`lerp(layerColor, skyColor, depth*0.5)`). Ovo zahteva da scenariji prosleđuju `depth`, a pomoćnu funkciju treba staviti u [draw-utils.ts](src/lib/draw-utils.ts).
4. **Bloom/halo oko sunca i meseca** koji prelazi preko siluete (sada je oštro odsečeno).
5. **Color grading**: blagi split-tone (topli highlights, hladne senke), sa parametrima iz palete.

### 4.2 Kurirane palete — ✅ urađeno 2026-11-19 (svih 8 scenarija: zalazak 8, ostali po 6)
- Biblioteka od 30–50 ručno izabranih harmoničnih paleta (`src/lib/palettes.ts`), svaka sa 5–7 boja i ulogama (`skyTop`, `skyBottom`, `sun`, `far`, `mid`, `near`, `accent`).
- QRNG bira paletu, a zatim pravi male pomake hue/lightness (±5–8%) da nijedna slika ne bude identična.
- Postojeća pravila iz README (nebo nikad zeleno, sunce toplo…) postaju svojstva palete umesto `if`-ova.

### 4.3 Stilski modovi (preko svih scenarija)
QRNG bira stil nezavisno od scenarija, pa 8 scenarija × 5 stilova = 40 vizuelnih „svetova":

| Stil | Tehnika |
|---|---|
| Flat (postojeći) | bez promene |
| Paper-cut | slojevi sa mekom senkom ispod (`shadowBlur`, offset), blaga tekstura papira |
| Ukiyo-e | ograničena paleta, tamne konture, gradijent neba u trakama, talasi kao krive |
| Pixel/dither | render na 1/4 rezolucije + ordered (Bayer) dithering, pa skaliranje bez smoothinga |
| Akvarel | svaki oblik = 4–6 prozirnih poligona sa noise ivicama (alpha 0.08–0.15) |
| Linocut | 2–3 boje, šrafura linijama umesto gradijenata |

### 4.4 Konkretno po scenariju — ✅ svih 8 scenarija prerađeno u v2 (2026-11-19)

**Zalazak nad vodom** ([ocean-sunset.ts](src/lib/scenarios/ocean-sunset.ts)) — ✅ urađeno 2026-11-19 (v2):
- paleta iz biblioteke umesto fiksnih hue-ova,
- oblaci obasjani odozdo (topla donja ivica, tamna gornja),
- sunce delimično ispod horizonta, iznad ili pokriveno oblacima,
- svetlosna staza na vodi od kratkih horizontalnih segmenata koji se šire ka posmatraču,
- opciono silueta: jedrilica, ostrvo, svetionik, stena.

**Noćni grad** ([city-night.ts](src/lib/scenarios/city-night.ts)) — ✅ urađeno 2026-11-19 (v2):
- 2–3 sloja zgrada sa atmosferskom perspektivom,
- raznovrsni krovovi (antene, kupole, kosi krovovi, vodotornjevi),
- prozori u klasterima (cele etaže upaljene/ugašene), toplo i hladno svetlo,
- reka ili kanal sa refleksom, magla na dnu, svetlosno zagađenje kao narandžasti sjaj neba pri horizontu.

**Šuma** ([forest.ts](src/lib/scenarios/forest.ts)) — ✅ urađeno 2026-11-19 (v2):
- krošnje od klastera manjih „listova" ili L-system grana (postoji [tree-lsystem.ts](src/lib/tree-lsystem.ts)),
- sunčevi zraci kroz krošnje (`globalCompositeOperation = "lighter"`),
- magla između redova drveća.

**Pustinja** ([desert.ts](src/lib/scenarios/desert.ts)) — ✅ urađeno 2026-11-19 (v2):
- dune sa jasnom osvetljenom i senovitom stranom (oštar greben, mek pad),
- talasići vetra na pesku, fatamorgana pri horizontu, opciono karavan ili ruševina u daljini.

**Kosmos** ([cosmos.ts](src/lib/scenarios/cosmos.ts)) — ✅ urađeno 2026-11-19 (v2):
- maglina od nekoliko slojeva noise oblaka u 2–3 boje,
- traka Mlečnog puta, prašina, veće zvezde sa „spikes" difrakcijom.

### 4.5 Novi scenariji (cilj: 14–16)
> Napredak: ✅ Gradovi — Beograd, Pariz, Rim; ✅ Podvodni svet; ✅ Savana; ✅ Polja i ravnica (2026-11-19); ✅ Oluja (2026-11-20); ✅ Arktik / fjord (2026-11-20); ✅ Japanski vrt (2026-11-20). Kvantna apstrakcija ne ulazi u dnevnu sliku — ostaje u Studiju (`/studio`, spaja igraonicu i /algorithmic; faza 1 ✅ 2026-11-21, faza 2 ✅ 2026-11-22: kontrole scene i parametri apstrakcija; faza 3 ✅ 2026-11-22: favoriti sa scenom i kontrolama).
Polarna svetlost nad fjordom · planinsko jezero u zoru · oluja sa munjom i kišom · japanski vrt/pagoda · podvodni svet · snežni pejzaž · vulkan · polja lavande/žita · apstraktni dan (pozajmljen iz /algorithmic).

### 4.6 Rarity sistem — ✅ urađeno 2026-11-19 (v2; prikaz oznake ispod slike, bez oznake u arhivi za sada)
Retki događaji koje bira QRNG, sa vidljivim nivoom ispod slike:

| Nivo | Šansa | Primeri |
|---|---|---|
| Common | ~70% | – |
| Rare | ~20% | zvezda padalica, duga, jato ptica |
| Epic | ~8% | kometa, aurora u nepolarnom scenariju, dva meseca |
| Legendary | ~2% | pomračenje Sunca, „kvantni glitch" (namerni vizuelni artefakt), zlatni sat preko cele slike |

Zašto: daje razlog za svakodnevni povratak („danas je Legendary!"), sadržaj za deljenje i prirodnu cenu (Legendary dan vredi više u „Usvoji dan" modelu).

### 4.7 Animacija
- **Živi sloj:** treperenje zvezda, svetlucanje vode, pomeranje oblaka, deterministički iz istih brojeva. Malo rada, a slika na početnoj „diše".
- **Timelapse „crtanje":** replay renderera sloj po sloj u 10–15 s videu (vertikalni 9:16). Najbolji format za Reels/TikTok/Shorts. WebM pipeline već postoji u [export-video.ts](src/lib/algorithmic/export-video.ts).

---

## 5. Unovčavanje

Poređano po realnosti za solo developera i po uklapanju u kvantnu priču.

### 5.1 „Usvoji dan" (1-of-1 vlasništvo)
- Svaki dan ima **tačno jednog vlasnika**: 365 komada godišnje, ograničena ponuda bez kripta.
- Kupac dobija: hi-res fajl (do 8K), PDF sertifikat sa svih 1000 brojeva, vremenom preuzimanja iz ANU, hash-om slike i `renderVersion`, plus ime vlasnika na stranici tog dana („Vlasnik: Ana M.").
- Cena: €19 (Common) → €49+ (Legendary). Prošli neprodati dani se takođe mogu kupiti.
- Tehnički: tabela `day_ownership`, MoR checkout, generisanje PDF-a na serveru.

### 5.2 Lični kvantni poklon
- „Kvantna slika tvog rođendana / venčanja / rođenja deteta": sveže preuzet QRNG set namenski za kupca, sa imenom i datumom na slici ili sertifikatu.
- Najjači emotivni use-case. Dobro se prodaje pred praznike, Dan zaljubljenih i Dan majki.
- Cena: €15 digitalno, €39–89 sa printom.

### 5.3 Print-on-demand
- Integracija sa **Gelato**, **Prodigi** ili **Printful** API-jem: poster, platno, uramljena slika, šolja, kalendar („12 kvantnih meseci").
- Bez magacina; marža €10–30 po komadu.
- Preduslov: render u visokoj rezoluciji. Scenariji crtaju u apsolutnim pikselima za 1200×675, pa je najlakše uraditi `ctx.scale(k, k)` i crtati sa logičkim dimenzijama. Treba proveriti debljine linija i zvezde od 1px.

### 5.4 Pretplata „Patron" (€2–4 mesečno)
- Dnevni 4K desktop i **phone wallpaper** (9:16 kompozicija, ne isečak), dnevni email (Brevo već koristiš), download cele arhive, notifikacija kad je dan Epic/Legendary, rani pristup novim scenarijima.

### 5.5 Studio Pro
- /algorithmic: besplatno do 1200px; Pro otključava hi-res, video, set export i komercijalnu licencu.
- Najveći deo koda već postoji, posao je uglavnom paywall i auth provera.

### 5.6 B2B / licenciranje (kasnije)
- QRNG avatari/identicons kao API, omoti albuma za muzičare, brendirana „kvantna" slika za event ili konferenciju.

### Šta ne preporučujem
- **Reklame:** pri malom saobraćaju donose zanemarljiv prihod i kvare utisak.
- **NFT kao glavni model:** reputacioni rizik i mala publika. Model „Usvoji dan" daje isti osećaj retkosti bez kripta.

### Plaćanje
- **Stripe ne podržava firme registrovane u Srbiji.** Koristi **Merchant of Record** servis: **Lemon Squeezy** ili **Paddle** (oni rešavaju EU PDV i fakture), ili **Gumroad** za digitalne proizvode. **PayPal** može kao dodatna opcija.
- POD servisi (Gelato/Printful) imaju sopstveni checkout ili Shopify/Etsy integraciju. **Etsy prodavnica** je dobar dodatni kanal sa postojećim kupcima.

---

## 6. Rast i distribucija

- **Auto-post bot:** svaki dan u 08:00 objavljuje sliku i timelapse na Instagram, X, Bluesky i Threads, sa rarity tagom.
- **Kratki video:** „Kvantni brojevi crtaju današnju sliku", 10–15 s, vertikalno.
- **Zajednice:** r/generative, r/proceduralgeneration, r/creativecoding, Hacker News (Show HN: „Daily art from quantum noise"), Product Hunt.
- **Embed widget:** `<iframe>` ili `<script>` za tuđe blogove („slika dana"), sa linkom nazad.
- **SEO:** svaka `/art/[date]` stranica sa opisom (scenario, stil, rarity, priča). OG slike već postoje.
- **Email lista od prvog dana:** to je jedini kanal koji je tvoj, nezavisno od algoritama društvenih mreža.

---

## 7. „Nešto zanimljivije": ideje sa većim potencijalom

1. **Kvantni mural godine:** svaki dan je pločica na velikom godišnjem posteru 365 slika. Na kraju godine prodaje se kao limitirani print; vlasnici dana su navedeni na poleđini.
2. **„Slika tvog dana":** prijavljeni korisnik dobija sopstvenu dnevnu sliku (lični QRNG set) uz zajedničku. Lični feed, razlog za login i pretplatu.
3. **Glasanje zajednice:** najbolja slika nedelje/meseca ide u „Hall of Fame" i u kalendar za sledeću godinu.
4. **Live wallpaper app (Android/desktop):** pozadina se menja svaki dan, sa animiranim slojem.
5. **Naslov i kratka pesma za svaku sliku:** generisano preko Claude API-ja iz parametara scene (scenario, paleta, retki događaj). Daje sadržaj za SEO, email i postove, a SR/EN prevod se dobija usput.
6. **Fizička instalacija / e-ink ram:** ram koji svako jutro preuzme novu sliku. Niša, ali odličan poklon i dobra priča za medije.

---

## 8. Roadmap

| Faza | Trajanje | Sadržaj |
|---|---|---|
| **1. Vizuelni kvalitet** | 1–2 ned. | `renderVersion` + snapshot testovi, post-fx sloj, kurirane palete, prepravka ocean-sunset i city-night, rarity sistem |
| **2. Distribucija** | 2–3 ned. | hi-res i phone render, wallpaper download, dnevni email (Brevo), auto-post bot, timelapse video |
| **3. Prodavnica** | 3–4 ned. | „Usvoji dan", lični poklon + PDF sertifikat, POD integracija, Lemon Squeezy/Paddle checkout |
| **4. Skaliranje** | kontinuirano | pretplata, Studio Pro, stilski modovi, novi scenariji, mural godine, zajednica |

---

## 9. Metrike za praćenje

- **Povratak:** procenat posetilaca koji se vrate u roku od 7 dana (GA već postoji).
- **Deljenje:** broj klikova na share i dolazaka preko OG linkova.
- **Email konverzija:** procenat posetilaca koji ostave email (cilj 2–5%).
- **Prodaja:** konverzija posete stranice dana u kupovinu, prosečna vrednost porudžbine, procenat prodatih dana.

---

## 10. Tehničke napomene

- **Hostinger shared hosting:** hi-res render (4K–8K) radi on-demand na serveru, uz keširanje rezultata na disku ili u object storage-u. Ne u buildu i ne masovno. Ako postane usko grlo, render se može izdvojiti u mali worker (npr. jeftin VPS ili serverless funkciju).
- **Budžet QRNG vrednosti:** QRNG vrednosti trošiti na odluke (scenario, paleta, stil, kompozicija, rarity), a detalje (zvezde, grain, lišće) crtati iz PRNG-a seedovanog QRNG-om. To jasno opisati na „Kako radi" stranici.
- **Determinističnost:** izbegavati `Math.random()`, zavisnost od fontova ili `devicePixelRatio` u rendereru. Server-side (`@napi-rs/canvas`) i browser moraju dati isti hash za iste brojeve, inače sertifikat gubi smisao.
- **Pravni minimum za prodaju:** uslovi korišćenja, licenca (lična ili komercijalna upotreba), politika povraćaja za digitalne proizvode i privatnost (GDPR za EU kupce).
