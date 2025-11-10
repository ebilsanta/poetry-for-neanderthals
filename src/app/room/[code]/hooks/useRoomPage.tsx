"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callRpc } from "@/lib/realtime/rpc";
import {
  attachRoomEventHandlers,
  connectRoomSocket,
  createRoomSocket,
  disconnectRoomSocket,
  type RoomEventHandlers,
  updateRoomSocketAuth,
} from "@/lib/realtime/socketManager";
import { useParams } from "next/navigation";
import { GetRoomResponse } from "@lib/contracts/http/rooms.get";
import type { JoinRoomResponse } from "@lib/contracts/http/rooms.join";
import type { VisibleRoomSnapshot, VisibleCard } from "@lib/view/visible";
import type { StartRoundResponse } from "@lib/contracts/http/rounds.start";

const STORAGE_KEYS = {
  playerId: "pfn_player_id",
  playerName: "pfn_player_name",
  token: "pfn_token",
};

type CardOverrideState = {
  card: VisibleCard | null;
  remainingMs?: number;
} | null;

export type StoredSession = {
  playerId?: string;
  playerName?: string;
  playerToken?: string;
};

function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;

  const playerName = sessionStorage.getItem(STORAGE_KEYS.playerName);
  const playerToken = sessionStorage.getItem(STORAGE_KEYS.token);
  const playerId = sessionStorage.getItem(STORAGE_KEYS.playerId) ?? undefined;

  if (!playerName && !playerToken) return null;

  return {
    playerName: playerName ?? undefined,
    playerToken: playerToken ?? undefined,
    playerId,
  };
}

