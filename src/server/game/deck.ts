import { RawCard } from "@/server/game/types";

// In-memory registry
const DECK = new Map<string, RawCard>();

export function getCardWords(cardId: string): RawCard {
  const card = DECK.get(cardId);
  if (!card) {
    throw new Error(`Card not found in deck: ${cardId}`);
  }
  return card;
}

// Load deck from static file
export function loadDeck(raw: ReadonlyArray<RawCard>) {
  DECK.clear();
  for (const entry of raw) {
    if (!entry.id || !entry.onePoint || !entry.threePoint) {
      throw new Error(`Invalid card entry: ${JSON.stringify(entry)}`);
    }
    DECK.set(entry.id, {
      id: entry.id,
      onePoint: entry.onePoint.trim(),
      threePoint: entry.threePoint.trim(),
    });
  }
}

// Utility for tests / dynamically adding cards
export function upsertCard(card: RawCard) {
  DECK.set(card.id, card);
}

export function getAllCardIds(): string[] {
  return Array.from(DECK.keys());
}
