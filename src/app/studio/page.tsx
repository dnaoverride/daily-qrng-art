import { Suspense } from "react";
import { Studio } from "@/components/studio/Studio";

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" />}>
      <Studio />
    </Suspense>
  );
}
