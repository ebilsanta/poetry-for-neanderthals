const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no vowels, no 0/1
const CODE_LEN = 3;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LEN; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
