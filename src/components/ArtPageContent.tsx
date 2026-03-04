"use client";

import { useEffect, useState } from "react";
import { ArtCanvas } from "./ArtCanvas";
import { QRNGReveal } from "./QRNGReveal";

interface ArtPageContentProps {
  date: string;
}

export function ArtPageContent({ date }: ArtPageContentProps) {
  const [values, setValues] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/art/${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.values) setValues(data.values);
        else setError(data.error || "Greška");
      })
      .catch(() => setError("Greška učitavanja"));
  }, [date]);

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-zinc-500">Učitavanje...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
        Slika za {date}
      </h1>
      <div className="flex justify-center">
        <ArtCanvas values={values} date={date} />
      </div>
      <QRNGReveal values={values} date={date} />
    </div>
  );
}