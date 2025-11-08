"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Container,
  Divider,
  Notification,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { io, type Socket } from "socket.io-client";
import { callRpc } from "@/lib/realtime/rpc";
import type { CreateRoomResponse } from "@lib/contracts/http/rooms.create";

const STORAGE_KEYS = {
  playerId: "pfn_player_id",
  playerName: "pfn_player_name",
  token: "pfn_token",
};

export default function Home() {
  const [creatorName, setCreatorName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  const backendUrl = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

  const ensureSocket = useCallback(async () => {
    if (socketRef.current && socketRef.current.connected) {
      return socketRef.current;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(backendUrl, {
      transports: ["websocket"],
      autoConnect: false,
    });

    socketRef.current = socket;

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });

    return socket;
  }, [backendUrl]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleStartRoom = useCallback(async () => {
    const trimmedName = creatorName.trim();
    if (!trimmedName) return;

    setError(null);
    setIsStarting(true);

    try {
      const socket = await ensureSocket();
      const response = (await callRpc(socket, "rooms:create", {
        name: trimmedName,
      })) as CreateRoomResponse;

      if ("error" in response) {
        setError(response.error.message);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEYS.playerId, response.player.id);
        sessionStorage.setItem(STORAGE_KEYS.playerName, response.player.name);
        sessionStorage.setItem(STORAGE_KEYS.token, response.playerToken);
      }

      router.push(`/room/${response.room.code}`);
    } catch (err) {
      console.error("Failed to create room", err);
      setError("Failed to create room. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }, [creatorName, ensureSocket, router]);

  const handleJoinRoom = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 3) return;

    router.push(`/room/${code}`);
  }, [joinCode, router]);

  return (
    <Container size={420} px="md" py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2} ta="center">
            Poetry for Neanderthals
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Fast-paced wordplay for prehistoric poets
          </Text>
        </Stack>

        {error && (
          <Notification color="red" title="Something went wrong">
            {error}
          </Notification>
        )}

        <Paper shadow="sm" radius="md" p="lg" withBorder>
          <Stack gap="sm">
            <Title order={4}>Start Room</Title>
            <TextInput
              data-autofocus
              placeholder="Enter your name"
              value={creatorName}
              onChange={(event) => setCreatorName(event.currentTarget.value)}
            />
            <Button
              size="md"
              onClick={handleStartRoom}
              disabled={creatorName.trim().length === 0}
              loading={isStarting}
            >
              Start Room
            </Button>
          </Stack>

          <Divider my="lg" label="or" labelPosition="center" />

          <Stack gap="sm">
            <Title order={4}>Join Room</Title>
            <TextInput
              placeholder="Room code (e.g., ABC)"
              value={joinCode}
              onChange={(event) => setJoinCode(event.currentTarget.value)}
              maxLength={3}
              styles={{ input: { textTransform: "uppercase" } }}
            />
            <Button
              size="md"
              variant="light"
              onClick={handleJoinRoom}
              disabled={joinCode.trim().length !== 3}
            >
              Join Room
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
