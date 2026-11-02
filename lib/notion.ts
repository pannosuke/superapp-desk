import { assertCommercialUrl, readJson, UpstreamError } from "@/lib/http";

type NotionPage = {
  url?: string;
  properties?: Record<string, { type?: string; title?: { plain_text?: string }[] }>;
};

function pageTitle(page: NotionPage) {
  const properties = page.properties ?? {};
  for (const property of Object.values(properties)) {
    if (property.type === "title" && property.title?.length) {
      return property.title.map((part) => part.plain_text ?? "").join("").trim();
    }
  }
  return "";
}

function score(title: string, query: string) {
  const left = title.toLowerCase().replace(/\s+/g, " ").trim();
  const right = query.toLowerCase().replace(/\s+/g, " ").trim();
  if (!left || !right) return 0;
  if (left === right) return 3;
  if (left.includes(right) || right.includes(left)) return 2;
  return 0;
}

export async function findPrepPage(query: string) {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) throw new UpstreamError("NOTION_TOKEN is not set.", 503);
  const url = assertCommercialUrl("https://api.notion.com/v1/search", "notion");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query.slice(0, 100),
      filter: { property: "object", value: "page" },
      page_size: 8,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await readJson(response)) as { results?: NotionPage[] } | null;
  if (!response.ok) {
    throw new UpstreamError(`Notion returned ${response.status}.`, response.status);
  }
  const ranked = (body?.results ?? [])
    .map((page) => ({ page, score: score(pageTitle(page), query) }))
    .filter((item) => item.score > 0 && item.page.url)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best?.page.url) return null;
  return { url: best.page.url, title: pageTitle(best.page) };
}
