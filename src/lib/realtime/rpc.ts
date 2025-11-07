import type { Socket } from "socket.io-client";

import type {
  CreateRoomRequest,
  CreateRoomResponse,
} from "@lib/contracts/http/rooms.create";
import type {
  JoinRoomRequest,
  JoinRoomResponse,
} from "@lib/contracts/http/rooms.join";
import type {
  StartTurnRequest,
  StartTurnResponse,
} from "@lib/contracts/http/turns.start";
import type {
  NextCardRequest,
  NextCardResponse,
} from "@lib/contracts/http/turns.nextCard";
import type {
  StartRoundRequest,
  StartRoundResponse,
} from "@lib/contracts/http/rounds.start";
import type {
  NextRoundRequest,
  NextRoundResponse,
} from "@lib/contracts/http/rounds.next";
import type {
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from "@lib/contracts/http/rooms.settings";
import type {
  AssignPlayersRequest,
  AssignPlayersResponse,
} from "@lib/contracts/http/rooms.teams";

export type JoinRoomRpcRequest = {
  code: string;
  body: JoinRoomRequest;
};

type RpcEventMap = {
  "rooms:create": {
    request: CreateRoomRequest;
    response: CreateRoomResponse;
  };
  "rooms:join": {
    request: JoinRoomRpcRequest;
    response: JoinRoomResponse;
  };
  "turns:start": {
    request: StartTurnRequest;
    response: StartTurnResponse;
  };
  "turns:next-card": {
    request: NextCardRequest;
    response: NextCardResponse;
  };
  "rounds:start": {
    request: StartRoundRequest;
    response: StartRoundResponse;
  };
  "rounds:next": {
    request: NextRoundRequest;
    response: NextRoundResponse;
  };
  "rooms:settings:update": {
    request: UpdateSettingsRequest;
    response: UpdateSettingsResponse;
  };
  "rooms:teams:assign": {
    request: AssignPlayersRequest;
    response: AssignPlayersResponse;
  };
};

export type RpcEventName = keyof RpcEventMap;
export type RpcRequest<TEvent extends RpcEventName> =
  RpcEventMap[TEvent]["request"];
export type RpcResponse<TEvent extends RpcEventName> =
  RpcEventMap[TEvent]["response"];

type RpcAckCallback<TEvent extends RpcEventName> = (
  response: RpcResponse<TEvent>,
) => void;

export function emitRpc<TEvent extends RpcEventName>(
  socket: Socket,
  event: TEvent,
  payload: RpcRequest<TEvent>,
  ack: RpcAckCallback<TEvent>,
) {
  socket.emit(event, payload, ack);
}

export function callRpc<TEvent extends RpcEventName>(
  socket: Socket,
  event: TEvent,
  payload: RpcRequest<TEvent>,
): Promise<RpcResponse<TEvent>> {
  return new Promise((resolve) => {
    emitRpc(socket, event, payload, (response) => {
      resolve(response);
    });
  });
}
