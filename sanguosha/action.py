"""统一动作描述（人类与 AI 共用）"""

from dataclasses import dataclass
from typing import Optional, List

from .card import Card
from .player import Player


@dataclass
class Action:
    kind: str           # play / give / end / info
    card: Optional[Card] = None
    target: Optional[Player] = None
    cards: Optional[List[Card]] = None
    as_type: str = ""
