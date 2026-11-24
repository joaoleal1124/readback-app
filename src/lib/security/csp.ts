/**
 * Content-Security-Policy for every page.
 *
 * Scripts and styles may only come from this site; the browser may only talk to
 * this site and to Supabase. Next.js still needs inline scripts for its page data,
 * so 'unsafe-inline' stays for scripts until we move to nonces (which would make
 * every page render on each request). Even so, this blocks scripts and data
 * leaks to any other domain, plugins, framing and <base> tricks.
 */
export function buildCsp({ supabaseUrl, isDev }: { supabaseUrl: string; isDev: boolean }): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl);
      connect.push(u.origin, `${u.protocol === "http:" ? "ws" : "wss"}://${u.host}`);
    } catch {
      /* invalid URL: Supabase is off anyway */
    }
  }
  if (isDev) connect.push("ws:", "http://localhost:*", "http://127.0.0.1:*");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "media-src": ["'self'", "blob:", "data:"],
    "connect-src": connect,
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
