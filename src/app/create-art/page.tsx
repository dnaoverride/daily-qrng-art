import { redirectToStudio } from "@/lib/studio-redirect";

/** Igraonica je sada deo Studija (scene). */
export default async function CreateArtPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToStudio("scene", searchParams);
}
