/**
 * Multi-Chain Price Oracle — Agent Service
 * Live crypto prices via CoinGecko with caching.
 * Entry points: price (single), prices (batch), health.
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

// ── Price Cache ──
let priceCache: Record<string, number> = {};
let priceCacheAt = 0;
const CACHE_TTL = 60_000; // 60s

export function resetPriceCache(): void {
  priceCache = {};
  priceCacheAt = 0;
}

// CoinGecko free tier: /simple/price
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Map common symbols to CoinGecko IDs
const SYMBOL_TO_CG: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BNB: "binancecoin",
  MATIC: "matic-network",
  ARB: "arbitrum",
  AVAX: "avalanche-2",
  OP: "optimism",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  WBTC: "wrapped-bitcoin",
  CRV: "curve-dao-token",
  MKR: "maker",
  COMP: "compound-governance-token",
  SUSHI: "sushi",
  DYDX: "dydx-chain",
};

// ── Core Functions ──

export async function getPrices(
  symbols: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  const now = Date.now();
  const needed = symbols.filter(
    (s) => !priceCache[s] || now - priceCacheAt > CACHE_TTL,
  );

  if (needed.length > 0) {
    const cgIds = needed
      .map((s) => SYMBOL_TO_CG[s.toUpperCase()])
      .filter(Boolean)
      .join(",");
    if (cgIds) {
      try {
        const url = `${COINGECKO_BASE}/simple/price?ids=${cgIds}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetchFn(url);
        if (res.ok) {
          const data: any = await res.json();
          for (const [sym, cgId] of Object.entries(SYMBOL_TO_CG)) {
            if (data[cgId]) {
              priceCache[sym] = data[cgId].usd;
            }
          }
          priceCacheAt = now;
        }
      } catch {
        // cache miss — use stale if available
      }
    }
  }

  const result: Record<string, { usd: number; usd_24h_change?: number }> = {};
  for (const sym of symbols) {
    if (priceCache[sym]) {
      result[sym.toUpperCase()] = { usd: priceCache[sym] };
    }
  }
  return result;
}

export async function getSinglePrice(
  symbol: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ symbol: string; usd: number } | null> {
  const prices = await getPrices([symbol], fetchFn);
  const entry = prices[symbol.toUpperCase()];
  if (entry) return { symbol: symbol.toUpperCase(), usd: entry.usd };
  return null;
}

// ── Agent App ──
const { app, addEntrypoint }: { app: any; addEntrypoint: any } =
  createAgentApp({
    name: "multi-chain-price-oracle",
    version: "1.0.0",
    description:
      "Live crypto prices across 20+ tokens via CoinGecko. Batch queries with 60s cache.",
  });

addEntrypoint({
  key: "price",
  description: "Get live USD price for one or more tokens",
  price: process.env.DEFAULT_PRICE ?? "0.001",
  input: z.object({
    symbols: z
      .array(z.string().max(10))
      .min(1)
      .max(20)
      .describe("Token symbols: BTC, ETH, SOL, USDC, etc."),
  }),
  async handler({ input }: { input: any }) {
    const prices = await getPrices(input.symbols);
    return {
      output: {
        prices,
        symbols_requested: input.symbols.map((s: string) => s.toUpperCase()),
        symbols_found: Object.keys(prices),
        cache_age_seconds: Math.round((Date.now() - priceCacheAt) / 1000),
      },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Health check",
  input: z.object({}),
  async handler() {
    return {
      output: {
        ok: true,
        timestamp: new Date().toISOString(),
        supported_tokens: Object.keys(SYMBOL_TO_CG),
        cache_ttl_seconds: CACHE_TTL / 1000,
      },
    };
  },
});

app.get("/health", (c: any) =>
  c.json({ ok: true, version: "1.0.0", service: "multi-chain-price-oracle" }),
);

// x402 discovery manifest (RFC-ish: lets agents find the service)
app.get("/.well-known/x402.json", (c: any) =>
  c.json({
    name: "multi-chain-price-oracle",
    description:
      "Live crypto prices across 20+ tokens via CoinGecko. Batch queries with 60s cache.",
    version: "1.0.0",
    payTo: process.env.ADDRESS ?? "",
    network: "base-sepolia",
    asset: "0x036CbD53842c5426634e7EADB88d31E138c4bCc8", // USDC on Base
    endpoints: [
      {
        key: "price",
        path: "/entrypoints/price/invoke",
        method: "POST",
        price: process.env.DEFAULT_PRICE ?? "0.001",
        description: "Get live USD price for one or more tokens",
      },
      {
        key: "health",
        path: "/entrypoints/health/invoke",
        method: "POST",
        price: "0",
        description: "Service status + supported tokens",
      },
    ],
  }),
);

export default app;
export { app, SYMBOL_TO_CG };
