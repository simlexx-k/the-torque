function adaptThreadedListing(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const listing = value as Record<string, unknown>;
  const rawPost = listing.post;
  if (!rawPost || typeof rawPost !== "object" || Array.isArray(rawPost)) return value;
  const post = rawPost as Record<string, unknown>;
  const count = typeof post.thread_post_count === "number" ? post.thread_post_count : 0;
  if (count <= 1) return value;

  const threadText = typeof post.thread_text === "string" ? post.thread_text.trim() : "";
  const threadMedia = Array.isArray(post.thread_media) ? post.thread_media : [];
  return {
    ...listing,
    post: {
      ...post,
      text: threadText || post.text,
      media: threadMedia.length ? threadMedia : post.media,
    },
  };
}

function adaptPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => adaptThreadedListing(item)) as T;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return {
        ...record,
        items: record.items.map((item) => adaptThreadedListing(item)),
      } as T;
    }
    return adaptThreadedListing(payload) as T;
  }
  return payload;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let detail = "The Torque API request failed.";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Keep the generic message if the backend did not return JSON.
    }
    throw new Error(detail);
  }

  const payload = (await response.json()) as T;
  return adaptPayload(payload);
}
