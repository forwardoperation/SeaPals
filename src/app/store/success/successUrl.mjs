export function urlWithoutCheckoutSessionId(value) {
  try {
    const url = new URL(value);
    if (!url.searchParams.has("session_id")) return null;

    url.searchParams.delete("session_id");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
