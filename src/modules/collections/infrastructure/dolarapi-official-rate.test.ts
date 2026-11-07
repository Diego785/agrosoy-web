import { afterEach, describe, expect, it, vi } from "vitest";
import { dolarApiOfficialRate, parseOfficialRate } from "./dolarapi-official-rate";

const answer = {
  moneda: "USD",
  casa: "oficial",
  nombre: "Oficial",
  compra: 11.89,
  venta: 11.89,
  fechaActualizacion: "2026-11-06T00:00:00.000Z",
};

describe("the official rate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("takes the rate and the day it is dated", () => {
    expect(parseOfficialRate(answer)).toEqual({ rate: "11.8900", date: "2026-11-06" });
  });

  it("ignores an answer it doesn't recognize", () => {
    expect(parseOfficialRate({ venta: "11.89", fechaActualizacion: answer.fechaActualizacion })).toBeNull();
    expect(parseOfficialRate({ venta: 0, fechaActualizacion: answer.fechaActualizacion })).toBeNull();
    expect(parseOfficialRate({ venta: 11.89 })).toBeNull();
    expect(parseOfficialRate(null)).toBeNull();
  });

  it("gives nothing, without failing, when the service errs or can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    await expect(dolarApiOfficialRate.latest()).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(dolarApiOfficialRate.latest()).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(dolarApiOfficialRate.latest()).resolves.toBeNull();
  });

  it("reads the service's answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(answer)));
    await expect(dolarApiOfficialRate.latest()).resolves.toEqual({ rate: "11.8900", date: "2026-11-06" });
  });
});
