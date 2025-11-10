import { VisibleRoomSnapshot } from "@/lib/view/visible";
import {
  Group,
  Title,
  ActionIcon,
  Paper,
  Stack,
  Text,
  Button,
  Box,
  Loader,
  Tooltip,
} from "@mantine/core";

interface LobbyPageProps {
  room: VisibleRoomSnapshot;
  handleOpenSettings: () => void;
  handleCopyCode: () => void;
  isCreator: boolean;
  canStartGame: boolean;
  handleStartGame: () => void;
  playersById: Map<string, VisibleRoomSnapshot["players"][number]>;
}

export const LobbyPage = ({
  room,
  handleOpenSettings,
  handleCopyCode,
  playersById,
  isCreator,
  canStartGame,
  handleStartGame,
}: LobbyPageProps) => {
  const tooltipLabel = (() => {
    if (!canStartGame) return "Need at least two players to start";
    return null;
  })();

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

  return (
    <>
      <Group justify="space-between" align="flex-start">
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
            <Button variant="light" size="compact-md" onClick={handleCopyCode}>
              Copy
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Box
        w="100%"
        style={{
          maxHeight: "40vh",
          overflowY: "auto",
        }}
      >
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
      </Box>

      {isCreator ? (
        <Group justify="center" mt="md">
          <Tooltip
            label={tooltipLabel}
            disabled={tooltipLabel === null}
            position="top"
          >
            <Button
              size="md"
              onClick={handleStartGame}
              disabled={!canStartGame}
            >
              Start Game
            </Button>
          </Tooltip>
        </Group>
      ) : (
        <Group justify="center" gap="xs" mt="md">
          <Text c="dimmed">Waiting for host to start room</Text>
          <Loader size="xs" />
        </Group>
      )}
    </>
  );
};
