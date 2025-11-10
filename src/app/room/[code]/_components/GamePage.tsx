import { VisibleCard, VisibleRoomSnapshot } from "@/lib/view/visible";
import {
  Stack,
  Title,
  Box,
  Progress,
  Text,
  Paper,
  Badge,
  Divider,
  Button,
} from "@mantine/core";

interface GamePageProps {
  room: VisibleRoomSnapshot;
  round: VisibleRoomSnapshot["round"];
  showTimer: boolean;
  percentRemaining: number | null;
  remainingSeconds: number | null;
  displayCard: VisibleCard | null;
  isCurrentPoet: boolean;
  handleStartTurn: () => void;
  canStartTurn: boolean;
  startingTurn: boolean;
  hasActiveTurn: boolean;
  poetTurnLabel: string;
}

export const GamePage = ({
  room,
  round,
  showTimer,
  percentRemaining,
  remainingSeconds,
  displayCard,
  isCurrentPoet,
  handleStartTurn,
  canStartTurn,
  startingTurn,
  hasActiveTurn,
  poetTurnLabel,
}: GamePageProps) => {
  return (
    <Stack align="center" gap="lg">
      <Title order={3}>
        {room.state === "IN_ROUND" ? `Round ${round?.number ?? ""}` : "Game"}
      </Title>

      {showTimer ? (
        <Box pos="relative" w="100%">
          <Progress
            value={percentRemaining ?? 0}
            size="xl"
            radius="xl"
            color="yellow"
            w="100%"
            striped
            animated
          />
          {remainingSeconds !== null ? (
            <Text
              size="sm"
              fw={600}
              c="var(--mantine-color-dark-9)"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {remainingSeconds}s
            </Text>
          ) : null}
        </Box>
      ) : null}

      {room.state === "IN_ROUND" ? (
        displayCard ? (
          <Paper
            shadow="md"
            radius="lg"
            withBorder
            w="100%"
            maw={360}
            px="md"
            py={0}
          >
            <Stack gap={0}>
              <Box
                style={{
                  background: "var(--mantine-color-blue-light)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
                py="lg"
              >
                <Badge color="blue" radius="xl" size="lg">
                  1
                </Badge>
                <Text size="xl" fw={700} ta="center">
                  {displayCard.onePoint}
                </Text>
              </Box>
              <Divider color="var(--mantine-color-gray-3)" />
              <Box
                style={{
                  background: "var(--mantine-color-orange-light)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
                py="lg"
              >
                <Text size="xl" fw={700} ta="center">
                  {displayCard.threePoint}
                </Text>
                <Badge color="orange" radius="xl" size="lg">
                  3
                </Badge>
              </Box>
            </Stack>
          </Paper>
        ) : (
          <Paper
            shadow="xs"
            radius="md"
            withBorder
            px="lg"
            py="md"
            bg="var(--mantine-color-gray-light)"
          >
            <Text fw={600} ta="center">
              Happy guessing!
            </Text>
          </Paper>
        )
      ) : null}

      {room.state === "IN_ROUND" ? (
        isCurrentPoet ? (
          <Stack align="center" gap="sm">
            <Text fw={600}>Your turn</Text>
            <Button
              size="md"
              onClick={handleStartTurn}
              disabled={!canStartTurn || startingTurn}
              loading={startingTurn}
            >
              {hasActiveTurn ? "Turn In Progress" : "Start Turn"}
            </Button>
            {hasActiveTurn ? (
              <Text c="dimmed" size="sm">
                Your turn is already active.
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Text c="dimmed">{poetTurnLabel}</Text>
        )
      ) : (
        <Text c="dimmed">
          {room.state === "BETWEEN_ROUNDS"
            ? "Waiting for the next round to begin."
            : "Game has ended."}
        </Text>
      )}
    </Stack>
  );
};
