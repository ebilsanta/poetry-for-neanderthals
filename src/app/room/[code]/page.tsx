"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Loader,
  Notification,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { io, type Socket } from "socket.io-client";

import { callRpc } from "@/lib/realtime/rpc";
import { useParams } from "next/navigation";
import { GetRoomResponse } from "@lib/contracts/http/rooms.get";
import type { JoinRoomResponse } from "@lib/contracts/http/rooms.join";
import type { VisibleRoomSnapshot } from "@lib/view/visible";
import type { JoinRoomRequest } from "@lib/contracts/http/rooms.join";

const STORAGE_KEYS = {
  playerId: "pfn_player_id",
  playerName: "pfn_player_name",
  token: "pfn_token",
};

type StoredSession = {
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

export default function RoomPage() {
  const [room, setRoom] = useState<VisibleRoomSnapshot | null>(null);
  const [roomInfo, setRoomInfo] = useState<Pick<
    VisibleRoomSnapshot,
    "code" | "state"
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

  const session = useMemo(() => getStoredSession(), []);
  const socketRef = useRef<Socket | null>(null);

  const params = useParams<{ code?: string }>();
  const roomCode = useMemo(
    () => params?.code?.toUpperCase() ?? "",
    [params?.code],
  );

  const backendUrl = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? backendUrl;

  const ensureSocket = useCallback(async () => {
    if (!roomCode) {
      throw new Error("Missing room code");
    }

    if (socketRef.current && socketRef.current.connected) {
      return socketRef.current;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(backendUrl, {
      transports: ["websocket"],
      autoConnect: false,
      auth:
        session && session.playerToken
          ? {
              code: roomCode,
              token: session.playerToken,
            }
          : undefined,
    });

    socketRef.current = socket;

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });

    return socket;
  }, [backendUrl, roomCode, session?.playerToken]);

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
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [
    apiBaseUrl,
    ensureSocket,
    roomCode,
    session?.playerName,
    session?.playerToken,
  ]);

  const handleCopyCode = useCallback(() => {
    const code = room?.code ?? roomCode;
    if (!code) return;
    void navigator.clipboard
      .writeText(code)
      .then(() => console.log("Copied room code"))
      .catch((err) => console.error("Failed to copy room code", err));
  }, [room, roomCode]);

  const handleOpenSettings = () => {
    console.log("open settings");
  };

  const playersById = useMemo(() => {
    if (!room) {
      return new Map<string, VisibleRoomSnapshot["players"][number]>();
    }
    return new Map(room.players.map((p) => [p.id, p]));
  }, [room]);

  const renderTeam = (teamId: "A" | "B") => {
    if (!room) return null;
    const team = room.teams[teamId];
    return team.players.map((playerId) => {
      const player = playersById.get(playerId);
      if (!player) return null;
      return (
        <Text key={player.id}>
          {player.name} {player.isCreator ? "(Host)" : ""}
        </Text>
      );
    });
  };

  if (loading) {
    return (
      <Container size={460} px="md" py="xl">
        <Stack gap="lg" align="center">
          <Loader color="violet" />
          <Text c="dimmed">Connecting to room...</Text>
        </Stack>
      </Container>
    );
  }

  if (!roomInfo && !room) {
    return (
      <Container size={460} px="md" py="xl">
        <Stack gap="lg" align="center">
          <Title order={3}>Room not available</Title>
          {error ? (
            <Notification color="red">{error}</Notification>
          ) : (
            <Text c="dimmed">
              We couldn&apos;t find an active room in your session. Please
              return to the home page and create or join a room again.
            </Text>
          )}
          <Button component="a" href="/">
            Back to home
          </Button>
        </Stack>
      </Container>
    );
  }

  if (
    roomInfo?.state === "LOBBY" &&
    (!session || !session.playerToken) &&
    !room
  ) {
    return (
      <Container size={420} px="md" py="xl">
        <Stack gap="lg" align="center">
          <Title order={3}>Join Room</Title>
          <Text c="dimmed">Enter your name to join the lobby.</Text>
          <Stack gap="sm" w="100%">
            <Paper p="md" radius="md" withBorder>
              <Stack gap="sm">
                <Text component="label" fw={500}>
                  Your name
                </Text>
                <input
                  value={joinName}
                  onChange={(event) => setJoinName(event.currentTarget.value)}
                  placeholder="Name"
                  maxLength={32}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid var(--mantine-color-gray-4)",
                  }}
                />
                <Button
                  disabled={joinName.trim().length === 0}
                  loading={joining}
                  onClick={async () => {
                    setJoining(true);
                    try {
                      const socket = await ensureSocket();
                      const result = (await callRpc(socket, "rooms:join", {
                        code: roomCode,
                        body: {
                          name: joinName.trim(),
                        } satisfies JoinRoomRequest,
                      })) as JoinRoomResponse;
                      if ("error" in result) {
                        setError(result.error.message);
                      } else {
                        setRoom(result.room);
                        setRoomInfo({
                          code: result.room.code,
                          state: result.room.state,
                        });
                        sessionStorage.setItem(
                          STORAGE_KEYS.token,
                          result.playerToken,
                        );
                        sessionStorage.setItem(
                          STORAGE_KEYS.playerName,
                          result.player.name,
                        );
                        sessionStorage.setItem(
                          STORAGE_KEYS.playerId,
                          result.player.id,
                        );
                        setError(null);
                      }
                    } catch (err) {
                      console.error("Failed to join room", err);
                      setError("Unable to join the room. Please try again.");
                    } finally {
                      setJoining(false);
                    }
                  }}
                >
                  Join Room
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Container>
    );
  }

  if (
    roomInfo &&
    roomInfo.state !== "LOBBY" &&
    (!session || !session.playerToken) &&
    !room
  ) {
    return (
      <Container size={460} px="md" py="xl">
        <Stack gap="lg" align="center">
          <Title order={3}>Game in progress</Title>
          <Text c="dimmed">
            This game is currently in progress. Ask the host to add you if you
            should be part of this round.
          </Text>
          <Button component="a" href="/">
            Back to home
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <Container size={460} px="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={3}>Room Lobby</Title>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="lg"
            aria-label="Room settings"
            onClick={handleOpenSettings}
          >
            ⚙️
          </ActionIcon>
        </Group>

        <Paper shadow="sm" radius="md" p="lg" withBorder>
          <Stack gap="sm" align="center">
            <Text c="dimmed" size="sm">
              Share this code with other players
            </Text>
            <Group gap="sm">
              <Title order={1} tt="uppercase">
                {room.code}
              </Title>
              <Button
                variant="light"
                size="compact-md"
                onClick={handleCopyCode}
              >
                Copy
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Stack gap="md">
          <Paper shadow="xs" radius="md" p="md" withBorder>
            <Title order={4}>Team A</Title>
            <Stack gap={4} mt="sm">
              {renderTeam("A")}
            </Stack>
          </Paper>

          <Paper shadow="xs" radius="md" p="md" withBorder>
            <Title order={4}>Team B</Title>
            <Stack gap={4} mt="sm">
              {renderTeam("B")}
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
