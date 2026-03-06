import { createHash, randomBytes } from "node:crypto";

export const generateHouseholdInviteSecret = () => randomBytes(32).toString("base64url");

export const hashHouseholdInviteSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
