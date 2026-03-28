# Trading Algorithm

The InsForge `trading-agent` edge function uses a composite scoring system adapted from quantitative trading strategies. It reads price data written by the FastAPI backend scraper and decides whether to BUY, WATCH, or HOLD.

## Signal Indicators

| Indicator | Logic | Weight |
|-----------|-------|--------|
| **Price vs Target** | `score = 1.0` if price ≤ target; scales down proportionally above target | **40%** |
| **Moving Average** | `score = 1.0` if price < 7-day MA (dip signal); scales down if above MA | **25%** |
| **Trend Direction** | `score = 1.0` if last 3 data points are declining; 0.5 if flat; 0.0 if rising | **20%** |
| **Volatility Score** | Low CV → high score (stable = safe to buy); high CV → low score (wait) | **15%** |

## Composite Score Calculation

```
composite = (priceVsTarget × 0.40)
          + (movingAverage × 0.25)
          + (trendDirection × 0.20)
          + (volatility × 0.15)
```

## Decision Thresholds

| Decision | Condition |
|----------|-----------|
| **BUY** | composite ≥ 0.75 **AND** current_price ≤ target_price |
| **WATCH** | composite ≥ 0.50 (any price) |
| **HOLD** | composite < 0.50 |

Note: `BUY` requires both conditions — high score alone is not enough if the price hasn't hit the target.

## Signal Deep Dive

### 1. Price vs Target (40%)
The most important signal. A product at or below the user's target is the primary buy trigger.

```
score = 1.0                                    if current ≤ target
score = max(0, 1 - (current - target) / target) if current > target
```

**Example:** Target $280, current $320 → gap is $40 (14.3% above) → score ≈ 0.857

### 2. Moving Average (25%)
Compares current price to the 7-day rolling average. A price below the MA suggests a temporary dip.

```
recent_7 = price_history[-7:]
MA = mean(recent_7)
score = 1.0              if current < MA
score = max(0, 1 - (current - MA) / MA) if current ≥ MA
```

**Example:** MA = $310, current = $295 → price is below MA → score = 1.0

### 3. Trend Direction (20%)
Looks at the last 3 price data points to determine direction.

```
tail = prices[-3:]
declining → score = 1.0   (buying into a downtrend)
flat      → score = 0.5   (neutral)
rising    → score = 0.0   (don't buy into a rising price)
```

### 4. Volatility Score (15%)
Uses the coefficient of variation (CV = std/mean) of recent 7 prices.
Low volatility means the price is likely to stay at the low level.

```
CV < 0.02 → score = 1.0   (very stable)
CV < 0.05 → score = 0.75  (stable)
CV < 0.10 → score = 0.5   (moderate)
CV < 0.20 → score = 0.25  (volatile)
CV ≥ 0.20 → score = 0.0   (very volatile)
```

## LLM Reasoning

After computing signals, the agent calls the InsForge AI Gateway with:
- Model: `anthropic/claude-3.5-haiku`
- System prompt: "You are DealFlow, an AI trading agent. Explain decisions in 2-3 sentences, data-driven."
- Context: decision, all signal scores, price data, product name

The LLM generates a human-readable explanation like:
> "Price dropped 18% over 5 days, now $12 below your target. 7-day moving average confirms the downtrend. Volatility is low — this is a stable dip, not a flash sale. Executing buy."

If the LLM call fails, a deterministic fallback reasoning string is generated from the signal values.

## Price Data Source

Price history consumed by the trading algorithm is written by the **FastAPI backend** (`backend/services/scraper.py`), which uses Claude with the `web_search` tool to fetch real prices across retailers. The InsForge `price-scraper` edge function has been removed.

## Demo Setup

Seed price data so one product is exactly 1 data point away from a BUY trigger:
- 29 days of declining price data (already in `docs/database-setup.sql`)
- Insert 1 final price point during the demo → composite crosses 0.75 → BUY fires live

```sql
INSERT INTO price_history (item_id, price, retailer)
VALUES ('11111111-0000-0000-0000-000000000001', 278.50, 'amazon');

UPDATE wishlist_items SET current_price = 278.50
WHERE id = '11111111-0000-0000-0000-000000000001';
```

Then invoke `trading-agent` — BUY fires live.
