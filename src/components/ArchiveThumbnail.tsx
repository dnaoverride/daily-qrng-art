interface ArchiveThumbnailProps {
  date: string;
}

export function ArchiveThumbnail({ date }: ArchiveThumbnailProps) {
  return (
    <div
      className="rounded overflow-hidden bg-zinc-800"
      style={{ aspectRatio: "16/9", width: "100%" }}
    >
      <img
        src={`/api/og-image?date=${date}&size=thumb`}
        loading="lazy"
        decoding="async"
        alt={date}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
