export const HOUSEHOLD_INVITE_EXPIRY_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const HOUSEHOLD_INVITE_EXPIRY_MS = HOUSEHOLD_INVITE_EXPIRY_DAYS * DAY_IN_MS;

export const getHouseholdInviteExpiryDate = (nowMs = Date.now()) =>
  new Date(nowMs + HOUSEHOLD_INVITE_EXPIRY_MS);
