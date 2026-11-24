import { describe, expect, it } from "vitest";
import { checkAnswer } from "./normalize";
import { toSpeech } from "./speech";
import { atisQuestions, cleanWeatherAnswer, makeWeather, metarQuestions, toAtis, toMetar, type Weather } from "./weather";

const LPPT: Weather = {
  airport: { icao: "LPPT", name: "Lisbon", runways: [2, 20], elevation: 374 },
  info: "C",
  time: "1250",
  day: 24,
  runway: "02",
  windDir: 20,
  windSpeed: 15,
  gust: 25,
  visibility: 9999,
  cavok: false,
  clouds: [
    { cover: "FEW", base: 1800 },
    { cover: "BKN", base: 4500 },
  ],
  temp: 18,
  dew: 11,
  qnh: 1016,
  trend: "NOSIG",
};

describe("weather", () => {
  it("writes the METAR in ICAO order", () => {
    expect(toMetar(LPPT)).toBe("LPPT 241250Z 02015G25KT 9999 FEW018 BKN045 18/11 Q1016 NOSIG");
    expect(toMetar({ ...LPPT, cavok: true, clouds: [], gust: undefined, temp: -2, dew: -5 })).toBe(
      "LPPT 241250Z 02015KT CAVOK M02/M05 Q1016 NOSIG",
    );
  });

  it("writes an ATIS the voice reads the radio way", () => {
    const atis = toAtis(LPPT);
    expect(atis).toContain("information Charlie");
    expect(toSpeech(atis)).toContain("QNH one zero one six");
    expect(toSpeech(atis)).toContain("broken four thousand five hundred feet");
  });

  it("accepts typed and spoken answers", () => {
    const [time, wind, gust, vis, ceil, temp, qnh] = metarQuestions(LPPT);
    expect(checkAnswer("1250", time.keys, "").ok).toBe(true);
    expect(checkAnswer("020 15", wind.keys, "").ok).toBe(true);
    expect(checkAnswer("20, 15", wind.keys, "").ok).toBe(true);
    expect(checkAnswer("25", gust.keys, "").ok).toBe(true);
    expect(checkAnswer("10 km", vis.keys, "").ok).toBe(true);
    expect(checkAnswer("four thousand five hundred", ceil.keys, "").ok).toBe(true);
    expect(checkAnswer("1800", ceil.keys, "").ok).toBe(false);
    expect(checkAnswer("18 11", temp.keys, "").ok).toBe(true);
    expect(checkAnswer("18/11", temp.keys, "").ok).toBe(true);
    expect(checkAnswer("11 18", temp.keys, "").ok).toBe(false);
    expect(checkAnswer("one zero one six", qnh.keys, "").ok).toBe(true);
    expect(checkAnswer("1013", qnh.keys, "").ok).toBe(false);
    const [info, runway, , , , contact] = atisQuestions(LPPT);
    expect(checkAnswer("Charlie", info.keys, "").ok).toBe(true);
    expect(checkAnswer("runway 02", runway.keys, "").ok).toBe(true);
    expect(checkAnswer("2", runway.keys, "").ok).toBe(true);
    expect(checkAnswer("information Charlie", contact.keys, "").ok).toBe(true);
    expect(checkAnswer("Charlie", contact.keys, "").ok).toBe(false);
  });

  it("asks about gusts and ceiling even when there are none", () => {
    const calm = { ...LPPT, gust: undefined, clouds: [{ cover: "FEW" as const, base: 2000 }] };
    const q = metarQuestions(calm);
    expect(checkAnswer("no", q[2].keys, "").ok).toBe(true);
    expect(checkAnswer("não", q[4].keys, "").ok).toBe(true);
  });

  it("ignores units and filler words", () => {
    const [time, wind, , , ceil, temp, qnh] = metarQuestions(LPPT);
    const ok = (a: string, keys: string[]) => checkAnswer(cleanWeatherAnswer(a), keys, "").ok;
    expect(ok("1250Z", time.keys)).toBe(true);
    expect(ok("020° 15 kt", wind.keys)).toBe(true);
    expect(ok("from 020 degrees at 15 knots", wind.keys)).toBe(true);
    expect(ok("4500 ft", ceil.keys)).toBe(true);
    expect(ok("18°C / 11°C", temp.keys)).toBe(true);
    expect(ok("1016 hPa", qnh.keys)).toBe(true);
  });

  it("reads single-figure pairs", () => {
    const cold = { ...LPPT, temp: 8, dew: 3, windDir: 80, windSpeed: 5 };
    const q = metarQuestions(cold);
    for (const a of ["8 3", "8/3", "8, 3"]) expect(checkAnswer(a, q[5].keys, "").ok, a).toBe(true);
    for (const a of ["080 5", "80, 5"]) expect(checkAnswer(a, q[1].keys, "").ok, a).toBe(true);
  });

  it("generates weather whose own answers pass", () => {
    for (let i = 0; i < 300; i++) {
      const w = makeWeather();
      expect(w.dew).toBeLessThan(w.temp);
      expect(w.airport.runways.map((n) => String(n).padStart(2, "0"))).toContain(w.runway.replace(/[LRC]$/, ""));
      for (const q of [...metarQuestions(w), ...atisQuestions(w)]) {
        const ans = q.keys.map((k) => k.split("|")[0]).join(" ");
        expect(checkAnswer(ans, q.keys, "").ok, `${toMetar(w)} ${q.id} ${ans}`).toBe(true);
      }
    }
  });
});
