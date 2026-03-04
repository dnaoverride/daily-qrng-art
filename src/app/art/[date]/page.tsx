import { Header } from "@/components/Header";
import { ArtPageContent } from "@/components/ArtPageContent";

export default async function ArtDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <ArtPageContent date={date} />
      </main>
    </div>
  );
}
