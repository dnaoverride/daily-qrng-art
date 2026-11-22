import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Stare stranice (/create-art, /algorithmic) su spojene u /studio.
 * Preusmerava i prenosi sve parametre (`favorite`, `code`…), pa stari linkovi,
 * favoriti i deljeni kodovi i dalje rade.
 */
export async function redirectToStudio(mode: "scene" | "abstract", searchParams: Promise<SearchParams>): Promise<never> {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const one of Array.isArray(v) ? v : v !== undefined ? [v] : []) q.append(k, one);
  }
  // Favorit i preset kod sami određuju režim u Studiju
  if (!q.has("favorite") && !q.has("code")) q.set("mode", mode);
  redirect(`/studio?${q.toString()}`);
}
