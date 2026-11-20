# QRNG Art

Umetnost generisana iz kvantnog suma (ANU QRNG). Svaki dan nova slika — reproducibilna umetnost iz haosa.

1000 kvantno generisanih brojeva (0–65535) određuje sve: boju neba, broj zvezda, oblik planina, poziciju sunca ili meseca, oblake, drveće, vodu. Isti set brojeva uvek daje istu sliku.

**Napomena:** SVAKI update aplikacije mora se beležiti u [Changelog](#changelog). Izmene scenarija dodatno dokumentuj u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija).

---

## Kako radi

### Izbor scenarija

Prvih 4 broja se XOR-uje, a ostatak deljenja sa brojem scenarija daje indeks. Broj scenarija zavisi od verzije renderera: **v1 = 8** (zamrznuto), **v2 = 14** (raste sa novim scenarijima).

```ts
const mix = (v0 ^ v1 ^ v2 ^ v3) >>> 0;
const scenarioIndex = mix % scenarioCount(version); // NUM_SCENARIOS_V1 = 8, NUM_SCENARIOS_V2 = 14
```

`scenarioIndexFor(values, version)` i `scenarioNameFor(values, version)` ([`src/lib/scenarios/index.ts`](src/lib/scenarios/index.ts)) koriste se za ime scenarija pri snimanju omiljenih (`ArtPageContent`, `/create-art`). Dodavanje scenarija u v2 menja koji scenario pada na koji v2 dan; v1 dani se ne menjaju.

### QRNGStream

[`src/lib/qrng.ts`](src/lib/qrng.ts) — klasa koja troši 1000 uint16 vrednosti i nudi:

- `next_u16()` — sledeći 16-bitni broj
- `next_f()` — float 0–1
- `next_int(a, b)` — ceo broj u rasponu [a, b]

Izvor: [ANU QRNG API](https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16). Fallback na `crypto.getRandomValues` ako API nije dostupan.

### Zajednički utilities

- [`src/lib/color.ts`](src/lib/color.ts) — `hslToRgb`, `rgbString`, tip `RGB`
- [`src/lib/draw-utils.ts`](src/lib/draw-utils.ts) — `ridgePoints` (smoothstep + octave noise za krive), `drawSunGlow` (slojevi glow-a za sunce/mesec)

---

## Scenariji (8 u v1, 13 u v2)

| # | Naziv | Fajl | Opis |
|---|-------|------|------|
| 0 | Pejzaž | [landscape.ts](src/lib/landscape.ts) | v2: dramatični planinski vrhovi u low-poly stilu — 6 paleta (alpski dan, alpenglow, zalazak, noć, plavi sat, jesen), osvetljena/senovita strana po grebenu, snežne kape, more oblaka, podbrđa, alpska livada, staza, koliba |
| 1 | Plaža | [beach.ts](src/lib/scenarios/beach.ts) | v2: tropska plaža — 6 paleta (podne, laguna, zalazak, pastelno jutro, mesečina, oblačno), zakrivljena obala sa penom i plićinom, palme sa liskama, ostrvo/jedrilica/suncobran/školjke |
| 2 | Zalazak | [ocean-sunset.ts](src/lib/scenarios/ocean-sunset.ts) | v2: 8 paleta (uklj. plavi sat), sunce na različitim visinama, oblaci obasjani odozdo, svetlosna staza, silueta (obala/jedrilica/svetionik), ptice |
| 3 | Pustinja | [desert.ts](src/lib/scenarios/desert.ts) | v2: 6 paleta (podne, zlatne dune, saharski zalazak, ljubičasti sumrak, noć sa Mlečnim putem, crvene stene), asimetrične dune sa svetlom i senkom, mese, karavan, oaza, saguaro |
| 4 | Noćni grad | [city-night.ts](src/lib/scenarios/city-night.ts) | v2: 6 paleta, 3 sloja zgrada u izmaglici, raznovrsni krovovi, prozori po spratovima, pun mesec/srp, reka sa odrazima ili ulica sa svetiljkama |
| 5 | Kosmos | [cosmos.ts](src/lib/scenarios/cosmos.ts) | v2: maglina u 6 paleta, zvezde sa zracima, galaksija, 5 tipova planeta (gas, rocky, ocean, ice, lava) sa senkom, atmosferom, prstenovima i mesecima; „sistem" ili „krupni plan" |
| 6 | Šuma | [forest.ts](src/lib/scenarios/forest.ts) | v2: pogled sa proplanka na šumovitu dolinu — 6 paleta (proleće, leto, jesen, zlatni sat, noć sa svitcima, zima), 4 sloja brda u magli, velika drveta sa dvobojnim krošnjama, zraci, srna |
| 7 | Jezero | [lake.ts](src/lib/scenarios/lake.ts) | v2: planinsko jezero — 6 paleta (zora/dan/zlatni sat/sumrak/noć/alpsko), planine sa snegom, šuma na obali, pravi odraz u vodi, magla, mol/čamac/trska |
| 8 | Gradovi (samo v2) | [cities.ts](src/lib/scenarios/cities.ts) | pogled preko reke na grad sa znamenitostima i pravim odrazom; QRNG bira grad (Beograd 35%, Pariz 32.5%, Rim 32.5%), 6 doba dana; ime grada ispod slike |
| 9 | Podvodni svet (samo v2) | [underwater.ts](src/lib/scenarios/underwater.ts) | 6 paleta (tropski greben, duboko plavo, kelp, zalazak, ponor sa bioluminiscencijom, laguna), zraci, kaustike, greben (razgranati/lepezasti/mozak-korali, sunđeri, sase, kelp), jata i tropske ribe, kornjača, meduze, udičarka; podvodni retki događaji |
| 10 | Savana (samo v2) | [savanna.ts](src/lib/scenarios/savanna.ts) | 6 paleta (zlatni/crveni zalazak, podne, jutarnja izmaglica, noć sa Mlečnim putem, kišna sezona), ogromno nisko sunce, akacije, baobab, žirafe, slonovi, antilope/zebre (siluete u zalasku i noću, u boji danju), Kilimandžaro, visoka trava |
| 11 | Polja (samo v2) | [fields.ts](src/lib/scenarios/fields.ts) | regioni Vojvodina (suncokret/žito, salaš sa đermom, topole), Provansa (lavanda, kamena kuća, čempresi), Toskana (brežuljci-krpljenac/vinograd, kuća na brdu, put sa čempresima); 6 paleta neba; ime regiona ispod slike |
| 12 | Oluja (samo v2) | [storm.ts](src/lib/scenarios/storm.ts) | lokacije svetionik na moru (talasi, rt, pena) / usamljeno drvo u ravnici (vetar, bare, ograda) / planine u kiši i magli (koliba, jezero); 6 paleta (supercell, slate, noć, zlatni proboj, ljubičasti sumrak, oluja prolazi + duga); munje sa grananjem, zavese kiše, kosa kiša |
| 13 | Arktik (samo v2) | [arctic.ts](src/lib/scenarios/arctic.ts) | lokacije fjord (litice u 3 sloja, snežne planine, pravi odraz, crvene kućice, kit) / presek kroz vodu (santa sa podvodnim delom, zraci svetla, kit u dubini) / ledena obala (sante, ledene ploče, sastrugi, polarni medved ILI pingvini, iglo ili kućica); 6 paleta (polarni dan, ponoćno sunce, polarna noć, plavi čas, oblačno, maglovita zora); česta ali blaga polarna svetlost |

---

## Važne odluke i ispravke

### Pejzaž (v2, od 2026-11-19)

- **Koncept:** dramatični planinski vrhovi u fasetiranom (low-poly) stilu — razlikuje se od jezera (planine + odraz) i šume (dolina).
- **Palete:** 6 — alpine-day, alpenglow (ružičasti vrhovi u zoru), sunset-orange, night (mesec, zvezde), blue-hour-mist, autumn-highlands; hue ±8.
- **Vrhovi:** daleki venac (5–8, u izmaglici) + glavni masiv (2–4 vrha + pomoćni vrh na ramenu), niži se crtaju prvi. Svaki vrh: osvetljena strana, nazubljen greben ka senovitoj strani (strana prati sunce), snežna kapa sa nazubljenom donjom ivicom (sneg u senci u svojoj boji), blage sporedne fasete. Obris se zatvara na liniji podnožja, ispod je zajednička podloga (prva verzija je imala vertikalne „zidove" ispod vrhova).
- **Niže:** izmaglica na dnu masiva, more oblaka (inverzija) 30%, šumovita podbrđa sa jelkama, alpska livada sa cvećem i travkama, vijugava staza 45%, koliba sa dimom 30% (noću upaljen prozor), ptice 35%.

### Pejzaž (v1)

- Nebo nikad zelena: avoidGreen za hue 85–165. Plava (day/night) ili narandžasto/crvenkasto (sunrise/sunset)
- Oblaci beli ili svetlo sivi
- Sunce uvek toplo (hue 25–60), ne plavo

### Zalazak (v2, od 2026-11-19)

- **Palete umesto slobodnog HSL-a:** 8 kuriranih (classic, golden, pastel, crimson, tropical, lilac, smoky-amber, blue-hour) + mali pomak hue ±8 / lightness ±0.04. Rešava problem da su v1 zalasci izgledali gotovo isto (npr. 10., 12. i 16. novembar).
- **Plavi sat** (`sunBelow`): sunce ispod horizonta, vidi se samo sjaj; prve zvezde.
- **Sunce:** visina od napola zašlog do ~2.5 r iznad horizonta, radijus 26–56 × s; meki radijalni sjaj umesto koncentričnih krugova (nema „traka").
- **Oblaci:** pramenovi od 9–16 pljosnatih elipsi; dva sloja (svetli donji srp + telo pomereno nagore) daju obasjanu donju ivicu. Bliže suncu → topliji.
- **Voda:** refleks boje neba pri horizontu → duboka boja; svetlosna staza (260–420 odsjaja, perspektiva: šira i ređa ka posmatraču); linije talasa sa rastućim razmakom.
- **Siluete:** obala 30%, jedrilica 22%, svetionik na steni 12%; ptice 40%.
- **QRNG vs PRNG:** odluke iz QRNG-a, sitni detalji (zvezde, odsjaji, talasi, oblik oblaka) iz `prngFromStream` ([`src/lib/prng.ts`](src/lib/prng.ts)).
- **Rezolucija:** sve dimenzije × `s = w/1200`, pa thumbnail (600px) i OG (1200×630) imaju isti raspored.

### Arktik (samo v2, od 2026-11-20)

- **Lokacije** (QRNG po težinama): **fjord 40%** (litice sa obe strane u 3 sloja sa maglom između, sneg samo na blagim ispupčenjima ivice, snežni žlebovi, slojevi stene; snežne planine u dnu fjorda; crvene kućice u podnožju 40%, sa upaljenim prozorima noću; ledene ploče, mala santa 50%, rep kita koji izranja 20%), **presek kroz vodu 30%** (vodena linija preko cele slike; iznad nje velika santa, tabularna ili šiljasta; ispod nje podvodni deo 3–4× dublji, tirkizan, sa fasetama, zraci svetla, mehurići, kit u dubini 30%, medved na tabularnoj santi 15%), **ledena obala 30%** (more sa santama i ledenim pločama, ledena ploča u prvom planu sa sastrugima i pukotinama; iglo 30% ili kućica 20%; **polarni medved 35% ili pingvini 35%, nikad zajedno**).
- **Nebo:** 6 paleta — polar-day, midnight-sun (nisko sunce), polar-night (mesec, zvezde), blue-hour, overcast-pastel (bez sunca, sneg u vazduhu češći), ice-fog-dawn (gusta magla).
- **Polarna svetlost:** sopstvena, česta (polarna noć 85%, plavi čas 45%) ali blaga (alpha 0.28–0.42, mešanje „lighter"), 1–3 zavese od vertikalnih stubova duž talasaste krive, zeleno → ljubičasto ka vrhu; odražava se u vodi. Legendarni rarity događaj ostaje jači i poseban.
- **Planine i sante:** fasete senke na strani suprotnoj od sunca (`lightDir`); svetla vodena linija na santama; odraz santi u mirnoj vodi i blag nagoveštaj podvodnog dela.
- **Odraz:** gornja polovina (nebo, polarna svetlost, sunce/mesec, planine, litice, kućice) se crta dva puta — normalno i preslikano preko horizonta (tehnika iz jezera).

### Oluja (samo v2, od 2026-11-20)

- **Lokacije** (QRNG po težinama): **svetionik na moru 40%** (talasi sa penom, stenoviti rt sa liticom, pukotinama i stenama u podnožju, pena koja udara o liticu, svetionik sa crvenim prugama 50% i kućicom 45%, snop svetla u sumraku/noći, galebovi), **usamljeno drvo 35%** (krošnja i grane savijene niz vetar, lišće koje leti, ograda ka horizontu 50%, salaš sa topolama u daljini 45%, bare sa odrazom neba, trava savijena vetrom), **planine 25%** (3 venca sa maglom uz podnožje, dolina, koliba sa upaljenim prozorima i dimom 50%, planinsko jezero 45%, jele u prvom planu).
- **Nebo:** 6 paleta — supercell (zelenkasto), slate (sivo, najgušća kiša), noć, golden-break (sunce ispod oblaka, osvetljene donje ivice), violet-dusk, passing (oluja se povlači na jednu stranu, sunce na vedroj strani, sopstvena duga 50%).
- **Oblaci:** 4 sloja od dalekih (nisko, sitni, u izmaglici) ka bliskim (gore, krupni); spljošteni „jastuci" (elipse 1.6 : 0.6) sa svetlim temenom ka svetlu i tamnim prugama podnožja; daleki kumulonimbus sa nakovnjem 45%.
- **Munje:** 0–2 danju, 1–3 noću; putanja metodom pomeranja sredine (7 nivoa) sa granama; sjaj + belo jezgro; bljesak u oblacima; odraz na moru / u jezeru.
- **Kiša:** 2–4 zavese kiše na horizontu + kosa kiša u prvom planu (ugao = smer vetra, isti za drvo i travu).
- **Retki događaji:** `hooks.sky` se zove **posle** oblaka, inače bi oblačni pokrivač sakrio dugu/kometu.
- **Napomena:** nebo se boji do dna platna, da ispod talasastih ivica tla nikad ne ostane prazan (crn) procep.

### Polja i ravnica (samo v2, od 2026-11-19)

- **Regioni** (QRNG po težinama, ime ispod slike preko `hooks.meta`): **Vojvodina 40%** (suncokret ili žito; drvoredi topola, salaš sa đermom, dudom i plastom sena), **Provansa 30%** (lavanda ili suncokret; planina u daljini, kamena kuća sa čempresima i maslinom), **Toskana 30%** (brežuljci-krpljenac ili vinograd; kuća na brdu sa vijugavim putem i drvoredom čempresa).
- **Nebo:** 6 paleta — morning-mist, noon, golden, sunset, blue-hour (mesec, zvezde, osvetljeni prozori), summer-storm (tamni kumulusi, zavesa kiše); boja svetla (`tint`) i zatamnjenje (`dim`) se primenjuju na tlo, useve i kuće.
- **Polje:** redovi useva kao klinovi ka tački nestajanja (suncokret, lavanda, vinograd sa kočićima); žito bez redova — zlatno polje sa tragovima traktora, talasima vetra i okruglim balama sena (55%); Toskana — krpe različitih useva sa kosim, zakrivljenim međama i brazdama.
- **Prvi plan:** veliki suncokreti (glava okrenuta ka suncu), žbunovi lavande, klasje sa bulkama, loza sa grožđem.

### Savana (samo v2, od 2026-11-19)

- **Palete:** 6 — golden-sunset, red-sunset, noon, dawn-mist, night (mesec, zvezde, Mlečni put), rainy-season (zelena trava, tamni oblaci, zavese kiše); hue ±8.
- **Siluete vs boja:** u zalascima, jutarnjoj izmaglici i noću životinje, drveće i trava su tamne siluete na nebu; podne i kišna sezona su u boji (šare žirafe, kljove i oko slona, pruge zebre, senke ispod drveća).
- **Elementi:** ogromno nisko sunce u zalascima (r 70–130 × s), trake oblaka, planina sa snežnim ravnim vrhom 35%, stenovita uzvišenja (kopje), daleki niz akacija, ravnica sa busenjem, 1–3 velike akacije (račvasto deblo + ravna krošnja), baobab 25%, žirafe 1–3 (50%), slonovi 1–4 sa mladunčetom (40%), krdo antilopa ili zebri 4–12 (50%), visoka trava sa klasovima u prvom planu, ptice 45%. Drveće i životinje sortirani po dubini.

### Podvodni svet (samo v2, od 2026-11-19)

- **Palete:** 6 — tropical-reef, deep-blue, kelp-forest (95% kelpa), sunset-surface (toplo svetlo odozgo), abyss (tamno, bioluminiscencija: svetleće meduze i sase, plankton, riba-udičarka), lagoon-shallow; hue ±10. Raspodela paleta ravnomerna (~16% na 596 podvodnih dana).
- **Slojevi:** voda (svetlo pri površini → dubina), talasasta površina odozdo 45% (ne u ponoru), zraci sa površine, oble daleke stene u 2 sloja, retki događaji, daleko jato, peščano dno sa kaustikama, greben sortiran po dubini (razgranati, lepezasti i mozak-korali, cevasti sunđeri, morske sase, kelp; 18–29 korala, veći bliže), jato duž krive + 2–6 tropskih riba, kornjača 25%, meduze (35%, u ponoru 90%), udičarka (ponor 50%), sidro sa lancem 15%, mehurići.
- **Rarity:** nema neba ni sunca → `hooks.sky({ horizonY: h, light: "underwater" })` (raža / kit / kraken), bez `hooks.body`.

### Gradovi (samo v2, od 2026-11-19)

- **Koncept:** pogled preko reke na grad; registar gradova `CITIES` (ključ, težina, `decide`, `draw`, opciono `boat`) — QRNG bira grad po težinama: **Beograd 35%, Pariz 32.5%, Rim 32.5%**.
- **Beograd — znamenitosti** (QRNG bira, bar 2 u srednjem planu): Hram Svetog Save 75% (dominantan, kupola + ugaone kule + zlatni krstovi), Ušće kule 60%, Beograđanka 45% (tamna kula sa „krunom"), Kula Beograd 40%, Avalski toranj na brdu u daljini 50%, Kalemegdan sa zidinama, drvećem i Pobednikom 55%, Most na Adi (pilon + lepeza kablova) 40%. Oko njih generički grad: socijalistički blokovi, starogradske zgrade sa kosim krovovima, crkveni tornjevi sa baroknim šiljkom.
- **Pariz — znamenitosti:** Ajfelova kula 85% (rešetka klipovana na siluetu, platforme, luk između nogu; noću zlatna, svetlucanje i snopovi reflektora), Sacré-Cœur na Monmartru u daljini 55%, Notre-Dame (kule, rozeta, šiljak, kontrafori) 55%, kameni most sa lukovima 60%; Haussmann zgrade (fasade + sivo-plavi mansardni krovovi sa prozorčićima i dimnjacima), kamen kej; turistički brod (bateau-mouche).
- **Rim — znamenitosti:** kupola Sv. Petra 75% (tambur sa stubovima, rebrasta kupola, fenjer, krst), Koloseum 70% (tri reda lukova u perspektivi + atika, oštećena ivica), Anđeoska tvrđava sa anđelom 45%, Anđeoski most 50%, 2–6 pinija i čempresa; oker/terakota zgrade sa crepom, romanički zvonici, kupolice crkava.
- **Kameni most (Pariz, Rim):** segmentni lukovi — visina kolovoza se računa iz širine luka (centar malo ispod vode), pa luk + odraz daju prepoznatljive elipse.
- **Palete:** 6 — day, golden, sunset, blue-hour, night (mesec, zvezde), winter-fog; noću i u plavom satu osvetljene znamenitosti, upaljeni prozori.
- **Reka:** pravi odraz cele gornje polovine (kao jezero); geometrija grada iz zasebnog PRNG-a sa fiksnim seed-om po slici, pa su normalan prolaz i odraz identični. Splav sa lampicama 35%.
- **Ime grada ispod slike:** novi opcioni hook `hooks.meta({ place })` ([`sky-events.ts`](src/lib/sky-events.ts)) → `RenderResult.meta.place` → [`ArtCanvas`](src/components/ArtCanvas.tsx) dodaje „· Beograd" (prevod `messages/*.json` → `scene.place.*`).

### Plaža (v2, od 2026-11-19)

- **Palete:** 6 — tropical-noon, lagoon (beli pesak), sunset-beach, pastel-morning, moonlit, overcast (pun oblaka); hue ±8.
- **More i obala:** more od tamne dubine pri horizontu ka svetlijoj plićini; obala = kosa linija + blaga krivina; tirkizna traka plićine, mokar pesak, 2–3 talasaste linije pene + mehurići; linije talasa u perspektivi; staza odsjaja.
- **Palme:** 1–4 sa strana, nagnute ka sredini; glatko zakrivljeno stablo (jedna površina, svetla ivica, prstenovi); 7–11 punih listova sa 26 dugih opuštenih lisaka po strani; kokosi. Visina ograničena da krošnja ostane u kadru. (Prva verzija: lišće kao retka „žičana mreža", pa „testera" od kratkih zubaca; stablo od kockica.)
- **Oblaci:** puhasti kumulusi sa ravnim dnom, osvetljeni sa strane sunca (količina po paleti).
- **Detalji:** ostrvo sa palmama na horizontu 35%, jedrilica 25%, suncobran sa senkom 20% (ne noću), školjke i morske zvezde, tekstura peska, galebovi 45%.

### Plaža (v1)

- Nebo plavo (hue 200–240)
- More plavo-tirkiz gradijent

### Noćni grad (v2, od 2026-11-19)

- **Palete:** 6 (midnight, neon-violet, teal, smog-amber, winter, indigo) — svaka ima boju svetlosnog zagađenja pri horizontu, topla i hladna svetla prozora i udeo hladnih prozora.
- **Grad u 3 sloja:** dalji slojevi mešani sa bojom horizonta (0.62 / 0.35 / 0) + izmaglica između slojeva → dubina.
- **Krovovi:** ravni (sa kućicom), stepenasti, toranj sa antenom, kupola, kosi, vodotoranj; ~12% zgrada je 1.6× viša.
- **Prozori:** mreža po spratovima; 25% spratova potpuno mračno, ostali sa različitim udelom upaljenih; topli/hladni po zgradi.
- **Crvena svetla:** samo srednji i bliži sloj, ~35% visokih zgrada (prva verzija ih je imala na svim zgradama — previše).
- **Mesec:** pun (sa blagim „morima") ili srp (45%), meki sjaj; tanki oblaci obasjani mesecom (45%).
- **Reka (50%):** prigušeni odrazi zgrada + vertikalne isprekidane crtice od svetala + odsjaj meseca. **Bez reke:** ulica sa toplim sjajem i svetiljkama (stub + lampa + krug svetla).
- **QRNG vs PRNG:** odluke (paleta, reka, horizont, gustina, mesec) iz QRNG-a; zgrade, prozori, zvezde iz `prngFromStream`.

### Noćni grad (v1)

- Popunjavanje podloge ispod horizonta tamnom bojom (`fillRect`) da ne probija boja prethodnog scenarija (npr. zelena iz Šume)

### Šuma (v2, od 2026-11-19)

- **Koncept:** pogled sa proplanka na šumovitu dolinu (umesto zida od krugova-krošnji u v1).
- **Palete:** 6 — spring-morning (jaka magla), summer, autumn (narandžasto/crveno/žuto lišće po grozdu), golden-hour (jaki zraci), night-fireflies (mesec, zvezde, svici), winter (sneg na jelkama i tlu, golo listopadno drveće); hue ±8.
- **Pozadina:** 4 sloja brda (dve sinusoide) sa siluetama jelki i listopadnog drveća (udeo jelki 30–80%), dalji slojevi u izmaglici, magla između slojeva po jačini palete.
- **Drveće u prvom planu:** 2–4 velika sa strane + 2–5 manjih u srednjem planu proplanka. Jelka = 5–7 slojeva grana sa osvetljenom i senovitom polovinom (+ sneg zimi). Listopadno = deblo sa granama + 12–19 grozdova (senovita osnova, osvetljeni deo pomeren ka suncu, blagi odsjaj); zimi golo sa malo snega.
- **Svetlo:** strana svetla prati sunce; noću hladna mesečina umesto toplog svetla (prva verzija je davala sive jelke).
- **Detalji:** sunčevi zraci (po paleti), travke na proplanku, srna 25%, ptice 40% (danju), svici 40–90 (noću).

### Šuma (v1)

- Svaka krošnja mora imati stablo koje se vidi i doseže do zemlje
- Drveće na različitim visinama (varijabilan baseY)
- Tlo zeleno (travnata podloga)
- Dan: ptice (1–4)
- Noć (25%): sove (1–2) ili šišmiši (1–3)
- Dan: opciono veverica (50% šansa)

### Pustinja (v2, od 2026-11-19)

- **Palete:** 6 — noon, golden-dunes, sahara-sunset, dusk-violet, night (mesec + Mlečni put), red-rock (mese uvek); hue ±8.
- **Dune:** asimetrične (barhan) — blaga osvetljena strana okrenuta suncu (kosinusna kriva), strma senovita strana na suprotnoj; strana svetla po poziciji sunca (`lightDir`). Senka pokriva samo strmu stranu (prva verzija je pravila dugačke dijagonalne „oštrice" do dna slike).
- **Slojevi:** 4–5, dalji mešani sa bojom horizonta; 3–5 dina po sloju; podnožje sloja blago talasasto (prva verzija je imala savršeno ravne trake između dina); svetla linija samo duž stvarnih grebena; jaranice od vetra na bližim slojevima.
- **Detalji:** toplotna izmaglica na horizontu; mese/butte (po paleti, visina 60–150 × s): ravan blago neravan vrh, strma litica, konkavna siparna padina, neprovidna senka klipovana na obris, svaka mesa u svom delu širine (bez preklapanja); karavan kamila na grebenu 2. sloja 25%; saguaro kaktusi (stablo + 1–3 grane, osvetljena ivica, senka na pesku) 30%; oaza sa jezercetom i palmama u udolini srednjeg sloja 15%.
- **Noć:** Mlečni put — dijagonalna traka mekog sjaja + 700 sitnih zvezda + vrlo diskretne prašinaste pruge.

### Pustinja (v1)

- Base sand fill pre crtanja dina da zelena iz prethodnog scenarija ne probija
- Dune oble (ridgePoints sa roughness, detailScale) — ne oštre/račvaste

### Kosmos (v2, od 2026-11-19)

- **Palete magline:** 6 — violet-magenta, teal-blue, emission-red, green-cyan, blue-gold, dark; hue ±10.
- **Kompozicija:** „sistem" (2–4 planete) ili „krupni plan" 35% (ogromna planeta čiji je horizont luk + 1–2 manja tela); spiralna galaksija 20%; zvezda u kadru 60% (difrakcioni zraci), inače sjaj sa strane.
- **Planete (5 tipova):** gasni džin (talasaste trake, olujna pega), stenovita (krateri), okeanska (kontinenti, oblaci, polarna kapa), ledena (pruge, kapa), vulkanska (glatke užarene pukotine). Svima: zatamnjenje ka ivici, noćna strana suprotno od zvezde, odsjaj, svetli obod; atmosfera; prstenovi kao trake sa procepima (zadnja/prednja polovina); meseci.
- **Podešavanje:** planete se deterministički odmiču od zvezde (prva verzija je imala planetu preko zvezde); velike planete imaju uže trake + zatamnjenje ka ivici (krupni plan je bio „ravan"); pukotine su bile škrabotine → glatke krive sa granama.

### Kosmos (v1)

- Zvezde se crtaju pre planeta (da ostanu iza planeta)
- Planete: paleta od 6 tipova boja; jedan zajednički izvor svetla (sunce) — hotspot gradijenta usmeren prema suncu; tamnija noćna polutka (0.02 na ivici); prstenovi za veće planete (pr≥70)

### Jezero (v2, od 2026-11-19)

- **Koncept:** planinsko jezero kao ogledalo. Gornja polovina (nebo, zvezde, sunce/mesec, oblaci, planine, šuma) crta se **dva puta**: normalno, pa preslikana preko horizonta (`translate(0, 2·horizonY)` + `scale(1, -1)`, klip na vodu). Geometrija se izračuna unapred, pa su oba prolaza identična.
- **Palete:** 6 — dawn-mist (jaka magla), day, golden, dusk, night (mesec + zvezde), alpine-clear; hue ±8.
- **Planine:** 2 sloja; greben = glavni vrhovi sa konkavnim padinama + 1–2 pomoćna vrha + šum u 3 oktave jači pri vrhu (prva verzija su bili čisti trouglovi). Sneg na dalekim vrhovima po verovatnoći palete; izmaglica između slojeva.
- **Voda:** ispod dometa odraza boja zenita (prva verzija je imala tamnu traku na dnu); zatamnjenje ka dubini; talasići (svetle/tamne crtice, gušći bliže); staza odsjaja sunca/meseca; magla (po paleti).
- **Prednji plan:** drveni mol u perspektivi 28%, čamac sa veslom 22%, trska/rogoz 50%; ptice 35% (danju).
- **Rarity:** `hooks.sky` samo u normalnom prolazu (događaji se ne preslikavaju), `hooks.body` za sunce/mesec.

### Jezero (v1)

- Horizont 1/3–2/3 (voda zauzima ~2/3 visine)
- Brda kao uska traka na horizontu, ne do dna slike
- Refleks sunca/meseca — jedan radijalni gradijent (meko), bez višestrukih kružnica
- Ptice u nebu
- Voda plava (waterHue 200–235); brda plava (hillHue 210–240), ne zelena

---

## Verzionisanje renderera (render v1 / v2)

**Zašto:** Svaka slika se crta iz sačuvanih brojeva (slika dana iz datuma, favoriti iz baze). Bez verzionisanja bi svaka izmena scenarija retroaktivno promenila **celu arhivu** i sve sačuvane favorite.

**Kako:**

- **v1** — zamrznuta kopija scenarija u [`src/lib/scenarios/v1/`](src/lib/scenarios/v1/) (router, svih 8 scenarija, `landscape.ts`, `draw-utils.ts`, `tree-lsystem.ts`, `color.ts`). **Ništa se tu ne menja**, nikad.
- **v2** — aktivni kod u [`src/lib/scenarios/*.ts`](src/lib/scenarios/), `src/lib/landscape.ts`, `draw-utils.ts`… Sva vizuelna poboljšanja i novi scenariji idu ovde.
- [`src/lib/render-version.ts`](src/lib/render-version.ts) određuje verziju **po datumu** (Europe/Belgrade):
  - datum `< RENDER_V2_FROM` → v1, datum `>= RENDER_V2_FROM` → v2
  - `RENDER_V2_FROM` dolazi iz `NEXT_PUBLIC_RENDER_V2_FROM`; ako nije postavljen, podrazumevano je **`2000-01-01` → cela arhiva (svi datumi, thumbnailovi, OG, favoriti) je v2**. Odluka 2026-11-19: sajt skoro nije korišćen, pa nema razloga čuvati stari izgled. v1 kod ostaje u repou; ako zatreba, env promenljivom se datum prelaska može pomeriti unapred (vidi [DEPLOY-CHECKLIST.md](DEPLOY-CHECKLIST.md)).
- `renderArt(ctx, stream, w, h, version)` u [`router.ts`](src/lib/scenarios/router.ts) — bez `version` crta najnoviju (v2).

### Rarity sistem — retki nebeski događaji (samo v2)

**Nivo retkosti** — [`src/lib/rarity.ts`](src/lib/rarity.ts): FNV-1a hash nad svih 1000 brojeva → 70% običan, 20% redak, 8% epski, 2% legendaran (provereno na 1500 dana: 68 / 21 / 8.6 / 2%). Ne troši `QRNGStream`, pa **obični dani izgledaju piksel-identično** kao bez rarity sistema.

**Događaj zavisi od scene** — [`src/lib/sky-events.ts`](src/lib/sky-events.ts):

| Nivo | Noć | Sumrak | Dan |
|---|---|---|---|
| Redak | zvezde padalice | duga | duga |
| Epski | polarna svetlost (55%, ako ima horizont) / kometa | kometa | dupla duga |
| Legendaran (30% glitch) | krvavi mesec | pomračenje Sunca | pomračenje Sunca |

**Pod vodom** (`light: "underwater"`, scenario Podvodni svet): redak = **raža**, epski = **kit** (grbavac u daljini), legendaran = **kraken** (pipci iz dubine, iza grebena) ili 30% glitch. Crtaju se odmah u `sky()` (ispred dalekih stena, iza grebena).

Ako scena nema odgovarajuće telo (npr. kosmos nema mesec ni sunce za pomračenje), legendarni događaj postaje **kvantni glitch** (trake piksela pomerene levo/desno + razdvojen crveni kanal).

**Hook-ovi u scenarijima** — svaki v2 scenario prima opcioni `hooks: SceneHooks`:

- `hooks.sky({ horizonY, light, hasHorizon })` — odmah posle neba, **pre prednjeg plana**, pa su duga/kometa/polarna svetlost iza drveća, zgrada i planina (klipovano na `y < horizonY`).
- `hooks.body({ x, y, r, kind })` — posle sunca/meseca; pomračenje i krvavi mesec crtaju se posle scene, pre post-fx-a.

`renderArt` vraća `RenderResult { version, scenarioIndex, rarity }`. [`ArtCanvas`](src/components/ArtCanvas.tsx) ispod slike prikazuje oznaku (npr. „✦ Epsko · Kometa"), prevodi su u `messages/*.json` → `rarity`.

**Novi scenario:** pozvati `hooks.sky(...)` posle neba i `hooks.body(...)` posle sunca/meseca — bez toga dobija samo legendarni glitch.

### Post-fx sloj (samo v2)

[`src/lib/post-fx.ts`](src/lib/post-fx.ts) — poziva se na kraju `renderArt` za v2, posle scenarija. Jedan prolaz kroz piksele (`getImageData`/`putImageData`), **bez `ctx.filter` i composite modova**, da browser i server (`@napi-rs/canvas`) daju isti rezultat.

| Efekat | Opseg | Napomena |
|---|---|---|
| S-kontrast | 0.12–0.24 | mešavina linearne i smoothstep krive po kanalu |
| Split-tone | jačina 0.4–0.75 | 5 kuriranih parova (amber-teal, peach-violet, gold-blue, rose-indigo, neutral-warm); senke imaju vrh oko L≈0.33 i opadaju ka crnoj, da tamne površine ne dobiju plavi cast |
| Vinjeta | 0.20–0.34 | eliptična, smoothstep od 35% udaljenosti |
| Film grain | 4–8 (0–255) | monohromatski, `mulberry32` PRNG, najvidljiviji u srednjim tonovima; skaliran sa širinom (thumbnail 600px dobija pola) |

Parametri se biraju iz QRNG stream-a **posle** scene (2 vrednosti za seed + 5 za parametre), pa ne menjaju samu kompoziciju.

**Ko koju verziju koristi:**

| Mesto | Verzija |
|---|---|
| Slika dana, `/art/[date]`, arhiva, `/api/og-image` | po datumu slike (`renderVersionForDate`) |
| `/create-art` — novi brojevi (ručno, „Nasumično", „Današnja") | po današnjem datumu (`currentRenderVersion`) |
| Favorit (profil, `/f/[token]`, otvaranje u `/create-art`) | po datumu nastanka favorita (`renderVersionForTimestamp(createdAt)`) |

**Keš thumbnail/OG slika — `RENDER_REVISION`:** `/api/og-image` kešira u memoriji (LRU), a odgovor ima `max-age=3600, s-maxage=86400` (browser/CDN). Da se posle izmene izgleda ne služi stara slika:

- `RENDER_REVISION` u [`render-version.ts`](src/lib/render-version.ts) (`{ 1: "1", 2: "2.1" }`) ulazi u ključ memorijskog keša, a [`ArchiveThumbnail`](src/components/ArchiveThumbnail.tsx) dodaje `&r=<revizija>` u URL, pa browser i CDN dobijaju novi URL.
- **Pravilo:** pri svakoj vizuelnoj izmeni v2 koja ide na produkciju povećaj v2 reviziju (`2.1` → `2.2` …). v1 se nikad ne menja. Dok v2 nije prvi put deploy-ovan, revizija ostaje `2.1`.
- **Development:** bez ikakvog keša (`Cache-Control: no-store`, bez LRU), pa se izmene renderera odmah vide u arhivi.

**Poznato ograničenje:** favorit sačuvan danas iz *stare* arhivske slike (v1 datum) prikazuje se u v2, jer favorit ne pamti datum slike, samo datum snimanja. Rešava se kolonom `renderVersion` u `Favorite` tabeli kad bude potrebno.

**Provera determinističnosti:** pri uvođenju je v1 renderovan za 8 datuma (2026-11-10 … 2026-11-18) i hash piksela je identičan kodu pre izmene.

---

## Otvorena pitanja / TODO

- **Slika dana nije kvantna.** `/api/art/[date]` i `/api/og-image` koriste `seedFromDate()` iz [`src/lib/qrng-server.ts`](src/lib/qrng-server.ts): SHA-256 hash datuma → xorshift → 1000 brojeva. ANU QRNG i `qrng_pool` koristi samo `/api/generate` (`/create-art`, `/algorithmic`). Plan za kasnije: tabela `daily_art` (datum → 1000 brojeva), prvi zahtev dana uzima red iz `qrng_pool` i trajno ga vezuje za datum; stari datumi ostaju na `seedFromDate` da se arhiva ne promeni. Preduslov za sertifikat / „Usvoji dan" iz [CLAUDE-DEVELOPMENT-PROPOSAL.md](CLAUDE-DEVELOPMENT-PROPOSAL.md).

---

## Algoritmički art (`/algorithmic`) — layout u `<style>`

**Zašto:** Na Next.js 16 + Turbopack + Tailwind v4, responsive utility klase (`md:flex-row` itd.) za ovu stranu ponekad **ne daju očekivani desktop layout** (panel i platno ostaju jedan ispod drugog). Zato je raspored rešen **čistim CSS-om** u ugrađenom `<style>` bloku u [`src/app/algorithmic/page.tsx`](src/app/algorithmic/page.tsx), ne kroz Tailwind breakpoint-e za tu osu.

**Ponašanje:**

- **Uski ekran:** kolona — prvo sidebar (dugmad + parametri), ispod desna kolona (platno, QRNG otkrivanje, priča).
- **≥ 48rem (768px):** red — **levo** fiksni sidebar `20rem`, **desno** elastična kolona (`flex: 1 1 0%`, `min-width: 0`) sa platnom i tekstom ispod.

**Korišćene klase:** `algo-art-workspace` (spoljašnji flex kontejner), `algo-art-sidebar` (`<aside>`), `algo-art-main` (desna kolona).

**CSS (kopija logike — izvor istine je u `page.tsx`):**

```css
.algo-art-workspace {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
.algo-art-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
}
.algo-art-main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1 1 0%;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
@media (min-width: 48rem) {
  .algo-art-workspace {
    flex-direction: row !important;
    align-items: flex-start;
    gap: 2rem;
  }
  .algo-art-sidebar {
    width: 20rem;
    max-width: 20rem;
  }
  .algo-art-main {
    width: auto;
    flex: 1 1 0%;
    min-width: 0;
  }
}
```

**U JSX-u** spoljašnji wrapper koristi `className="algo-art-workspace"`, parametarski panel `className="algo-art-sidebar"`, blok sa platnom i pričom `className="algo-art-main"`. `flex-direction: row !important` na desktopu namerno pojačava prioritet da drugi stilovi ne vrate kolonu.

**Napomena:** Ako menjaš raspored, prvo ažuriraj `<style>` u `algorithmic/page.tsx`, zatim ovaj odeljak u README da ostanu usklađeni.

### LUMEN-inspirisane funkcije (studio)

- **Share preset (`QAL1.` kod):** `/algorithmic?code=...` — philosophy, parametri i 1000 QRNG vrednosti.
- **Randomize style:** nasumični parametri uz lock filozofije/palete.
- **Hi-res PNG export:** 1200×675, 2400×1350, 3840×2160 (offscreen render).
- **Set export:** 4–12 varijacija istog stila u ZIP-u.
- **WebM loop (flow-field):** deterministički loop preko `loopPhase`.
- **Favorites `algoPreset`:** pun snapshot preset-a u bazi (kolona `algoPreset` JSON).

---

## Projektna struktura

```
src/
├── app/
│   ├── page.tsx              # Početna — današnji art
│   ├── layout.tsx            # Root layout + Providers (SessionProvider)
│   ├── create-art/page.tsx   # Igraonica — unesi 1000 brojeva, generiši, preuzmi PNG, snimi u omiljene
│   ├── algorithmic/page.tsx # Algoritmički art — layout u <style> (vidi sekciju u README)
│   ├── art/[date]/page.tsx   # Art po datumu — strelice ‹ › preko slike (i tasteri ←/→) za prethodni/sledeći dan
│   ├── archive/page.tsx      # Arhiva (od ARCHIVE_START = 2026-03-04 do danas)
│   ├── login/page.tsx        # Prijava / registracija
│   ├── profile/page.tsx      # Profil — omiljene slike korisnika
│   ├── f/[token]/page.tsx   # Javno deljenje omiljene slike
│   └── api/
│       ├── generate/route.ts      # GET → ANU QRNG ili entropy fallback
│       ├── art/[date]/route.ts    # GET → art za datum
│       ├── og-image/route.ts      # GET → PNG slika dana (Open Graph)
│       ├── auth/[...nextauth]/route.ts  # NextAuth GET/POST
│       ├── auth/register/route.ts # POST — registracija korisnika
│       └── favorites/
│           ├── route.ts           # GET (lista) + POST (dodaj)
│           └── [id]/route.ts     # GET, DELETE, PATCH (ažuriraj naslov/javnost)
├── lib/
│   ├── qrng.ts, qrng-server.ts
│   ├── color.ts, draw-utils.ts, date.ts  # date.ts: getTodayBelgrade, ARCHIVE_START, shiftDate, archiveNeighbors
│   ├── auth.ts                 # NextAuth konfiguracija (Credentials + Drizzle)
│   ├── db.ts                   # Drizzle + mysql2 connection pool
│   ├── schema.ts               # Drizzle šema (User, Favorite)
│   ├── landscape.ts
│   ├── tree-lsystem.ts         # L-system rekurentno grananje (drveće)
│   ├── render-version.ts       # Verzija renderera po datumu (v1 zamrznut / v2 aktivan)
│   ├── post-fx.ts              # v2 post-fx: kontrast, split-tone, vinjeta, grain
│   ├── prng.ts                 # mulberry32 + prngFromStream (sitni detalji u v2)
│   ├── rarity.ts               # nivo retkosti iz hash-a 1000 brojeva
│   ├── sky-events.ts           # hook-ovi scenarija + crtanje retkih događaja
│   └── scenarios/
│       ├── router.ts, index.ts # renderArt(..., version) — v2 + dispatch na v1
│       ├── beach.ts, ocean-sunset.ts, desert.ts
│       ├── city-night.ts, cosmos.ts, forest.ts, lake.ts
│       └── v1/                 # ZAMRZNUT render v1 (ne menjati — arhiva)
└── components/
    ├── ArtCanvas.tsx, Header.tsx, Providers.tsx
    ├── DailyArtSection.tsx, ArtPageContent.tsx
    ├── ArchiveThumbnail.tsx, QRNGReveal.tsx
    └── SaveFavoriteButton.tsx   # Modal za snimanje u omiljene

drizzle.config.ts   # Drizzle Kit konfiguracija
drizzle/
└── 0000_init.sql   # SQL fallback za inicijalizaciju (User, Favorite)

# prisma/ — legacy (više se ne koristi, projekat koristi Drizzle)
```

---

## Pokretanje

### Preduslovi

- **Node.js** 18+ (preporučeno 20+)
- **MySQL** — baza za korisnike i omiljene

### 1. Instalacija MySQL-a (Linux)

```bash
sudo apt update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

### 2. Kreiranje baze i korisnika

```bash
sudo mysql -u root -p
```

U MySQL konzoli:

```sql
CREATE DATABASE qrng_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'qrng_user'@'localhost' IDENTIFIED BY 'tvoja_lozinka';
GRANT ALL PRIVILEGES ON qrng_db.* TO 'qrng_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Instalacija zavisnosti

```bash
npm install
```

### 4. Konfiguracija okruženja

Kreiraj `.env.local` u root folderu (ili `.env`):

```env
# Obavezno za Auth.js
AUTH_SECRET="nasumicni-dugacak-string-minimum-32-karaktera"

# Obavezno za Drizzle/MySQL
DATABASE_URL="mysql://qrng_user:tvoja_lozinka@localhost:3306/qrng_db"

# Opciono — apsolutni URL sajta (za OG slike, share linkove)
NEXTAUTH_URL="http://localhost:9500"

# Opciono — od kog datuma se crta render v2 (YYYY-MM-DD). Bez ovoga: 2000-01-01 (sve v2)
NEXT_PUBLIC_RENDER_V2_FROM="2000-01-01"
```

- **AUTH_SECRET** — generiši sa `openssl rand -base64 32`
- **DATABASE_URL** — format za MySQL: `mysql://user:pass@host:port/dbname`
- **NEXTAUTH_URL** — u produkciji postavi na realan domen (npr. `https://qrng-art.com`)
- **NEXT_PUBLIC_RENDER_V2_FROM** — opciono, datum prelaska na render v2 (vidi [Verzionisanje renderera](#verzionisanje-renderera-render-v1--v2)). Podrazumevano i u `.env.development`: `2000-01-01` (sve v2).

### 5. Inicijalizacija baze (Drizzle)

**Opcija A — Drizzle push (preporučeno):**

```bash
npm run db:push
```

**Opcija B — Ručni SQL (ako db:push ne radi):**

```bash
mysql -u qrng_user -p qrng_db < drizzle/0000_init.sql
```

### 6. Pokretanje razvojnog servera

```bash
npm run dev
```

Aplikacija je dostupna na **http://localhost:9500**.

### npm skripte

| Skripta | Opis |
|---------|------|
| `npm run dev` | Razvojni server (Next.js) na portu 9500 |
| `npm run build` | Build za produkciju |
| `npm start` | Pokreće produkcijsku verziju (posle `npm run build`) |
| `npm run lint` | ESLint provera |
| `npm run db:push` | Drizzle: push šeme u bazu (kreira/ ažurira tabele) |
| `npm run db:generate` | Drizzle: generiše SQL migracije iz schema.ts |
| `npm run db:migrate` | Drizzle: primenjuje generisane migracije |

---

## Novi paketi i funkcije

### Drizzle ORM + mysql2

- **Šta radi:** Povezuje aplikaciju sa MySQL bazom. Schema (`src/lib/schema.ts`) definiše modele: `User`, `Favorite`. Connection pool u `src/lib/db.ts`.
- **Zašto:** Auth.js treba tabelu korisnika; omiljene slike čuvaju `values` (1000 uint16) i metapodatke. Drizzle je lakši od Prisma za Hostinger (bez Rust query engine procesa).

### NextAuth (Auth.js v5)

- **Šta radi:** Autentifikacija — prijava/odjava, sesija, JWT. Credentials provider (email + lozinka). Sesije u JWT-u (bez database sesija).
- **Zašto:** Korisnici mogu da se registruju, prijave i snime omiljene slike.
- **Rute:** `/login`, `/api/auth/*`

### bcryptjs

- **Šta radi:** Hash-uje lozinke pre čuvanja u bazi. Nikad plain text.
- **Gde se koristi:** Registracija (`/api/auth/register`), Credentials provider u `auth.ts`.

### @napi-rs/canvas

- **Šta radi:** Server-side canvas rendering (Node.js). Koristi se za OG slike (`/api/og-image`).
- **Zašto:** Za share linkove (Viber, Facebook…) potrebna je stvarna PNG slika, ne React komponenta.

### next-intl

- **Šta radi:** Internacionalizacija — prevodi UI stringove iz `messages/sr.json`.
- **Zašto:** Ceo sajt na srpskom (šuma, Igraonica, Slika dana, itd.).

---

## API

| Endpoint | Opis |
|----------|------|
| `GET /api/generate` | Vraća 1000 uint16 vrednosti (ANU QRNG ili crypto fallback) |
| `GET /api/art/[date]` | Vraća art za datum (YYYY-MM-DD) — `{ values: number[] }` |
| `GET /api/og-image` | Vraća PNG sliku dana (1200×675) za og:image |
| `GET/POST /api/auth/[...nextauth]` | NextAuth rute (callback, session, signIn/Out) |
| `POST /api/auth/register` | Registracija (email, lozinka, ime) |
| `GET /api/favorites` | Lista omiljenih (za ulogovanog korisnika) |
| `POST /api/favorites` | Dodaj u omiljene (values, title?, scenarioName?, isPublic?) |
| `GET /api/favorites/[id]` | Jedna omiljena |
| `DELETE /api/favorites/[id]` | Obriši omiljenu |
| `PATCH /api/favorites/[id]` | Ažuriraj (title, isPublic) |

---

## Changelog

Svaki update aplikacije se beleži ovde. Format: datum, scenarij/fajl, opis promene. **Detaljne izmene scenarija** vidi u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija).

### 2026-11-20 — Novi scenario: Arktik / fjord (grana `claude`)

- **`src/lib/scenarios/arctic.ts`** — NOVO (scenario 13, samo v2): 3 lokacije sa težinama 40 / 30 / 30 (fjord, presek kroz vodu sa santom, ledena obala), 6 paleta (polarni dan, ponoćno sunce, polarna noć, plavi čas, oblačno pastelno, maglovita zora), sopstvena blaga polarna svetlost, snežne planine sa fasetama, litice fjorda u 3 sloja, sante (tabularne i šiljaste) sa podvodnim delom, ledene ploče, polarni medved ILI pingvini (nikad zajedno), kit (rep ili u dubini), crvene kućice, iglo, kućica sa dimom, sneg u vazduhu. Pravi odraz u vodi kao u jezeru. Dimenzije relativne (`s = w/1200`).
- **`src/lib/scenarios/router.ts`, `index.ts`** — `NUM_SCENARIOS_V2 = 14`, `SCENARIO_NAMES[13] = "Arktik"`.
- **`messages/*.json`** — `scenario.s13`: Arktik / Arctic.
- **Podešavanje** — litice su prvo bile nazubljene kao češalj (prejak sitan šum, previše žlebova) → masivniji zidovi, sneg samo na blagim delovima ivice umesto bele konture; podvodni deo sante je bio pravilan polukrug sa radijalnim linijama → nepravilan obris (glatki šum, nagib) sa fasetama; medved se nije video na snegu → topliji ton, kontura i gradijent tela, nova silueta; senka na planinama imala oštru vertikalnu ivicu → prati padinu. Šiljasta santa je imala pokidan obris (tačke van širine sante + sortiranje po x presavijali su poligon, npr. 2026-11-15) → obris se gradi redom po x, sve tačke unutar širine; lepeza svetlih trouglova u podvodnom delu (izgledala kao zraci) → blage vertikalne fasete od vodene linije ka obodu.
- **Posledica** — v2 dani preraspoređeni po 14 scenarija (~7.1% svaki, raspodela na 4000 dana 6.5–7.7%); lokalno arktik: 2026-11-14, 2026-11-15, 2026-11-17.
- **Verifikacija** — pregled 24 datuma + puna veličina (obala sa medvedom, fjord sa kitom, fjord danju); render 32–63 ms. v1 hash nepromenjen (30 dana, kod iz HEAD naspram radnog stabla). `tsc` i ESLint prolaze.

### 2026-11-20 — Ime scenarija svuda (naslovna, slika po datumu, arhiva) (grana `claude`)

- **`src/components/ArtCanvas.tsx`** — natpis ispod slike sada uvek sadrži scenario: „Slika za {datum} · {scenario}" i, kad scenario prijavi mesto, „· {mesto}" (npr. „Slika za 2026-11-20 · Gradovi · Rim"). Indeks dolazi iz `RenderResult.scenarioIndex`. Važi za naslovnu (`DailyArtSection`) i `/art/[date]`. U igraonici (bez datuma) se ne dodaje, jer tamo već postoji red „Scenarij: …".
- **`src/app/archive/page.tsx`, `src/components/MonthAccordion.tsx`** — ispod datuma na svakoj sličici arhive ime scenarija. Računa ga server iz istih brojeva kao `/api/art/[date]` (`seedFromDate` + `scenarioIndexFor` po verziji renderera), za tekući mesec i za zatvorene mesece (prop `scenarios`).
- **`messages/*.json`** — novi namespace `scenario` (`s0`–`s12`): Pejzaž / Landscape, Plaža / Beach, Zalazak / Sunset, Pustinja / Desert, Noćni grad / Night city, Kosmos / Cosmos, Šuma / Forest, Jezero / Lake, Gradovi / Cities, Podvodni svet / Underwater, Savana / Savanna, Polja / Fields, Oluja / Storm. **Pri dodavanju novog scenarija dodati i `s{N}` u oba fajla.**
- **Verifikacija** — screenshot naslovne, `/art/2026-11-18` i arhive; `tsc` i ESLint prolaze.

### 2026-11-20 — Novi scenario: Oluja (svetionik, usamljeno drvo, planine) (grana `claude`)

- **`src/lib/scenarios/storm.ts`** — NOVO (scenario 12, samo v2): 3 lokacije sa težinama 40 / 35 / 25, 6 paleta (supercell, slate, noć, zlatni proboj, ljubičasti sumrak, oluja prolazi), slojeviti olujni oblaci, kumulonimbus sa nakovnjem, munje sa grananjem i bljeskom, zavese kiše, kosa kiša po smeru vetra, sopstvena duga kad oluja prolazi. Dimenzije relativne (`s = w/1200`). Bez `Path2D` (nije globalan u `@napi-rs/canvas`).
- **`src/lib/scenarios/router.ts`, `index.ts`** — `NUM_SCENARIOS_V2 = 13`, `SCENARIO_NAMES[12] = "Oluja"`.
- **Podešavanje** — oblaci su prvo bili okrugli „mehurići" → spljošteni slojevi; rt je bio ravan zeleni zid → stena sa plohom litice, pukotinama, stenama i linijom pene, veći svetionik; krošnja drveta → jedna masa sa svetlijim pramenovima; tanka crna linija na horizontu (prazan procep između neba i tla) → nebo do dna; oštra ivica magle u planinama → gradijent koji bledi.
- **Posledica** — v2 dani preraspoređeni po 13 scenarija (~7.7% svaki); lokalno oluja: 2026-11-29.
- **Verifikacija** — pregled 24 datuma + puna veličina (svetionik u slate i zlatnom proboju, drvo, planine noću i sa dugom) + thumbnail; render 46–73 ms. v1 hash nepromenjen. `tsc` i ESLint prolaze.

### 2026-11-20 — Arhiva: navigacija na prethodni/sledeći dan (grana `claude`)

- **`src/components/ArtPageContent.tsx`** — navigacija prethodni / sledeći dan na stranici `/art/[date]`:
  - Okrugle „frosted glass" strelice (44px desktop / 36px mobilni, poluprovidna crna + `backdrop-blur`, bela SVG strelica) preko leve i desne ivice slike, centrirane po visini. **Leva vodi na noviji dan, desna na stariji** (listanje arhive unazad).
  - Na desktopu su prigušene dok miš nije nad slikom, a pune na hover slike / strelice. Na uređajima na dodir su uvek vidljive. Tooltip i `aria-label` sadrže ciljni dan („Prethodni dan · 18. nov").
  - Na prvom danu arhive desna strelica se ne prikazuje, a na današnjem leva. Tasteri ← (noviji) / → (stariji) rade isto (ne dok se kuca u polje ili sa modifikatorima). Susedne stranice se prefetch-uju. Susedni dani se računaju na klijentu (danas po Beogradu), pa keširana stranica ne nudi „sutra".
  - Zaglavlje (naslov + „Sačuvaj") poravnato je sa širinom slike.
- **`src/components/ArtCanvas.tsx`** — novi opcioni prop `overlay` koji se crta preko samog platna (`group/art` za hover), pa su strelice centrirane na sliku bez obzira na natpis i oznaku retkosti ispod.
- **`src/lib/date.ts`** — `ARCHIVE_START` (premešten iz arhive), `shiftDate(date, days)` (UTC aritmetika, bez DST problema), `archiveNeighbors(date, today?)`.
- **`src/app/archive/page.tsx`** — koristi `ARCHIVE_START` iz `date.ts` umesto lokalne konstante.
- **`messages/*.json`** — `art.prev`, `art.next` (aria-label / tooltip strelica).
- **Verifikacija** — screenshot (desktop, mobilni, svetla i tamna tema, prvi dan arhive); `tsc` i ESLint prolaze (jedno postojeće upozorenje u `ArtPageContent`).

### 2026-11-19 — Novi scenario: Polja i ravnica (Vojvodina, Provansa, Toskana) (grana `claude`)

- **`src/lib/scenarios/fields.ts`** — NOVO (scenario 11, samo v2): 3 regiona sa težinama 40 / 30 / 30, 6 paleta neba (uklj. letnju oluju i plavi sat), redovi useva u perspektivi (suncokret, lavanda, vinograd), žito sa tragovima traktora i balama sena, toskanski brežuljci-krpljenac, salaš sa đermom, provansalska kamena kuća, toskanska kuća na brdu sa putem i čempresima, prvi plan (suncokreti, lavanda, klasje i bulke, loza). Dimenzije relativne (`s = w/1200`).
- **`src/lib/scenarios/router.ts`, `index.ts`** — `NUM_SCENARIOS_V2 = 12`, `SCENARIO_NAMES[11] = "Polja"`.
- **`messages/sr.json`, `messages/en.json`** — `scene.place.vojvodina`, `provence` (Provansa / Provence), `tuscany` (Toskana / Tuscany).
- **Podešavanje** — toskanske krpe su bile pravougaonici sa vertikalnim ivicama i horizontalnim trakama senke → kose zakrivljene međe, bez traka; prazno žito → tragovi traktora + okrugle bale sena.
- **Posledica** — v2 dani preraspoređeni po 12 scenarija (~8% svaki); lokalno polja: 2026-11-21, 11-28.
- **Verifikacija** — pregled 12 datuma + puna veličina (Toskana, Vojvodina sa balama) + thumbnail; regioni na 150 dana: 39 / 32 / 29%. v1 hash nepromenjen. `tsc` i ESLint prolaze.

### 2026-11-19 — Novi scenario: Savana (grana `claude`)

- **`src/lib/scenarios/savanna.ts`** — NOVO (scenario 10, samo v2): 6 paleta, ogromno nisko sunce, Mlečni put noću, trake oblaka i zavese kiše, Kilimandžaro, kopje, akacije, baobab, žirafe, slonovi (sa mladunčetom), antilope ili zebre, visoka trava, ptice. Siluete u zalasku/noći, boja danju. Dimenzije relativne (`s = w/1200`).
- **`src/lib/scenarios/router.ts`, `index.ts`** — `NUM_SCENARIOS_V2 = 11`, `SCENARIO_NAMES[10] = "Savana"`.
- **Podešavanje** — životinje su bile previše sitne → oko 1.6× veće (akacije 1.2×); žirafe kao „štule" → krupniji trup, deblje noge, širi vrat pri telu.
- **Posledica** — v2 dani preraspoređeni po 11 scenarija (~9% svaki).
- **Verifikacija** — pregled 12 datuma + puna veličina (zlatni zalazak sa slonovima, podne sa žirafama) + thumbnail; render 32–68 ms. v1 hash nepromenjen. `tsc` i ESLint prolaze.

### 2026-11-19 — Cela arhiva prelazi na render v2 (grana `claude`)

- **Odluka** — sajt skoro nije korišćen, pa nema razloga čuvati stari (v1) izgled starih datuma: svi datumi, thumbnailovi, OG slike i favoriti crtaju se u v2.
- **`src/lib/render-version.ts`** — `DEFAULT_V2_FROM` sa `2099-01-01` na `2000-01-01`. Produkcija posle spajanja automatski ide na v2, bez env promenljive. v1 kod (`scenarios/v1/`) ostaje u repou kao osiguranje.
- **`.env.development`** — `NEXT_PUBLIC_RENDER_V2_FROM=2000-01-01`.
- **Keš** — thumbnail URL za stare datume prelazi sa `&r=1` na `&r=2.1`, pa browser/CDN ne služe stare slike.
- **Poznato** — favoriti sačuvani ranije imaju upisano ime scenarija po staroj (v1) raspodeli; slika se sada crta u v2, pa ime u profilu može da se ne poklapa sa slikom (zanemarljivo — skoro nema korisnika).
- **README / DEPLOY-CHECKLIST** — ažurirani opis podrazumevane vrednosti i korak 2a (env promenljiva više nije potrebna).

### 2026-11-19 — Novi scenario: Podvodni svet + podvodni retki događaji (grana `claude`)

- **`src/lib/scenarios/underwater.ts`** — NOVO (scenario 9, samo v2): 6 paleta (uklj. ponor sa bioluminiscencijom i šumu kelpa), površina odozdo, zraci, kaustike, greben (razgranati, lepezasti i mozak-korali, sunđeri, sase, kelp), jata i tropske ribe, kornjača, meduze, riba-udičarka, sidro, plankton, mehurići. Dimenzije relativne (`s = w/1200`).
- **`src/lib/sky-events.ts`, `src/lib/rarity.ts`** — `SkyLight` dobija `"underwater"`; novi događaji `manta` (raža, redak), `whale` (kit, epski), `kraken` (legendaran; 30% glitch).
- **`src/lib/scenarios/router.ts`, `index.ts`** — `NUM_SCENARIOS_V2 = 10`, `SCENARIO_NAMES[9] = "Podvodni svet"`.
- **`src/components/ArtCanvas.tsx`, `messages/*.json`** — oznake: Raža / Manta ray, Kit / Whale, Kraken.
- **Podešavanje** — kraken je bio tanke crvene linije → debeli senčeni pipci sa pijavkama; pipci odsečeni (klip na dno, pa preko njih tamne stene) → događaji posle dalekih stena, klip na celu visinu; greben redak i sitan → 18–29 korala, veći bliže; daleke stene kao stepenasti obris grada → oble stene.
- **Posledica** — v2 dani preraspoređeni po 10 scenarija (~10% svaki); lokalno podvodni svet: 2026-11-04, 11-17, 11-26.
- **Verifikacija** — pregled 12 datuma + puna veličina (ponor sa krakenom, laguna) + thumbnail; render 33–90 ms; raspodela paleta ravnomerna. v1 hash nepromenjen. `tsc` i ESLint prolaze.

### 2026-11-19 — Gradovi: Pariz i Rim (grana `claude`)

- **`src/lib/scenarios/cities.ts`** — dodati **Pariz** (Ajfelova kula sa rešetkom i noćnim snopovima, Sacré-Cœur, Notre-Dame, Haussmann zgrade sa mansardama, kameni most, bateau-mouche) i **Rim** (kupola Sv. Petra, Koloseum, Anđeoska tvrđava, Anđeoski most, pinije i čempresi, oker/terakota zgrade, zvonici). Težine: Beograd 35, Pariz 32.5, Rim 32.5. `CityDef.boat` (splav / bateau-mouche; Rim bez plovila). Zajednički `drawStoneBridge` sa segmentnim lukovima.
- **Izmaglica nad gradom** — malo slabija za sve gradove (0.15 + 0.4 × fog, ranije 0.25 + 0.45 × fog).
- **`messages/sr.json`, `messages/en.json`** — `scene.place.paris` (Pariz / Paris), `scene.place.rome` (Rim / Rome).
- **Podešavanje** — lukovi mosta su bili ogromne polulopte iznad kolovoza, pa ravna ploča sa rupama → kolovoz iz širine luka, segmentni lukovi; pinije veće krošnje; Pariz previše izbledeo → tamniji mansardni krovovi, bliži red u boji bliskog plana.
- **Posledica** — izbor grada se promenio (Beograd više nije jedini): lokalno 2026-11-06 i 2026-11-15 su sada Pariz.
- **Verifikacija** — pregledi 9 datuma za Pariz i Rim + puna veličina (Rim noću, Pariz zlatni sat) + thumbnail; raspodela na 200 dana sa gradovima: Beograd 37%, Pariz 31%, Rim 32%. v1 hash nepromenjen. `tsc` i ESLint čisti.

### 2026-11-19 — Novi scenario: Gradovi (Beograd) + broj scenarija po verziji (grana `claude`)

- **`src/lib/scenarios/cities.ts`** — NOVO (scenario 8, samo v2): pogled preko reke na grad sa pravim odrazom, 6 paleta, registar gradova sa težinama. Beograd: Hram Svetog Save, Ušće kule, Beograđanka, Kula Beograd, Avalski toranj, Kalemegdan sa Pobednikom, Most na Adi, generički grad, splav. Dimenzije relativne (`s = w/1200`).
- **`src/lib/scenarios/router.ts`** — `NUM_SCENARIOS_V1 = 8` (zamrznuto), `NUM_SCENARIOS_V2 = 9`, `scenarioCount(version)`, `scenarioIndexFor(values, version)`; v2 bira `mix % 9`; `RenderResult.meta` (ime mesta). `NUM_SCENARIOS` ostaje kao alias za v1 (kompatibilnost).
- **`src/lib/scenarios/index.ts`** — `SCENARIO_NAMES[8] = "Gradovi"`, `scenarioNameFor(values, version)`.
- **`src/components/ArtPageContent.tsx`, `src/app/create-art/page.tsx`** — ime scenarija za omiljene se računa po verziji renderera (ranije uvek `% 8`).
- **`src/lib/sky-events.ts`** — `SceneMeta` i opcioni `hooks.meta`.
- **`src/components/ArtCanvas.tsx`** — ispod slike „Slika za {datum} · {grad}" kad scenario prijavi mesto.
- **`messages/sr.json`, `messages/en.json`** — `scene.place.belgrade` (Beograd / Belgrade).
- **Posledica** — v2 dani su preraspoređeni po 9 scenarija (svaki ~11% na 4000 dana); lokalno Beograd pada na 2026-11-06 i 2026-11-15. v1 se ne menja.
- **Podešavanje** — znamenitosti premale → Hram 1.45×, ostale 1.15–1.2×; Kalemegdan je bio „svetla kutija" → više brdo, niske zidine u boji kamena; Avala uvećana; senka Hrama je bila pravougaonik preko kupole → senka tela + polovina kupole klipovana na oblik.
- **Verifikacija** — pregled 12 datuma + puna veličina (dan i noć) + thumbnail; render 34–50 ms. v1 hash identičan za 10 novembarskih datuma (svih 8 scenarija). `tsc` i ESLint prolaze (jedno postojeće upozorenje u `ArtPageContent`).
- **README / SCENARIOS** — izbor scenarija po verziji, tabela scenarija, sekcija „Gradovi".

### 2026-11-19 — Kosmos v2: magline, tipovi planeta, krupni plan (grana `claude`) — svih 8 scenarija prerađeno

- **`src/lib/scenarios/cosmos.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 6 paleta magline (vlakna od mekih oblaka + tamne pruge), zvezde sa difrakcionim zracima, spiralna galaksija, kompozicija „sistem" ili „krupni plan", 5 tipova planeta sa površinom po tipu, senkom ka zvezdi, zatamnjenjem ka ivici, atmosferom, prstenovima (trake sa procepima, zadnja/prednja polovina) i mesecima. Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — planeta preko zvezde → deterministički pomak; krupni plan „ravan" → uže trake + zatamnjenje ka ivici; vulkanske pukotine kao škrabotine → glatke krive sa granama.
- **Verifikacija** — pregled 12 datuma + 2 u punoj veličini + thumbnail; render 56–83 ms. v1 hash identičan originalu (`ba738be`) i za dane sa kosmosom (2026-11-07, 11). `tsc` i ESLint prolaze.
- **SCENARIOS.md** — pored opisa kosmosa, ažurirani odeljci 2 (deljeni primitivi v2), 3 (tabela scenarija v2), 5 (matrica efekata v2), 5a (vegetacija v2) i 6 (raspored crtanja sa hook-ovima, prstenovi v2).
- **README** — sekcija „Kosmos (v2)", tabela scenarija.

### 2026-11-19 — Pejzaž v2: low-poly planinski vrhovi (grana `claude`)

- **`src/lib/landscape.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/landscape.ts`): 6 paleta (uklj. alpenglow i jesenju visoravan), daleki venac i glavni masiv sa fasetiranim vrhovima (osvetljena/senovita strana po nazubljenom grebenu, snežne kape), more oblaka, šumovita podbrđa, alpska livada sa cvećem, vijugava staza, koliba sa dimom, ptice. Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — vertikalni „zidovi" i pravougaonici ispod vrhova (obris je išao do dna slike) → obris se zatvara na podnožju + zajednička podloga; sporedne fasete stišane.
- **Verifikacija** — pregled 12 datuma + puna veličina + thumbnail; render 35–46 ms. v1 hash identičan originalu za dan sa pejzažom (2026-11-13). `tsc` i ESLint prolaze.
- **README / SCENARIOS** — sekcija „Pejzaž (v2)", tabela scenarija, opis i changelog.

### 2026-11-19 — Plaža v2: tropska plaža sa penom, plićinom i palmama (grana `claude`)

- **`src/lib/scenarios/beach.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 6 paleta, puhasti oblaci, more od dubine ka plićini, zakrivljena obala sa tirkiznom plićinom, mokrim peskom i penom, staza odsjaja, ostrvo i jedrilica na horizontu, palme sa punim listovima i dugim liskama, suncobran, školjke, morske zvezde, galebovi. Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — lišće palmi bilo je retka „žičana mreža" → pun nazubljen list → duge, uske, opuštene liske; stablo od naizmeničnih kockica → glatka površina sa svetlom ivicom i prstenovima; krošnja izlazila van kadra → visina ograničena.
- **Verifikacija** — pregled 12 datuma + puna veličina + thumbnail; render 37–75 ms. v1 hash identičan originalu (`ba738be`) i za dan sa plažom (2026-11-15). `tsc` i ESLint prolaze.
- **README / SCENARIOS** — sekcija „Plaža (v2)", tabela scenarija, opis i changelog.

### 2026-11-19 — Šuma v2: proplanak i šumovita dolina u magli (grana `claude`)

- **`src/lib/scenarios/forest.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 6 paleta (proleće, leto, jesen, zlatni sat, noć sa svitcima, zima), 4 sloja šumovitih brda sa maglom, sunčevi zraci, proplanak sa travkama, velike jelke (slojevi grana, svetla/senovita polovina, sneg) i listopadna stabla (dvobojni grozdovi, golo zimi), manja stabla u srednjem planu, srna, ptice, svici. Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — noću su jelke bile sive (toplo dnevno svetlo) → hladna mesečina; krošnje premale („balon na štapu") → veća krošnja, deblje deblo, više grozdova; prazan proplanak → 2–5 manjih stabala u srednjem planu; odsjaji na grozdovima previše „mehurasti" → blaži.
- **Verifikacija** — pregled 12 datuma + puna veličina (slika dana 2026-11-18 i jesen) + thumbnail; render 38–54 ms. v1 hash identičan originalu (`ba738be`) i za dane sa šumom (2026-11-18, 19). `tsc` i ESLint prolaze.
- **README / SCENARIOS** — sekcija „Šuma (v2)", tabela scenarija, opis i changelog.

### 2026-11-19 — Pustinja v2: asimetrične dune sa svetlom i senkom (grana `claude`)

- **`src/lib/scenarios/desert.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 6 paleta, 4–5 slojeva asimetričnih dina (osvetljena blaga i senovita strma strana prema položaju sunca), talasasto podnožje slojeva, svetle linije na grebenima, jaranice od vetra, toplotna izmaglica, mese, karavan kamila na grebenu, saguaro kaktusi, oaza, Mlečni put noću. Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — senke su bile dugačke dijagonalne „oštrice" do dna slike → ograničene na strmu stranu dine; mese su bile preniske (lebdele kao ploče) i preklopljene mese su davale „odsečene" stepenice na vrhu (poluprovidna senka van obrisa) → novi oblik butte, senka klipovana na obris, bez preklapanja; ravne trake između dina noću → talasasto podnožje + više dina po sloju + svetla linija samo na grebenima; tamne pruge Mlečnog puta ličile na mrlje → mnogo diskretnije.
- **Provera retkosti** — 3 od 12 pregledanih pustinja bile su epske; na 4000 dana svaki scenario ima ~20 / 8 / 2% (nema korelacije scenarija i nivoa retkosti), znači slučajnost.
- **Verifikacija** — pregled 12 datuma + 2 u punoj veličini + thumbnail; render 33–67 ms. v1 hash identičan originalu (`ba738be`) i za datume sa pustinjom (2026-11-05, 08, 14, 17). `tsc` i ESLint prolaze.
- **README / SCENARIOS** — sekcija „Pustinja (v2)", tabela scenarija, opis i changelog.

### 2026-11-19 — Jezero v2: planinsko jezero sa pravim odrazom (grana `claude`)

- **`src/lib/scenarios/lake.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 6 paleta po dobu dana, planine u 2 sloja sa nazubljenim grebenom i snegom, traka četinarske šume na obali, pravi odraz cele gornje polovine u vodi, talasići, odsjaj sunca/meseca, magla na vodi, prednji plan (mol / čamac / trska). Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — planine su bile čisti trouglovi → pomoćni vrhovi + šum u 3 oktave; tamna traka na dnu (odraz ne dopire do dna kad je horizont nisko) → popunjeno bojom zenita.
- **Verifikacija** — pregled 12 datuma + 2 u punoj veličini + thumbnail; render 33–58 ms. v1 hash identičan originalu (`ba738be`) i za datum sa jezerom (2026-11-04). `tsc` i ESLint prolaze.
- **README / SCENARIOS** — sekcija „Jezero (v2)", tabela scenarija, opis i changelog.

### 2026-11-19 — Rarity sistem: retki nebeski događaji (grana `claude`)

- **`src/lib/rarity.ts`** — NOVO: `valuesHash` (FNV-1a), `rarityTier` (2% / 8% / 20% / 70%), `rarityRand`. Ne troši `QRNGStream`.
- **`src/lib/sky-events.ts`** — NOVO: `SceneHooks` (`sky`, `body`), `createSceneHooks` + crtanje: zvezde padalice, duga, dupla duga (sa Aleksandrovom trakom), kometa (prašinasti + jonski rep), polarna svetlost (zavese u 2–3 trake), pomračenje Sunca (korona, streameri, dijamantski prsten, potamnjena scena), krvavi mesec, kvantni glitch.
- **Scenariji v2** (`landscape.ts`, `beach`, `desert`, `forest`, `lake`, `cosmos`, `ocean-sunset`, `city-night`) — opcioni parametar `hooks`, poziv `hooks.sky(...)` posle neba i `hooks.body(...)` posle sunca/meseca. Bez događaja slika je nepromenjena.
- **`src/lib/scenarios/router.ts`** — `renderArt` vraća `RenderResult { version, scenarioIndex, rarity }`; v2 pravi hook-ove, posle scene `finish()` (legendarni), pa post-fx.
- **`src/lib/qrng.ts`** — samo novi getter `getValues()` (ne menja stream; v1 nepromenjen).
- **`src/components/ArtCanvas.tsx`** — oznaka retkosti ispod slike (boja po nivou); caption „Slika za {date}" sada iz prevoda (`art.title`) umesto fiksnog srpskog teksta.
- **`messages/sr.json`, `messages/en.json`** — nova sekcija `rarity` (nivoi, događaji, hint).
- **Podešavanje** — zvezde padalice u svetlom sumraku (šuma) se nisu videle → u sumraku redak događaj je duga, zvezde padalice samo noću.
- **Verifikacija** — 1500 dana: raspodela 68 / 21 / 8.6 / 2%; 42 obična dana piksel-identična v2 pre izmene; pregledan primer svakog događaja; v1 nepromenjen. `tsc` i ESLint prolaze. Lokalno (novembar = v2): duga 2., 5. i 10. 11., zvezde padalice 24. 11., glitch 21. 11., pomračenje 29. 11.
- **README** — sekcija „Rarity sistem", struktura projekta.

### 2026-11-19 — Dev: browser keširao stari JavaScript (grana `claude`)

- **Problem** — posle izmene noćnog grada thumbnailovi (server) su bili novi, a `/art/[date]` (crta browser) i dalje star. Uzrok: `next.config.ts` je slao `Cache-Control: public, max-age=31536000, immutable` za `/_next/static/*` i u developmentu. Turbopack u dev-u ne koristi content-hash u imenima chunk-ova (npr. `src_4dbc9eb1._.js`), pa je browser zadržavao stari kod do godinu dana.
- **`next.config.ts`** — `headers()` vraća immutable header samo kad je `NODE_ENV === "production"` (tamo su chunk-ovi hash-ovani, keš je ispravan). U dev-u Next sada šalje `no-store, must-revalidate`.
- **Napomena** — chunk-ovi koje je browser već keširao pre ove izmene traže jednom hard reload (Ctrl+Shift+R) ili „Clear browsing data → Cached images and files".

### 2026-11-19 — Noćni grad v2 (grana `claude`)

- **`src/lib/scenarios/city-night.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 6 noćnih paleta sa svetlosnim zagađenjem, 3 sloja zgrada sa atmosferskom perspektivom i izmaglicom, 6 tipova krovova, prozori u mreži po spratovima (topli/hladni), crvena svetla na delu visokih zgrada, pun mesec ili srp, tanki oblaci, reka sa odrazima i odsjajima svetala ili ulica sa svetiljkama. Dimenzije relativne (`s = w/1200`).
- **Podešavanje** — crvena svetla ograničena na srednji/bliži sloj i ~35% visokih zgrada; jači odsjaji u reci; ulične svetiljke dobile stub i krug svetla na tlu (bile su pravilne kugle).
- **Verifikacija** — pregled 12 datuma + puna veličina (reka i ulica) + thumbnail; render 32–52 ms. v1 hash identičan originalnom kodu (`ba738be`) i za datume sa noćnim gradom (2026-11-06, 2026-11-09). `tsc` i ESLint prolaze.
- **`RENDER_REVISION`** — ostaje `2.1`: v2 još nije bio na produkciji, pa nema starih thumbnailova u kešu.
- **README / SCENARIOS** — sekcija „Noćni grad (v2)", tabela scenarija, opis scenarija i changelog.

### 2026-11-19 — Thumbnailovi u arhivi prate izmene renderera (grana `claude`)

- **Problem** — posle izmene zalaska arhiva je i dalje prikazivala stare thumbnailove: `/api/og-image` ih je keširao u memoriji (ključ = samo datum) i u browseru (`max-age=3600`). Na produkciji bi CDN (`s-maxage=86400`) služio staru sliku do dan posle deploy-a.
- **`src/lib/render-version.ts`** — `RENDER_REVISION` (`1: "1"`, `2: "2.1"`) i `renderRevisionForDate(date)`.
- **`src/app/api/og-image/route.ts`** — ključ keša `datum|revizija`; u developmentu bez LRU keša i sa `Cache-Control: no-store`.
- **`src/components/ArchiveThumbnail.tsx`** — URL thumbnail-a dobija `&r=<revizija>` (cache-busting za browser/CDN).
- **Verifikacija** — dev server vraća v2 thumbnail za 2026-11-16 sa `no-store`; `tsc` prolazi.
- **README / DEPLOY-CHECKLIST** — objašnjenje `RENDER_REVISION` i pravilo povećavanja revizije pri vizuelnim izmenama v2.

### 2026-11-19 — Zalazak v2 + zajednički PRNG (grana `claude`)

- **`src/lib/scenarios/ocean-sunset.ts`** — scenario prepisan za v2 (v1 ostaje u `scenarios/v1/`): 8 kuriranih paleta uklj. „plavi sat", sunce na različitim visinama sa mekim radijalnim sjajem, oblaci-pramenovi obasjani odozdo, izmaglica na horizontu, voda sa refleksom neba, svetlosna staza u perspektivi, linije talasa, opciona silueta (obala / jedrilica / svetionik sa svetlom) i ptice. Sve dimenzije relativne (`s = w/1200`).
- **`src/lib/prng.ts`** — NOVO: `mulberry32` i `prngFromStream(stream)`. Pravilo za v2: QRNG za odluke, PRNG seedovan QRNG-om za masovne detalje.
- **`src/lib/post-fx.ts`** — koristi `mulberry32` iz `prng.ts` (bez promene izlaza).
- **Podešavanje** — siluete obale povišene (bile su tanke trake), sunce češće više iznad horizonta, oblaci od više manjih elipsi sa svetlim donjim srpom (bili su „naduvane elipse"), oblaci bliže suncu topliji.
- **Verifikacija** — pregledano 12 datuma sa zalaskom (pregled 3×4) + puna veličina + thumbnail 600px; render 30–60 ms na serveru. v1 hash nepromenjen. `tsc` i ESLint prolaze za nove fajlove.
- **README** — sekcija „Zalazak (v2)" u Važnim odlukama, tabela scenarija, struktura projekta.

### 2026-11-19 — Post-fx sloj za render v2 (grana `claude`)

- **`src/lib/post-fx.ts`** — NOVO: `pickPostFxParams(stream)` + `applyPostFx(ctx, w, h, params)`. Jedan pixel prolaz: S-kontrast, split-tone (5 kuriranih parova), eliptična vinjeta, monohromatski film grain (`mulberry32`, skaliran na rezoluciju). Bez `ctx.filter`/composite modova radi istog izgleda u browseru i na serveru.
- **`src/lib/scenarios/router.ts`** — `renderArt` za v2 poziva `applyPostFx` posle scenarija. v1 nije dirnut.
- **Podešavanje** — prva verzija imala je prejak grain (7–13) i plavi cast u tamnim delovima; smanjeno na 4–8, grain najjači u srednjim tonovima, senke split-tone-a opadaju ka čistoj crnoj.
- **Verifikacija** — v1 hash piksela nepromenjen za 2026-11-10 … 18; pregledani pre/posle parovi za zalazak, šumu, pustinju, plažu, pejzaž (noć) i kosmos. `tsc` prolazi.
- **README** — podsekcija „Post-fx sloj (samo v2)" sa tabelom opsega, stavka u strukturi projekta.

### 2026-11-19 — Verzionisanje renderera (grana `claude`)

- **`src/lib/scenarios/v1/`** — NOVO: zamrznuta kopija celog renderera (router, 8 scenarija, `landscape.ts`, `draw-utils.ts`, `tree-lsystem.ts`, `color.ts`) sa prepravljenim importima. Funkcija `renderArtV1`. Ne menja se nikad; čuva izgled postojeće arhive.
- **`src/lib/render-version.ts`** — NOVO: `RenderVersion`, `RENDER_V2_FROM` (iz `NEXT_PUBLIC_RENDER_V2_FROM`, podrazumevano `2099-01-01`), `renderVersionForDate`, `renderVersionForTimestamp`, `currentRenderVersion`.
- **`src/lib/scenarios/router.ts`** — `renderArt(ctx, stream, w, h, version = 2)`: verzija 1 ide na `renderArtV1`, inače `renderArtV2` (postojeći kod, ovde idu poboljšanja).
- **`src/components/ArtCanvas.tsx`** — novi opcioni prop `renderVersion`; bez njega verzija po `date` propu, a bez datuma po današnjem danu.
- **`src/components/AlgoArtCanvas.tsx`** — novi opcioni prop `createdAt` → verzija po datumu nastanka favorita (samo za scenarije, algoritamski presetovi nisu pogođeni).
- **`src/app/profile/page.tsx`, `src/app/f/[token]/page.tsx`** — prosleđuju `createdAt` favorita u `AlgoArtCanvas`.
- **`src/app/create-art/page.tsx`** — favorit otvoren u Igraonici crta se u verziji svog `createdAt`; novi brojevi (unos, Nasumično, Današnja) u današnjoj verziji.
- **`src/app/api/og-image/route.ts`** — OG i arhivski thumbnail crtaju se u verziji datuma.
- **`.env.development`** — `NEXT_PUBLIC_RENDER_V2_FROM=2026-11-01` (samo lokalno).
- **Verifikacija** — v1, v2 i kod pre izmene daju identičan hash piksela za 2026-11-10 … 2026-11-18. `tsc --noEmit` prolazi. Vizuelno se još ništa ne menja (v2 == v1).
- **README** — nove sekcije „Verzionisanje renderera" i „Otvorena pitanja / TODO" (slika dana koristi `seedFromDate`, ne ANU QRNG; vezivanje QRNG-a za datum odloženo), env promenljiva u Pokretanju, ažurirana struktura projekta.
- **DEPLOY-CHECKLIST** — korak za `NEXT_PUBLIC_RENDER_V2_FROM` pri spajanju u `main`.
- **CLAUDE-DEVELOPMENT-PROPOSAL.md** — NOVO: analiza i predlog razvoja (vizuelno, monetizacija, roadmap).

### 2026-03-29

- **README** — Nova sekcija „Algoritmički art (`/algorithmic`) — layout u `<style>`”: objašnjenje zašto responsive layout ide kroz ugrađeni `<style>` u [`src/app/algorithmic/page.tsx`](src/app/algorithmic/page.tsx), kopija CSS-a (`.algo-art-workspace` / `.algo-art-sidebar` / `.algo-art-main`), napomena da izvor istine ostaje u `page.tsx`. U stablu projekta dodata stavka `algorithmic/page.tsx`.

### 2026-03-05

- **Pejzaž** — Nebo: ograničene hue vrednosti na prirodne (plava, siva, tople); nikad zelena (85–165). Dodata scena "day" (plavo nebo). Oblaci beli/svetlo sivi (240–255). Sunce uvek toplo (hue 25–60), ne plavo.
- **Pejzaž** — Halo oko meseca smanjen i diskretniji: manje slojeva (5), manji spread (0.06), niži alpha. (`drawSunGlow` dobio opcioni `glowSpread`.)
- **Plaža** — Nebo plavo (skyHue 200–240). More plavo-tirkiz gradijent.
- **Noćni grad** — Popunjavanje podloge ispod horizonta tamnom bojom pre zgrada (`fillRect`), da ne probija boja prethodnog scenarija.
- **Šuma** — Svaka krošnja mora imati stablo. Drveće na različitim visinama. Tlo zeleno (travnata podloga). Dan: ptice; noć: sove/šišmiši; dan: veverica (50%). Stablo braon, krošnja zelena.
- **Pustinja** — Base sand fill pre dina. Dune oble (ridgePoints detailScale 0.06, roughness 0.9). Prva dina prekriva horizont.
- **Kosmos** — Zvezde se crtaju pre planeta.
- **Kosmos** — Planete: planetarne boje, manje difuzan gradijent. Prstenovi: SVG pristup (back/front arc). Jedan zajednički izvor svetla (sunce): hotspot usmeren prema suncu, tamnija noćna polutka.
- **Jezero** — Horizont 1/3–2/3 (voda 2/3). Brda kao uska traka. Refleks: jedan radijalni gradijent (meko). Ptice. Voda i brda plave nijanse.
- **README** — Inicijalna dokumentacija. Pravilo: SVAKI update se beleži u Changelog.
- **Dokumentacija** — Izmene scenarija se beleže u [SCENARIOS.md](SCENARIOS.md#7-changelog-scenarija), README referencira tu sekciju.
- **Kosmos** — Pozadina zatamnena. Šest različitih boja. Umanjeno sencenje, specular highlight ka suncu (svetla tačka 0.92).
- **Share / Open Graph** — `/api/og-image` renderuje pravu sliku dana (PNG). Obrisan opengraph-image.tsx (imao prednost nad metadata). og:image koristi apsolutni URL.
- **Plaža** — Palma peraje povećane 40–55% (lenBase 56–108, width 6–11).
- **Šuma** — Deblo se crta posle krošnje da uvek bude vidljivo (krošnja ne sme da ga prekrije).
- **Svi scenariji** — Sunce/mesec: konzistentna veličina (sun 22–36 px, moon 14–26 px).
- **Jezero** — Deblo obalskog drveća crta se posle krošnje (kao Šuma).
- **Jezero** — Vrba i listač: L-system inspirisano rekurzivno grananje (tree-lsystem.ts).
- **Auth + Favorites** — Drizzle + NextAuth (Credentials), bcryptjs. Korisnici: registracija, prijava, profil, snimanje omiljenih, javno deljenje `/f/[token]`.
- **README** — Detaljna sekcija Pokretanje (preduslovi, `.env`, Drizzle init), npm skripte, pregled novih paketa (Drizzle, NextAuth, bcryptjs, @napi-rs/canvas, next-intl), ažurirana struktura projekta i API tabela.

### 2026-03-07 — Optimizacija resursa (Hostinger fix)

- **`src/lib/db.ts`** — KRITIČAN FIX: Prelazak sa Prisma na Drizzle + mysql2. Prisma je imala Rust query engine koji je spawnovao procese i prekoračavao Max Processes limit (120/120 na Hostingeru). Drizzle koristi mysql2 connection pool bez dodatnih child procesa.
- **`next.config.ts`** — KRITIČAN FIX: Uklonjen globalni `no-store` header koji je pokrivao sve URL-ove (`/:path*`). Ostao je samo keš za `/_next/static/`. Sada svaka ruta sama definiše svoju keš strategiju.
- **`src/components/ArchiveThumbnail.tsx`** — Dodat `IntersectionObserver` (rootMargin 200px): `fetch(/api/art/${date})` se poziva samo kada thumbnail uđe u viewport. Pre ovog fixa, N thumbnailova na arhivnoj strani istovremeno slalo N paralelnih zahteva serveru pri učitavanju stranice.
- **`src/app/api/og-image/route.ts`** — Dodat in-memory LRU keš (`Map<string, Buffer>`, max 30 unosa). OG slika je deterministička (isti datum → ista slika zauvek), pa se renderuje samo jednom po procesu. Pre toga, svaki Viber/Telegram share pokretao je puni canvas render + PNG enkodiranje.
- **`src/app/api/art/[date]/route.ts`** — Dodat `Cache-Control: public, max-age=86400, immutable` header. Ruta je deterministička, može se keširati u browseru i CDN-u.
- **`src/app/api/favorites/route.ts`** — Uklonjen `values` iz SELECT za list view. 1000 brojeva po favoritu se sada ne prenosi pri listanju, samo pri otvaranju jednog favorita. Dodat `no-store` header (privatni podaci).
- **`src/app/api/favorites/[id]/route.ts`** — DELETE i PATCH koriste Drizzle sa userId uslovom. Dodat `no-store` header.
- **`src/app/profile/page.tsx`** — `FavoriteCard` sada lazy-load-uje `values` putem `IntersectionObserver` — canvas se popunjava tek kada kartica uđe u viewport, ne odjednom za sve favorite.
- **`src/app/page.tsx`** — `force-dynamic` zamenjen sa `revalidate: 86400` (ISR). Stranica ne sadrži per-request dinamičke podatke.
- **`src/app/archive/page.tsx`** — `force-dynamic` zamenjen sa `revalidate: 3600` (ISR). Lista datuma je čista matematika.

### 2026-03-11 — Drizzle setup i README dokumentacija

- **README** — Ažurirana dokumentacija: Prisma zamenjena sa Drizzle u celoj sekciji Pokretanje. Dodati koraci: instalacija MySQL-a, kreiranje baze i korisnika, `npm run db:push`, SQL fallback `drizzle/0000_init.sql`.
- **Projektna struktura** — Prisma folder zamenjen sa `drizzle.config.ts` i `drizzle/0000_init.sql`. `db.ts` i `auth.ts` sada koriste Drizzle.
- **drizzle.config.ts** — Novi fajl za Drizzle Kit; učitava `.env` i `.env.local` za `DATABASE_URL`.
- **drizzle-kit** — Dodat u devDependencies. Nove skripte: `db:push`, `db:generate`, `db:migrate`.
- **drizzle/0000_init.sql** — SQL fallback za ručnu inicijalizaciju (samo `User` i `Favorite`, bez Prisma tabela).

---

## Konfiguracija

### Aplikacija

- **REQUIRED_COUNT** — 1000 brojeva za generisanje
- **Canvas** — 1200×675 px
- **Datum** — timezone `Europe/Belgrade` (srpsko vreme)
- **Port** — 9500 (dev)

### Okruženje (.env)

| Promenljiva | Obavezna | Opis |
|-------------|----------|------|
| `AUTH_SECRET` | Da | Min. 32 karaktera; `openssl rand -base64 32` |
| `DATABASE_URL` | Da | MySQL connection string (`mysql://user:pass@host:3306/db`) |
| `NEXTAUTH_URL` | Produkcija | Apsolutni URL sajta (za Auth callback i OG slike) |
