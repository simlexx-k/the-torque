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

  return response.json() as Promise<T>;
}
