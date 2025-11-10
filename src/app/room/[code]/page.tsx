"use client";

import { Container, Stack } from "@mantine/core";

import { useRoomPage } from "@/app/room/[code]/hooks/useRoomPage";
import { LoadingPage } from "@/app/room/[code]/_components/LoadingPage";
import { RoomNotFoundPage } from "@/app/room/[code]/_components/RoomNotFoundPage";
import { JoinRoomPage } from "@/app/room/[code]/_components/JoinRoomPage";
import { RoomInProgressPage } from "@/app/room/[code]/_components/RoomInProgressPage";
import { LobbyPage } from "@/app/room/[code]/_components/LobbyPage";
import { GamePage } from "@/app/room/[code]/_components/GamePage";

export default function RoomPage() {
  const {
    loading,
    roomInfo,
    room,
    error,
    ensureSocket,
    round,
    joinName,
    setJoinName,
    session,
    setError,
    setRoom,
    setRoomInfo,
    joining,
    setJoining,
    handleOpenSettings,
    handleCopyCode,
    handleStartGame,
    canStartGame,
    STORAGE_KEYS,
    isCreator,
    showTimer,
    roomCode,
    canStartTurn,
    startingTurn,
    hasActiveTurn,
    isCurrentPoet,
    handleStartTurn,
    playersById,
    poetTurnLabel,
    displayCard,
    remainingSeconds,
    percentRemaining,
  } = useRoomPage();

  const roomNotFound = !roomInfo && !room;

  const roomInProgress =
    roomInfo &&
    roomInfo.state !== "LOBBY" &&
    (!session || !session.playerToken) &&
    !room;

  const isInJoinRoom =
    roomInfo?.state === "LOBBY" && (!session || !session.playerToken) && !room;

  if (loading) {
    return <LoadingPage />;
  }

  if (roomNotFound) {
    return <RoomNotFoundPage error={error ?? null} />;
  }

  if (isInJoinRoom) {
    return (
      <JoinRoomPage
        joinName={joinName}
        setJoinName={setJoinName}
        joining={joining}
        setJoining={setJoining}
        ensureSocket={ensureSocket}
        roomCode={roomCode}
        setError={setError}
        setRoom={setRoom}
        setRoomInfo={setRoomInfo}
        STORAGE_KEYS={STORAGE_KEYS}
        session={session}
      />
    );
  }

  if (roomInProgress) {
    return <RoomInProgressPage />;
  }

  if (!room) {
    return null;
  }

  return (
    <Container size={460} px="md" py="xl">
      <Stack gap="lg">
        {room.state === "LOBBY" ? (
          <LobbyPage
            room={room}
            handleOpenSettings={handleOpenSettings}
            handleCopyCode={handleCopyCode}
            playersById={playersById}
            isCreator={isCreator}
            canStartGame={canStartGame}
            handleStartGame={handleStartGame}
          />
        ) : (
          <GamePage
            room={room}
            round={round}
            showTimer={showTimer}
            percentRemaining={percentRemaining}
            handleStartTurn={handleStartTurn}
            canStartTurn={canStartTurn}
            startingTurn={startingTurn}
            hasActiveTurn={hasActiveTurn}
            poetTurnLabel={poetTurnLabel}
            remainingSeconds={remainingSeconds}
            displayCard={displayCard}
            isCurrentPoet={isCurrentPoet}
          />
        )}
      </Stack>
    </Container>
  );
}
