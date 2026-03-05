interface ArchiveThumbnailProps {
  date: string;
}

export function ArchiveThumbnail({ date }: ArchiveThumbnailProps) {
  return (
    <div className="aspect-video rounded overflow-hidden bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/thumb/${date}`}
        alt={`QRNG art ${date}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
