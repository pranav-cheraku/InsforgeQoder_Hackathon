"""
LLM reasoning explainer — generates human-readable explanations for agent decisions.
Uses Claude to translate raw signal scores into the kind of plain-English reasoning
shown in the app's agent decision log.
"""

import anthropic
from ..config import settings
from ..trading.decision import Decision, Action


class DecisionExplainer:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def explain(self, decision: Decision, product_name: str, history_length: int) -> str:
        """Generate a plain-English explanation of the agent's trading decision."""
        s = decision.signals
        pct_vs_target = ((decision.current_price - decision.target_price) / decision.target_price) * 100

        prompt = f"""You are Snag, an AI shopping agent. Explain your decision in 2-3 sentences.
Be specific with numbers. Sound like a confident trading algorithm, not a chatbot.
Do NOT start with "I" — start with the most important fact.

Decision: {decision.action.value}
Product: {product_name}
Current price: ${decision.current_price:.2f}
Target price: ${decision.target_price:.2f}
Price vs target: {pct_vs_target:+.1f}%
Composite score: {decision.score:.2f}/1.00

Signal breakdown:
- Price vs target score: {s.price_vs_target:.2f} (weight 40%)
- Moving average score: {s.moving_average:.2f} (weight 25%) — {'below' if s.moving_average > 0.5 else 'above'} 7-day MA
- Trend direction score: {s.trend_direction:.2f} (weight 20%) — price {'declining' if s.trend_direction > 0.5 else 'rising'} recently
- Volatility score: {s.volatility_score:.2f} (weight 15%) — {'stable' if s.volatility_score > 0.6 else 'volatile'} pricing
- Data points analyzed: {history_length}

Write the explanation now:"""

        message = self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text.strip()


# Singleton
explainer = DecisionExplainer()
