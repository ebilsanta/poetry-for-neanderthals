"use client";

import {
  ActionIcon,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useCallback, useState } from "react";

const mockPlayers = {
  A: [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Charlie" },
  ],
  B: [
    { id: "p3", name: "Bob" },
    { id: "p4", name: "Dana" },
  ],
};

export default function RoomPage() {
  const [roomCode] = useState("ABC");

  const handleCopyCode = useCallback(() => {
    void navigator.clipboard
      .writeText(roomCode)
      .then(() => console.log("Copied room code"))
      .catch((err) => console.error("Failed to copy room code", err));
  }, [roomCode]);

  const handleOpenSettings = () => {
    console.log("open settings");
  };

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
                {roomCode}
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
              {mockPlayers.A.map((player) => (
                <Text key={player.id}>{player.name}</Text>
              ))}
            </Stack>
          </Paper>

          <Paper shadow="xs" radius="md" p="md" withBorder>
            <Title order={4}>Team B</Title>
            <Stack gap={4} mt="sm">
              {mockPlayers.B.map((player) => (
                <Text key={player.id}>{player.name}</Text>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
