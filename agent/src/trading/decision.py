"""
Decision engine — converts signal scores into BUY / WATCH / HOLD actions.
"""

from enum import Enum
from dataclasses import dataclass
from typing import List

from .signals import SignalScores, PricePoint, compute_signals


class Action(str, Enum):
    BUY = "BUY"
    WATCH = "WATCH"
    HOLD = "HOLD"


@dataclass
class Decision:
    action: Action
    score: float
    signals: SignalScores
    current_price: float
    target_price: float


BUY_THRESHOLD = 0.75
WATCH_THRESHOLD = 0.50


def evaluate(
    current_price: float,
    target_price: float,
    history: List[PricePoint],
) -> Decision:
    """
    Evaluate whether to BUY, WATCH, or HOLD.

    Rules:
      BUY   — composite score ≥ 0.75 AND current_price ≤ target_price
      WATCH — composite score ≥ 0.50
      HOLD  — composite score < 0.50
    """
    signals = compute_signals(current_price, target_price, history)
    score = signals.composite

    if score >= BUY_THRESHOLD and current_price <= target_price:
        action = Action.BUY
    elif score >= WATCH_THRESHOLD:
        action = Action.WATCH
    else:
        action = Action.HOLD

    return Decision(
        action=action,
        score=score,
        signals=signals,
        current_price=current_price,
        target_price=target_price,
    )
