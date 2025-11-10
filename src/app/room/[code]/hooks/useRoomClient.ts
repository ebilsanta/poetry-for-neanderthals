"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { callRpc } from "@/lib/realtime/rpc";
import {
  attachRoomEventHandlers,
  connectRoomSocket,
  createRoomSocket,
  disconnectRoomSocket,
  updateRoomSocketAuth,
  type RoomSocket,
} from "@/lib/realtime/socketManager";
import {
  VisibleRoomSnapshot as VisibleRoomSnapshotSchema,
  type VisibleRoomSnapshot,
} from "@lib/view/visible";
import { GetRoomResponse } from "@lib/contracts/http/rooms.get";
import type { JoinRoomResponse } from "@lib/contracts/http/rooms.join";
import type { StartRoundResponse } from "@lib/contracts/http/rounds.start";
import type { StartTurnResponse } from "@lib/contracts/http/turns.start";

const STORAGE_KEYS = {
  playerId: "pfn_player_id",
  playerName: "pfn_player_name",
  token: "pfn_token",
  roomCode: "pfn_room_code",
};

type CardOverrideState = {
  card: { id: string; onePoint: string; threePoint: string } | null;
  remainingMs?: number;
} | null;

type StoredSession = {
  playerId?: string;
  playerName?: string;
  playerToken?: string;
  roomCode?: string;
};

export type TeamView = {
  id: "A" | "B";
  name: string;
  score: number;
  players: VisibleRoomSnapshot["players"];
};

type PlayerSummary = VisibleRoomSnapshot["players"][number];

export type RoomPhase =
  | "loading"
  | "notFound"
  | "joinPrompt"
  | "spectatorLocked"
  | "lobby"
  | "inRound"
  | "betweenRounds"
  | "ended";

export type CardState = {
  displayCard: { id: string; onePoint: string; threePoint: string } | null;
  showTimer: boolean;
  percentRemaining: number | null;
  remainingSeconds: number | null;
  poetTurnLabel: string;
  isCurrentPoet: boolean;
  canStartTurn: boolean;
  hasActiveTurn: boolean;
};

function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const playerName = sessionStorage.getItem(STORAGE_KEYS.playerName);
  const playerToken = sessionStorage.getItem(STORAGE_KEYS.token);
  const playerId = sessionStorage.getItem(STORAGE_KEYS.playerId) ?? undefined;
  const roomCode = sessionStorage.getItem(STORAGE_KEYS.roomCode) ?? undefined;

  if (!playerName && !playerToken) return null;
  return {
    playerName: playerName ?? undefined,
    playerToken: playerToken ?? undefined,
    playerId,
    roomCode,
  };
}

function writeSession(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    sessionStorage.removeItem(STORAGE_KEYS.playerId);
    sessionStorage.removeItem(STORAGE_KEYS.playerName);
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.roomCode);
    return;
  }
  if (session.playerId) {
    sessionStorage.setItem(STORAGE_KEYS.playerId, session.playerId);
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.playerId);
  }
  if (session.playerName) {
    sessionStorage.setItem(STORAGE_KEYS.playerName, session.playerName);
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.playerName);
  }
  if (session.playerToken) {
    sessionStorage.setItem(STORAGE_KEYS.token, session.playerToken);
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.token);
  }
  if (session.roomCode) {
    sessionStorage.setItem(STORAGE_KEYS.roomCode, session.roomCode);
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.roomCode);
  }
}

