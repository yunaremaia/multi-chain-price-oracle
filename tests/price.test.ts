import { describe, it, expect, vi, beforeEach } from "vitest";
import app, { getPrices, getSinglePrice, resetPriceCache, SYMBOL_TO_CG } from "../src/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("getPrices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPriceCache();
  });

  it("returns prices from CoinGecko for known symbols", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 65000, usd_24h_change: 2.5 },
        ethereum: { usd: 3200, usd_24h_change: -1.2 },
      }),
    });

    const prices = await getPrices(["BTC", "ETH"], mockFetch);
    expect(prices.BTC.usd).toBe(65000);
    expect(prices.ETH.usd).toBe(3200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("bitcoin");
    expect(url).toContain("ethereum");
  });

  it("returns empty for unknown symbols", async () => {
    const prices = await getPrices(["FAKECOIN"], mockFetch);
    expect(Object.keys(prices)).toHaveLength(0);
    // Should not even call CoinGecko
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uses cache within TTL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 65000 } }),
    });

    await getPrices(["BTC"], mockFetch);
    await getPrices(["BTC"], mockFetch);
    // Second call should use cache, not fetch again
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns empty on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    const prices = await getPrices(["BTC"], mockFetch);
    expect(Object.keys(prices)).toHaveLength(0);
  });
});

describe("getSinglePrice", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPriceCache();
  });

  it("returns single price", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ solana: { usd: 150 } }),
    });
    const result = await getSinglePrice("SOL", mockFetch);
    expect(result).toEqual({ symbol: "SOL", usd: 150 });
  });

  it("returns null for unknown", async () => {
    const result = await getSinglePrice("FAKE", mockFetch);
    expect(result).toBeNull();
  });
});

describe("Agent entrypoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPriceCache();
  });

  it("/health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
  });

  it("exposes entrypoints", async () => {
    const res = await app.request("/entrypoints");
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items.map((i: any) => i.key)).toContain("price");
  });

  it("x402: price invoke without payment → 402", async () => {
    const res = await app.request("/entrypoints/price/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { symbols: ["BTC"] } }),
    });
    expect(res.status).toBe(402);
    const body: any = await res.json();
    expect(body.error).toContain("X-PAYMENT");
    expect(body.accepts[0].payTo).toBeDefined();
  });
});

describe("SYMBOL_TO_CG", () => {
  it("maps major tokens", () => {
    expect(SYMBOL_TO_CG.BTC).toBe("bitcoin");
    expect(SYMBOL_TO_CG.ETH).toBe("ethereum");
    expect(SYMBOL_TO_CG.SOL).toBe("solana");
    expect(SYMBOL_TO_CG.USDC).toBe("usd-coin");
  });

  it("has 20+ tokens", () => {
    expect(Object.keys(SYMBOL_TO_CG).length).toBeGreaterThanOrEqual(20);
  });
});
