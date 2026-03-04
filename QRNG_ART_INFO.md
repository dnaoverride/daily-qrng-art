# QRNG Art — princip i moguće upotrebe

## 1. Princip: kako koristimo QRNG brojeve

### Izvor podataka

Projekat koristi **ANU Quantum Random Number Generator** (Australijski nacionalni univerzitet):

- API: `https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16`
- Jedan poziv vraća **1000 nasumičnih 16-bitnih brojeva** (0–65535)
- Brojevi nastaju iz kvantnih procesa (fotonska detekcija), ne algoritamskog pseudo-random generatora

### QRNGStream — potrošnja brojeva

Svih 1000 brojeva prolazi kroz `QRNGStream`:

1. **Sekvencijalna potrošnja** — svaki poziv `next_u16()`, `next_f()` ili `next_int(a,b)` uzima sledeći broj iz niza
2. **Mixing sa xorshift** — svaki korišćeni broj se XOR-uje u interno stanje xorshift32 generatora
3. **Proširenje** — kada se potroši svih 1000, stream prelazi na xorshift32 da nastavi da daje vrednosti (deterministički, iz istog seed-a)

Rezultat: **deterministička reprodukcija** — isti set od 1000 brojeva uvek daje istu sliku.

### Kako se brojevi mapiraju na sliku

| Tip poziva | Primer | Šta određuje |
|------------|--------|--------------|
| `next_f()` | `stream.next_f() < 0.34` | Tip scene (sunrise / sunset / night) |
| `next_int(0, 359)` | `base_hue = stream.next_int(0, 359)` | Osnovna boja palete |
| `next_int(a, b)` | `stream.next_int(250, 600)` | Broj zvezda, oblaka, drveća |
| `next_int(x1, x2)` | `x = stream.next_int(0, w-1)` | X,Y pozicije elemenata |

Svaki vizuelni izbor (boja, pozicija, broj instanci, da li se element uopšte prikaže) potiče iz stream-a. Redosled poziva je fiksan, pa je redosled „pitanja" koje se postavljaju stream-u deterministički.

---

*Dokument kreiran za projekat qrng-art. Next.js implementacija u ovom repozitorijumu.*
