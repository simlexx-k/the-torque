import { fetchJson } from "@/lib/api";
import type { Listing, PaginatedResponse, SignalPost } from "@/lib/types";

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

function withSource(path: string, source?: string | null) {
  if (!source) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}source=${encodeURIComponent(source)}`;
}

async function fetchAllPages<T>(basePath: string, source?: string | null): Promise<T[]> {
  const first = await fetchJson<PaginatedResponse<T>>(
    withSource(`${basePath}?limit=${PAGE_SIZE}&page=1`, source),
  );
  const items = [...first.items];
  const totalPages = Math.min(first.pagination.pages, MAX_PAGES);

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchJson<PaginatedResponse<T>>(
      withSource(`${basePath}?limit=${PAGE_SIZE}&page=${page}`, source),
    );
    items.push(...next.items);
    if (!next.pagination.has_next) break;
  }

  return items;
}

export function fetchAllListings(source?: string | null) {
  return fetchAllPages<Listing>("/api/torque/listings", source);
}

export function fetchAllPosts(source?: string | null) {
  return fetchAllPages<SignalPost>("/api/torque/posts", source);
}
