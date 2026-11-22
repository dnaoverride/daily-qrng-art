import { redirectToStudio } from "@/lib/studio-redirect";

/** Algoritmički art je sada deo Studija (apstrakcije). */
export default async function AlgorithmicPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToStudio("abstract", searchParams);
}
