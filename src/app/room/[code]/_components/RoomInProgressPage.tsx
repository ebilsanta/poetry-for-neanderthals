import { Container, Stack, Title, Text, Button } from "@mantine/core";

export const RoomInProgressPage = () => {
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
};
