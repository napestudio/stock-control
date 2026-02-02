import crypto from "crypto";
import { config } from "@/lib/config";

export function generateRandomPassword(): string {
  const length = config.PASSWORD_RANDOM_LENGTH;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each type
  let password = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    numbers[crypto.randomInt(numbers.length)],
    special[crypto.randomInt(special.length)],
  ];

  // Fill remaining characters
  for (let i = password.length; i < length; i++) {
    password.push(allChars[crypto.randomInt(allChars.length)]);
  }

  // Shuffle array using Fisher-Yates algorithm
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}
