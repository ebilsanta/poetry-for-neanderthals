import { beforeAll, afterEach, describe, it, expect } from "vitest";

import { initGameServer } from "@server/game/init";
import { allRooms, deleteRoom } from "@server/game/store";
import type { GameSocket } from "./handlers";
import type {
  RpcConnectionHelpers,
  RpcHandlerContext,
  RpcDefinition,
} from "./rpc/context";
import { createRoomHandlers } from "./rpc/rooms";
import { createTurnHandlers } from "./rpc/turns";
import { createRoundHandlers } from "./rpc/rounds";

type SessionState =
  | ReturnType<NonNullable<RpcConnectionHelpers["getContext"]>>
  | undefined;

function collectHandlers(...groups: RpcDefinition<unknown>[]) {
  const map = new Map<string, RpcDefinition<unknown>>();
  for (const group of groups) {
    map.set(group.event, group);
  }
  return map;
}

function buildContext() {
  let session: SessionState;
  const socket = {
    id: `socket-${Math.random().toString(16).slice(2)}`,
    data: {} as GameSocket["data"],
  } as GameSocket;

  const helpers: RpcConnectionHelpers = {
    getContext() {
      return session;
    },
    bind(room, playerId) {
      const player = room.players[playerId];
      session = { room, player, playerId };
      socket.data.session = { roomCode: room.code, playerId };
    },
    clearSession() {
      session = undefined;
      socket.data.session = undefined;
    },
  };

  const ctx: RpcHandlerContext = {
    io: {} as never,
    socket,
    helpers,
    now: () => Date.now(),
  };

  return { ctx, helpers, socket, getSession: () => session };
}

async function invoke(
  handler: RpcDefinition<unknown>,
  ctx: RpcHandlerContext,
  payload?: unknown,
) {
  return await handler.handler(ctx, payload);
}

describe("Socket RPC handlers", () => {
  const handlerMap = collectHandlers(
    ...createRoomHandlers(),
    ...createTurnHandlers(),
    ...createRoundHandlers(),
  );

  beforeAll(() => {
    initGameServer();
  });

  afterEach(() => {
    for (const [code] of allRooms()) {
      deleteRoom(code);
    }
  });

  it("runs through the happy path and enforces turn ordering", async () => {
    const host = buildContext();
    const guest = buildContext();

    const createRoom = handlerMap.get("rooms:create");
    const joinRoom = handlerMap.get("rooms:join");
    const startRound = handlerMap.get("rounds:start");
    const startTurn = handlerMap.get("turns:start");
    const nextCard = handlerMap.get("turns:next-card");

    if (!createRoom || !joinRoom || !startRound || !startTurn || !nextCard) {
      throw new Error("Required handlers not registered");
    }

    const createResp = (await invoke(createRoom, host.ctx, {
      name: "Creator",
    })) as
      | { error: { code: string } }
      | {
          room: { code: string };
          player: { id: string };
          playerToken: string;
        };

    expect(createResp).not.toHaveProperty("error");
    if ("error" in createResp) return;
    const roomCode = createResp.room.code;
    const creatorId = createResp.player.id;

    const joinResp = (await invoke(joinRoom, guest.ctx, {
      code: roomCode,
      body: { name: "Guest" },
    })) as
      | { error: { code: string } }
      | { player: { id: string }; playerToken: string };
    expect(joinResp).not.toHaveProperty("error");
    if ("error" in joinResp) return;

    const roundResp = (await invoke(startRound, host.ctx)) as
      | { error: { code: string } }
      | { roomState: string };
    expect(roundResp).not.toHaveProperty("error");
    if ("error" in roundResp) return;
    expect(roundResp.roomState).toBe("IN_ROUND");

    const turnResp = (await invoke(startTurn, host.ctx)) as
      | { error: { code: string } }
      | { turn: { id: string; poetId: string }; card?: { id: string } };
    expect(turnResp).not.toHaveProperty("error");
    if ("error" in turnResp) return;
    expect(turnResp.turn.poetId).toBe(creatorId);
    expect(turnResp.card).toBeDefined();

    const guestTurnAttempt = (await invoke(startTurn, guest.ctx)) as {
      error: { code: string };
    };
    expect(guestTurnAttempt.error.code).toBe("BAD_STATE");

    if (turnResp.card) {
      const nextCardResp = (await invoke(nextCard, host.ctx, {
        cardId: turnResp.card.id,
        outcome: "ONE",
      })) as
        | { error: { code: string } }
        | { turnId: string; lastCardDelta: Record<string, number> };
      expect(nextCardResp).not.toHaveProperty("error");
      if ("error" in nextCardResp) return;
      expect(nextCardResp.turnId).toBe(turnResp.turn.id);
    }
  });
});
