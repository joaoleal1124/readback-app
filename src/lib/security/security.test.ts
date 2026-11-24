import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimits } from "./rateLimit";
import { safeNextPath } from "./redirect";
import { buildCsp } from "./csp";
import { validateResult } from "@/server/progress";
import { validateExam } from "@/server/exams";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks until the window resets", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000, t0).ok).toBe(true);
    const blocked = rateLimit("k", 3, 60_000, t0 + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(59);
    expect(rateLimit("k", 3, 60_000, t0 + 60_000).ok).toBe(true);
  });

  it("keeps separate counts per key", () => {
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("b", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(false);
  });

  it("reads the client address from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/treino")).toBe("/treino");
    expect(safeNextPath("/treino?sim=lppt#x")).toBe("/treino?sim=lppt#x");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\tevil", "", null, undefined]) {
      expect(safeNextPath(bad)).toBe("/treino");
    }
  });
});

describe("buildCsp", () => {
  it("allows only this site and Supabase in production", () => {
    const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co", isDev: false });
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("works without Supabase (demo mode)", () => {
    expect(buildCsp({ supabaseUrl: "", isDev: false })).toContain("connect-src 'self';");
  });
});

describe("validateResult", () => {
  it("accepts a real simulation, level and error count", () => {
    expect(validateResult({ simId: "cascais-local", level: 2, errors: 3 })).toEqual({
      ok: true,
      value: { simId: "cascais-local", level: 2, errors: 3 },
    });
  });
  it("rejects more errors than the simulation has steps", () => {
    expect(validateResult({ simId: "cascais-local", level: 1, errors: 14 }).ok).toBe(false);
  });
  it("rejects bad input", () => {
    expect(validateResult(null).ok).toBe(false);
    expect(validateResult({ simId: "nope", level: 1, errors: 0 }).ok).toBe(false);
    expect(validateResult({ simId: "x", level: 4, errors: 0 }).ok).toBe(false);
    expect(validateResult({ simId: "x", level: 1, errors: -1 }).ok).toBe(false);
    expect(validateResult({ simId: "x", level: 1, errors: 1.5 }).ok).toBe(false);
  });
});

describe("validateExam", () => {
  it("accepts a real exam and refuses impossible numbers", () => {
    expect(validateExam({ licence: "PPL", right: 15, total: 20, seconds: 600 })).toEqual({
      ok: true,
      value: { licence: "PPL", right: 15, total: 20, seconds: 600 },
    });
    expect(validateExam({ licence: "CPL", right: 1, total: 20, seconds: 1 }).ok).toBe(false);
    expect(validateExam({ licence: "PPL", right: 21, total: 20, seconds: 1 }).ok).toBe(false);
    expect(validateExam({ licence: "PPL", right: 1.5, total: 20, seconds: 1 }).ok).toBe(false);
    expect(validateExam({ licence: "PPL", right: 1, total: 0, seconds: 1 }).ok).toBe(false);
    expect(validateExam({ licence: "PPL", right: 1, total: 20, seconds: 99999 }).ok).toBe(false);
    expect(validateExam(null).ok).toBe(false);
  });
});
