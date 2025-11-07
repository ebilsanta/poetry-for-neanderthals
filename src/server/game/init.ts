import { loadDeck } from "@server/game/deck";
import { RawDeck } from "@server/game/data/deck";

export function initGameServer() {
  loadDeck(RawDeck);
}
