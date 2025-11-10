import { Container, Stack, Title, Text, Paper, Button } from "@mantine/core";
import { JoinRoomRequest } from "@lib/contracts/http/rooms.join";
import { JoinRoomResponse } from "@lib/contracts/http/rooms.join";
import { callRpc } from "@/lib/realtime/rpc";
import { Socket } from "socket.io-client";
import { StoredSession } from "@/app/room/[code]/hooks/useRoomPage";
import { VisibleRoomSnapshot } from "@/lib/view/visible";

export const JoinRoomPage = ({
  joinName,
  setJoinName,
  joining,
  setJoining,
  ensureSocket,
  roomCode,
  setError,
  setRoom,
  setRoomInfo,
  STORAGE_KEYS,
  session,
}: {
  joinName: string;
  setJoinName: (name: string) => void;
  joining: boolean;
  setJoining: (joining: boolean) => void;
  ensureSocket: () => Promise<Socket>;
  roomCode: string;
  setError: (error: string | null) => void;
  setRoom: (room: VisibleRoomSnapshot) => void;
  setRoomInfo: (
    roomInfo: Pick<VisibleRoomSnapshot, "code" | "state"> | null,
  ) => void;
  STORAGE_KEYS: {
    token: string;
    playerName: string;
    playerId: string;
  };
  session: StoredSession | null;
}) => {
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
};
