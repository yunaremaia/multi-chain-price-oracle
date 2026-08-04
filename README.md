# Multi-Chain Price Oracle

Pay-per-call x402 agent service: live USD prices for 20+ tokens (BTC, ETH, SOL, USDC, ...) via CoinGecko, with 60s caching.

## Endpoints

| Entrypoint | Description | Price |
|---|---|---|
| `price` | Get live USD price for 1–20 symbols | $0.001/call |
| `health` | Service status + supported tokens | free |

## Usage

```bash
# Discover (402 with payment requirements)
curl -X POST https://multi-chain-price-oracle.vercel.app/entrypoints/price/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"symbols":["BTC","ETH","SOL"]}}'

# Pay USDC (Base) then retry with X-PAYMENT header
curl -X POST https://multi-chain-price-oracle.vercel.app/entrypoints/price/invoke \
  -H 'content-type: application/json' \
  -H 'X-PAYMENT: <payment-payload>' \
  -d '{"input":{"symbols":["BTC","ETH","SOL"]}}'
```

## Response

```json
{
  "output": {
    "prices": { "BTC": { "usd": 65000 }, "ETH": { "usd": 3200 } },
    "symbols_found": ["BTC", "ETH"],
    "cache_age_seconds": 12
  }
}
```

## Supported tokens

BTC, ETH, SOL, USDC, USDT, DAI, BNB, MATIC, ARB, AVAX, OP, LINK, UNI, AAVE, WBTC, CRV, MKR, COMP, SUSHI, DYDX

## Tech stack

TypeScript · Hono · @lucid-dreams/agent-kit · x402 · Vercel

## Test

```bash
npm install
npm run test   # 11 vitest tests
```

## Funding

[.FUNDING.yml](.FUNDING.yml) — contributions and tips welcome.
