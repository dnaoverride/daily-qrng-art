import { ArtCanvas } from "@/components/ArtCanvas";
import { Header } from "@/components/Header";
import { DailyArtSection } from "@/components/DailyArtSection";
import { getTodayBelgrade } from "@/lib/date";

export default function Home() {
  const today = getTodayBelgrade();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-6">
          Art of the Day
        </h1>
        <DailyArtSection date={today} />
        <section className="mt-12 max-w-2xl mx-auto space-y-4 text-zinc-600 dark:text-zinc-400 text-center leading-relaxed">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Kako je ova slika nastala?
          </h2>
          <p>
            Ova slika nastala je iz <strong className="text-zinc-800 dark:text-zinc-200">kvantnog suma</strong> — 
            prave nasumičnosti koja potiče iz kvantnih procesa (fotonska detekcija na Australijskom nacionalnom univerzitetu), 
            ne iz algoritma na računaru.
          </p>
          <p>
            Svaki od 1000 kvantno generisanih brojeva utiče na finalni izgled: boju neba, broj zvezda, oblik planina, 
            poziciju sunca ili meseca, oblake. Isti set brojeva uvek daje istu sliku — reproducibilnu umetnost iz haosa.
          </p>
        </section>
      </main>
    </div>
  );
}
