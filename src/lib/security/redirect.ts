/**
 * Where to send a student after the sign-in link, from the untrusted `next` parameter.
 * Only same-site paths are allowed, so the link can't bounce people to another website
 * ("//evil.com", "/\\evil.com", "https://evil.com" all fall back to the default).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/treino"): string {
  if (!next || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const base = "https://readback.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