export function useRoomClient(rawRoomCode: string | undefined) {
  const roomCode = (rawRoomCode ?? "").toUpperCase();

  const [session, setSession] = useState<StoredSession | null>(() =>
    getStoredSession(),
  );
  const [room, setRoom] = useState<VisibleRoomSnapshot | null>(null);
  const [roomInfo, setRoomInfo] = useState<{
    code: string;
    state: VisibleRoomSnapshot["state"];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [startingTurn, setStartingTurn] = useState(false);
  const [cardOverride, setCardOverride] = useState<CardOverrideState>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const socketRef = useRef<RoomSocket | null>(null);
  const detachHandlersRef = useRef<(() => void) | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_WS_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? backendUrl;

  useEffect(() => {
    if (session?.roomCode && session.roomCode !== roomCode) {
      writeSession(null);
      setSession(null);
    }
  }, [roomCode, session?.roomCode]);

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

    const tokenForRoom =
      session?.roomCode === roomCode ? session.playerToken : undefined;

    if (
      !socketRef.current ||
      (session?.roomCode && session.roomCode !== roomCode)
    ) {
      if (socketRef.current) {
        disconnectRoomSocket(socketRef.current);
      }
      socketRef.current = createRoomSocket({
        baseUrl: backendUrl,
        roomCode,
        token: tokenForRoom,
      });
    } else {
      updateRoomSocketAuth(socketRef.current, roomCode, tokenForRoom);
    }

    const socket = socketRef.current!;
    await connectRoomSocket(socket);

    const handlers = {
      onRoomState: ({ room: snap }: { room: VisibleRoomSnapshot }) => {
        setRoom(snap);
        setRoomInfo({ code: snap.code, state: snap.state });
        syncCardFromSnapshot(snap);
      },
      onTurnCard: ({
        card,
        remainingMs,
      }: {
        card: { id: string; onePoint?: string; threePoint?: string } | null;
        remainingMs?: number;
      }) => {
        setCardOverride({
          card:
            card && card.onePoint && card.threePoint
              ? {
                  id: card.id,
                  onePoint: card.onePoint,
                  threePoint: card.threePoint,
                }
              : null,
          remainingMs,
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
  }, [
    backendUrl,
    roomCode,
    session?.playerToken,
    session?.roomCode,
    syncCardFromSnapshot,
  ]);

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
        const json = await res.json();
        const parsed = GetRoomResponse.safeParse(json);

        if (!res.ok || !parsed.success) {
          if (!cancelled) {
            setRoomInfo(null);
            setError("Failed to load room");
            setLoading(false);
          }
          return;
        }

        const payload = parsed.data;
        if ("error" in payload) {
          if (!cancelled) {
            setRoomInfo(null);
            setError(payload.error.message);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;

        setRoomInfo({ code: payload.room.code, state: payload.room.state });
        setCardOverride(null);

        if (
          session?.playerToken &&
          session.playerName &&
          session.roomCode === roomCode
        ) {
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

            const parsedRoom = VisibleRoomSnapshotSchema.parse(response.room);
            setRoom(parsedRoom);
            syncCardFromSnapshot(parsedRoom);
            setRoomInfo({
              code: parsedRoom.code,
              state: parsedRoom.state,
            });
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
  }, [
    apiBaseUrl,
    ensureSocket,
    roomCode,
    session?.playerName,
    session?.playerToken,
    session?.roomCode,
    syncCardFromSnapshot,
  ]);

  const activeTurnEndsAt = room?.round?.activeTurn?.endsAt ?? null;
  useEffect(() => {
    if (!activeTurnEndsAt && cardOverride?.remainingMs == null) {
      return;
    }
    setNowTs(Date.now());
    const id = window.setInterval(() => setNowTs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [activeTurnEndsAt, cardOverride?.remainingMs]);

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerSummary>();
    if (room) {
      for (const player of room.players) {
        map.set(player.id, player);
      }
    }
    return map;
  }, [room]);

  const teams = useMemo<TeamView[]>(() => {
    if (!room) return [];
    const teamNames = room.settings.teamNames ?? { A: "Team A", B: "Team B" };
    return (["A", "B"] as const).map((id) => {
      const players = room.teams[id].players
        .map((pid) => playersById.get(pid))
        .filter(Boolean) as PlayerSummary[];
      return {
        id,
        name: teamNames[id],
        score: room.teams[id].score,
        players,
      };
    });
  }, [playersById, room]);

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
    currentPoetId !== undefined && currentPoetId === session?.playerId;
  const canStartTurn = isCurrentPoet && !hasActiveTurn;

  const activeCard =
    cardOverride?.card ??
    (activeTurn?.activeCard &&
    activeTurn.activeCard.onePoint &&
    activeTurn.activeCard.onePoint !== "REDACTED_AT_SEND" &&
    activeTurn.activeCard.threePoint &&
    activeTurn.activeCard.threePoint !== "REDACTED_AT_SEND"
      ? {
          id: activeTurn.activeCard.id,
          onePoint: activeTurn.activeCard.onePoint,
          threePoint: activeTurn.activeCard.threePoint,
        }
      : null);

  const overrideRemainingMs = cardOverride?.remainingMs ?? null;
  const endsAt = activeTurn?.endsAt ?? null;
  const startedAt = activeTurn?.startedAt ?? null;
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

  const poetTurnLabel = currentPoetName
    ? currentPoetName.endsWith("s")
      ? `${currentPoetName}\u2019 turn.`
      : `${currentPoetName}'s turn.`
    : "Waiting for next poet...";

  const lobbyPlayerCount = room
    ? room.teams.A.players.length + room.teams.B.players.length
    : 0;
  const isCreator =
    session?.playerId !== undefined &&
    Boolean(playersById.get(session.playerId)?.isCreator);
  const canStartGame = lobbyPlayerCount >= 2;
  const tooltipLabel = canStartGame
    ? null
    : "Need at least two players to start";

  const joinRoom = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        const err = new Error("Name is required");
        setError(err.message);
        throw err;
      }
      setJoining(true);
      try {
        const socket = await ensureSocket();
        const response = (await callRpc(socket, "rooms:join", {
          code: roomCode,
          body: { name: trimmed },
        })) as JoinRoomResponse;
        if ("error" in response) {
          setError(response.error.message);
          throw new Error(response.error.message);
        }
        const parsedRoom = VisibleRoomSnapshotSchema.parse(response.room);
        setRoom(parsedRoom);
        syncCardFromSnapshot(parsedRoom);
        setRoomInfo({
          code: parsedRoom.code,
          state: parsedRoom.state,
        });
        const nextSession: StoredSession = {
          playerId: response.player.id,
          playerName: response.player.name,
          playerToken: response.playerToken,
          roomCode,
        };
        writeSession(nextSession);
        setSession(nextSession);
        setError(null);
      } finally {
        setJoining(false);
      }
    },
    [ensureSocket, roomCode, syncCardFromSnapshot],
  );

  const startGame = useCallback(async () => {
    if (!room) return;
    setStartingRound(true);
    try {
      const socket = await ensureSocket();
      const response = (await callRpc(
        socket,
        "rounds:start",
        {},
      )) as StartRoundResponse;
      if ("error" in response) {
        setError(response.error.message);
        return;
      }
      const parsedRoom = VisibleRoomSnapshotSchema.parse(response.room);
      setRoom(parsedRoom);
      syncCardFromSnapshot(parsedRoom);
      setRoomInfo({
        code: parsedRoom.code,
        state: parsedRoom.state,
      });
      setError(null);
    } finally {
      setStartingRound(false);
    }
  }, [ensureSocket, room, syncCardFromSnapshot]);

  const startTurn = useCallback(async () => {
    if (!room) return;
    setStartingTurn(true);
    try {
      const socket = await ensureSocket();
      const response = (await callRpc(
        socket,
        "turns:start",
        {},
      )) as StartTurnResponse;
      if ("error" in response) {
        setError(response.error.message);
        return;
      }
      const parsedRoom = VisibleRoomSnapshotSchema.parse(response.room);
      setRoom(parsedRoom);
      syncCardFromSnapshot(parsedRoom);
      setError(null);
    } finally {
      setStartingTurn(false);
    }
  }, [ensureSocket, room, syncCardFromSnapshot]);

  const copyRoomCode = useCallback(async () => {
    const code = room?.code ?? roomCode;
    if (!code) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(code);
      } catch (err) {
        console.error("Failed to copy room code", err);
      }
    }
  }, [room?.code, roomCode]);

  const phase: RoomPhase = loading
    ? "loading"
    : !roomInfo && !room
      ? "notFound"
      : roomInfo?.state === "LOBBY" && !room && !session?.playerToken
        ? "joinPrompt"
        : roomInfo &&
            roomInfo.state !== "LOBBY" &&
            (!room || !session?.playerToken)
          ? "spectatorLocked"
          : room?.state === "LOBBY"
            ? "lobby"
            : room?.state === "IN_ROUND"
              ? "inRound"
              : room?.state === "BETWEEN_ROUNDS"
                ? "betweenRounds"
                : "ended";

  const cardState: CardState = {
    displayCard: activeCard,
    showTimer,
    percentRemaining,
    remainingSeconds,
    poetTurnLabel,
    isCurrentPoet,
    canStartTurn,
    hasActiveTurn,
  };

  return {
    room,
    roomInfo,
    teams,
    phase,
    loading,
    error,
    setError,
    joinRoom,
    joining,
    startGame,
    startingRound,
    startTurn,
    startingTurn,
    cardState,
    copyRoomCode,
    isCreator,
    canStartGame,
    tooltipLabel,
  };
}
