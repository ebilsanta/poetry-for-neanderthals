import { Container, Stack, Loader, Text } from "@mantine/core";

export const LoadingPage = () => {
  return (
    <Container size={460} px="md" py="xl">
      <Stack gap="lg" align="center">
        <Loader color="violet" />
        <Text c="dimmed">Connecting to room...</Text>
      </Stack>
    </Container>
  );
};
