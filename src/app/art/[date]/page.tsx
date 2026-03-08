import { ArtPageContent } from "@/components/ArtPageContent";

export const revalidate = 86400;

export default async function ArtDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="pt-20 pb-16 px-4 max-w-5xl mx-auto">
        <ArtPageContent date={date} />
      </main>
    </div>
  );
}
