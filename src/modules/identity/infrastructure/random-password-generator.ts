import { randomInt } from "node:crypto";
import type { PasswordGenerator } from "../application/ports";

// No 0/O, 1/l/I: the password is read aloud or copied by hand when it is handed over.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 10;

export const randomPasswordGenerator: PasswordGenerator = {
  generate() {
    return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  },
};
