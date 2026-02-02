export const config = {
  EMAIL_DOMAIN: process.env.EMAIL_DOMAIN || "stockcontrol.com",
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_RANDOM_LENGTH: 16,
} as const;
