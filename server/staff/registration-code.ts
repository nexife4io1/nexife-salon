import "server-only";
import { randomInt } from "node:crypto";

/** No 0/O/1/I/L so a code read off a screen is hard to mistype. 31 symbols, 8 chars ≈ 40 bits. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 8;

/** Cryptographically secure random code; `randomInt` rejection-samples, so there is no modulo bias. */
export function generateRegistrationCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
