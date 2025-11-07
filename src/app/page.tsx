"use client";

import { useState } from "react";
import {
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

export default function Home() {
  const [creatorName, setCreatorName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const handleStartRoom = () => {
    console.log("start room", creatorName.trim());
  };

  const handleJoinRoom = () => {
    console.log("join room", joinCode.trim().toUpperCase());
  };

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