export const useRoomPage = () => {
  const [room, setRoom] = useState<VisibleRoomSnapshot | null>(null);
  const [roomInfo, setRoomInfo] = useState<Pick<
    VisibleRoomSnapshot,
    "code" | "state"
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [startingTurn, setStartingTurn] = useState(false);
  const [cardOverride, setCardOverride] = useState<CardOverrideState>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const session = useMemo(() => getStoredSession(), []);
  const socketRef = useRef<ReturnType<typeof createRoomSocket> | null>(null);
  const detachHandlersRef = useRef<(() => void) | null>(null);

  const params = useParams<{ code?: string }>();
  const roomCode = useMemo(
    () => params?.code?.toUpperCase() ?? "",
    [params?.code],
  );

  const backendUrl = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? backendUrl;

  const syncCardFromSnapshot = useCallback(
    (snap: {
      state: VisibleRoomSnapshot["state"];
      round?: VisibleRoomSnapshot["round"];
    }) => {
      if (snap.state !== "IN_ROUND" || !snap.round?.activeTurn) {
        setCardOverride(null);
        return;
      }
      const active = snap.round.activeTurn;
      const hasWords =
        Boolean(active.activeCard?.onePoint) &&
        active.activeCard?.onePoint !== "REDACTED_AT_SEND" &&
        Boolean(active.activeCard?.threePoint) &&
        active.activeCard?.threePoint !== "REDACTED_AT_SEND";
      setCardOverride({
        card: hasWords
          ? {
              id: active.activeCard!.id,
              onePoint: active.activeCard!.onePoint!,
              threePoint: active.activeCard!.threePoint ?? "",
            }
          : null,
        remainingMs:
          active.remainingSeconds !== undefined
            ? active.remainingSeconds * 1000
            : active.endsAt
              ? Math.max(0, active.endsAt - Date.now())
              : undefined,
      });
    },
    [],
  );
  const ensureSocket = useCallback(async () => {
    if (!roomCode) {
      throw new Error("Missing room code");
    }

    if (!socketRef.current) {
      socketRef.current = createRoomSocket({
        baseUrl: backendUrl,
        roomCode,
        token: session?.playerToken,
      });
    } else if (session?.playerToken) {
      updateRoomSocketAuth(socketRef.current, roomCode, session.playerToken);
    }

    const socket = socketRef.current;

    await connectRoomSocket(socket);

    const handlers: RoomEventHandlers = {
      onRoomState: ({ room: snap }) => {
        setRoom(snap);
        setRoomInfo({ code: snap.code, state: snap.state });
        syncCardFromSnapshot(snap);
      },
      onTurnCard: (payload) => {
        setCardOverride({
          card: payload.card
            ? {
                id: payload.card.id,
                onePoint: payload.card.onePoint,
                threePoint: payload.card.threePoint,
              }
            : null,
          remainingMs: payload.remainingMs,
        });
      },
      onTurnEnded: () => {
        setCardOverride(null);
        setStartingTurn(false);
      },
      onRoundEnded: () => {
        setRoomInfo((prev) =>
          prev ? { ...prev, state: "BETWEEN_ROUNDS" } : prev,
        );
        setCardOverride(null);
      },
    };

    detachHandlersRef.current?.();
    detachHandlersRef.current = attachRoomEventHandlers(socket, handlers);

    return socket;
  }, [backendUrl, roomCode, session, syncCardFromSnapshot]);

  useEffect(() => {
    let cancelled = false;

    if (!roomCode) {
      setLoading(false);
      setError("Missing or invalid room code.");
      return;
    }

    async function hydrate() {
      try {
        setLoading(true);
        const res = await fetch(`${apiBaseUrl}/rooms/${roomCode}`, {
          method: "GET",
          mode: "cors",
        });
        const data = GetRoomResponse.parse(await res.json());

        if (!res.ok || "error" in data) {
          if (!cancelled) {
            setRoomInfo(null);
            setError(
              "error" in data ? data.error.message : "Failed to load room",
            );
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;

        setRoomInfo(data.room);
        syncCardFromSnapshot(data.room);

        if (session && session.playerToken && session.playerName) {
          try {
            const socket = await ensureSocket();
            const response = (await callRpc(socket, "rooms:join", {
              code: roomCode,
              body: { name: session.playerName },
            })) as JoinRoomResponse;

            if (cancelled) return;

            if ("error" in response) {
              setError(response.error.message);
              setLoading(false);
              return;
            }

            setRoom(response.room);
            syncCardFromSnapshot(response.room);
            setRoomInfo({
              code: response.room.code,
              state: response.room.state,
            });
            sessionStorage.setItem(STORAGE_KEYS.token, response.playerToken);
            sessionStorage.setItem(
              STORAGE_KEYS.playerName,
              response.player.name,
            );
            sessionStorage.setItem(STORAGE_KEYS.playerId, response.player.id);
            setError(null);
            setLoading(false);
            return;
          } catch (err) {
            if (!cancelled) {
              console.error("Failed to join room", err);
              setError("Unable to join the room. Please try reloading.");
              setLoading(false);
            }
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load room", err);
          setError("Unable to load the room. Please try reloading.");
          setRoomInfo(null);
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      detachHandlersRef.current?.();
      detachHandlersRef.current = null;
      if (socketRef.current) {
        disconnectRoomSocket(socketRef.current);
        socketRef.current = null;
      }
    };
  }, [apiBaseUrl, ensureSocket, roomCode, session, syncCardFromSnapshot]);

  const handleCopyCode = useCallback(() => {
    const code = room?.code ?? roomCode;
    if (!code) return;
    void navigator.clipboard
      .writeText(code)
      .then(() => console.log("Copied room code"))
      .catch((err) => console.error("Failed to copy room code", err));
  }, [room, roomCode]);

  const playersById = useMemo(() => {
    if (!room) {
      return new Map<string, VisibleRoomSnapshot["players"][number]>();
    }
    return new Map(room.players.map((p) => [p.id, p]));
  }, [room]);

  const handleOpenSettings = () => {
    console.log("open settings");
  };

  const playerId = session?.playerId;
  const viewer = playerId ? playersById.get(playerId) : undefined;
  const isCreator = viewer?.isCreator ?? false;
  const playerCount = room?.players.length ?? 0;
  const canStartGame = playerCount >= 2;

  const handleStartGame = useCallback(async () => {
    if (!room || !socketRef.current) return;
    try {
      const socket = await ensureSocket();
      const response = (await callRpc(
        socket,
        "rounds:start",
        {},
      )) as StartRoundResponse;
      if ("error" in response) {
        setError(response.error.message);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error("Failed to start game", err);
      setError("Unable to start the game. Please try again.");
    }
  }, [ensureSocket, room]);

  const activeTurnEndsAt = room?.round?.activeTurn?.endsAt ?? null;

  useEffect(() => {
    if (!activeTurnEndsAt && cardOverride?.remainingMs == null) {
      return;
    }
    setNowTs(Date.now());
    const id = window.setInterval(() => setNowTs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [activeTurnEndsAt, cardOverride?.remainingMs]);

  const round = room?.round;
  const activeTurn = round?.activeTurn;
  const completedTurnsCount = round?.completedTurns ?? 0;
  const nextPoetIdFromOrder =
    round && completedTurnsCount < round.poetOrder.length
      ? round.poetOrder[completedTurnsCount]
      : undefined;
  const currentPoetId = activeTurn?.poetId ?? nextPoetIdFromOrder;
  const currentPoetName = currentPoetId
    ? playersById.get(currentPoetId)?.name
    : undefined;
  const hasActiveTurn = Boolean(activeTurn);
  const isCurrentPoet =
    currentPoetId !== undefined && currentPoetId === playerId;
  const canStartTurn = isCurrentPoet && !hasActiveTurn;

  const activeCard =
    cardOverride?.card ?? round?.activeTurn?.activeCard ?? null;
  const overrideRemainingMs = cardOverride?.remainingMs ?? null;
  const endsAt = round?.activeTurn?.endsAt ?? null;
  const startedAt = round?.activeTurn?.startedAt ?? null;
  const totalDurationMs =
    endsAt && startedAt
      ? endsAt - startedAt
      : room?.settings.turnSeconds
        ? room.settings.turnSeconds * 1000
        : null;
  const computedRemainingMs = endsAt
    ? Math.max(0, endsAt - nowTs)
    : overrideRemainingMs !== null
      ? Math.max(0, overrideRemainingMs)
      : null;
  const remainingSeconds =
    computedRemainingMs !== null
      ? Math.max(0, Math.ceil(computedRemainingMs / 1000))
      : null;
  const percentRemaining =
    totalDurationMs && computedRemainingMs !== null && totalDurationMs > 0
      ? Math.max(
          0,
          Math.min(100, (computedRemainingMs / totalDurationMs) * 100),
        )
      : null;
  const showTimer =
    room?.state === "IN_ROUND" &&
    remainingSeconds !== null &&
    totalDurationMs !== null;
  const displayCard =
    activeCard &&
    activeCard.onePoint &&
    activeCard.onePoint !== "REDACTED_AT_SEND" &&
    activeCard.threePoint &&
    activeCard.threePoint !== "REDACTED_AT_SEND"
      ? activeCard
      : null;

  const poetTurnLabel = currentPoetName
    ? currentPoetName.endsWith("s")
      ? `${currentPoetName}\u2019 turn.`
      : `${currentPoetName}'s turn.`
    : "Waiting for next poet...";

  const handleStartTurn = useCallback(async () => {
    if (!room) return;
    setStartingTurn(true);
    try {
      const socket = await ensureSocket();
      const response = await callRpc(socket, "turns:start", {});
      if ("error" in response) {
        setError(response.error.message);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error("Failed to start turn", err);
      setError("Unable to start the turn. Please try again.");
    } finally {
      setStartingTurn(false);
    }
  }, [ensureSocket, room]);

  return {
    loading,
    roomInfo,
    room,
    error,
    ensureSocket,
    joinName,
    setJoinName,
    playersById,
    session,
    round,
    setError,
    setRoom,
    setRoomInfo,
    joining,
    setJoining,
    handleOpenSettings,
    STORAGE_KEYS,
    roomCode,
    handleStartTurn,
    isCreator,
    showTimer,
    handleCopyCode,
    handleStartGame,
    canStartGame,
    canStartTurn,
    startingTurn,
    hasActiveTurn,
    isCurrentPoet,
    poetTurnLabel,
    displayCard,
    remainingSeconds,
    percentRemaining,
  };
};
