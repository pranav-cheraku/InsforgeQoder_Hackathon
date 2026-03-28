"""
Trading signal indicators — adapted from quantitative finance for retail prices.
Each indicator returns a score in [0.0, 1.0] where 1.0 = strong buy signal.
"""

from dataclasses import dataclass
from typing import List


@dataclass
class PricePoint:
    price: float
    scraped_at: str  # ISO timestamp


@dataclass
class SignalScores:
    price_vs_target: float   # weight: 40%
    moving_average: float    # weight: 25%
    trend_direction: float   # weight: 20%
    volatility_score: float  # weight: 15%

    @property
    def composite(self) -> float:
        return (
            self.price_vs_target * 0.40
            + self.moving_average * 0.25
            + self.trend_direction * 0.20
            + self.volatility_score * 0.15
        )


def score_price_vs_target(current_price: float, target_price: float) -> float:
    """
    Score based on how far current price is below target.
    1.0 = at or below target. 0.0 = 20%+ above target.
    """
    if current_price <= target_price:
        return 1.0
    pct_above = (current_price - target_price) / target_price
    return max(0.0, 1.0 - (pct_above / 0.20))


def score_moving_average(history: List[PricePoint], window: int = 7) -> float:
    """
    Score based on current price vs 7-day moving average.
    1.0 = current price is well below the MA (clear dip).
    0.5 = at MA. 0.0 = significantly above MA.
    """
    if len(history) < 2:
        return 0.5  # not enough data, neutral

    prices = [p.price for p in history]
    current = prices[-1]
    ma_prices = prices[-window:] if len(prices) >= window else prices
    moving_avg = sum(ma_prices) / len(ma_prices)

    if moving_avg == 0:
        return 0.5

    pct_diff = (moving_avg - current) / moving_avg  # positive = current below MA
    # Scale: +10% below MA → 1.0, at MA → 0.5, +10% above MA → 0.0
    return max(0.0, min(1.0, 0.5 + (pct_diff / 0.10) * 0.5))


def score_trend_direction(history: List[PricePoint], lookback: int = 5) -> float:
    """
    Score based on price trend over the last N data points.
    1.0 = consistently declining. 0.5 = flat. 0.0 = consistently rising.
    """
    if len(history) < 3:
        return 0.5

    recent = [p.price for p in history[-lookback:]]
    if len(recent) < 2:
        return 0.5

    # Count declining vs rising steps
    declining = sum(1 for i in range(1, len(recent)) if recent[i] < recent[i - 1])
    rising = sum(1 for i in range(1, len(recent)) if recent[i] > recent[i - 1])
    total = len(recent) - 1

    return declining / total if total > 0 else 0.5


def score_volatility(history: List[PricePoint], window: int = 14) -> float:
    """
    Score based on price volatility. Low volatility at a low price = stable deal.
    High volatility = wait for clearer signal.
    1.0 = low volatility (stable dip). 0.0 = high volatility.
    """
    if len(history) < 3:
        return 0.5

    prices = [p.price for p in history[-window:]]
    mean = sum(prices) / len(prices)
    if mean == 0:
        return 0.5

    variance = sum((p - mean) ** 2 for p in prices) / len(prices)
    std_dev = variance ** 0.5
    cv = std_dev / mean  # coefficient of variation

    # CV < 0.02 → very stable (1.0). CV > 0.15 → very volatile (0.0).
    return max(0.0, min(1.0, 1.0 - (cv / 0.15)))


def compute_signals(
    current_price: float,
    target_price: float,
    history: List[PricePoint],
) -> SignalScores:
    return SignalScores(
        price_vs_target=score_price_vs_target(current_price, target_price),
        moving_average=score_moving_average(history),
        trend_direction=score_trend_direction(history),
        volatility_score=score_volatility(history),
    )
