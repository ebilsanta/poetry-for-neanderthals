import type { Room } from "@server/game/types";

const rooms = new Map<string, Room>();

export function getRoom(code: string) {
  return rooms.get(code);
}
export function setRoom(room: Room) {
  rooms.set(room.code, room);
}
export function deleteRoom(code: string) {
  rooms.delete(code);
}
export function allRooms() {
  return rooms.entries();
}
