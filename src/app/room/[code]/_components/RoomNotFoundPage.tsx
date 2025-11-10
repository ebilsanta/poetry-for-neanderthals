import {
  Container,
  Stack,
  Title,
  Notification,
  Text,
  Button,
} from "@mantine/core";

export const RoomNotFoundPage = ({ error }: { error: string | null }) => {
  return (
    <Container size={460} px="md" py="xl">
      <Stack gap="lg" align="center">
        <Title order={3}>Room not available</Title>
        {error ? (
          <Notification color="red">{error}</Notification>
        ) : (
          <Text c="dimmed">
            We couldn&apos;t find an active room in your session. Please return
            to the home page and create or join a room again.
          </Text>
        )}
        <Button component="a" href="/">
          Back to home
        </Button>
      </Stack>
    </Container>
  );
};
