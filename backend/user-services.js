import { getUserById } from "./db.js";

// =========================
// GET PROFILE
// =========================
export function getProfile(userId) {
  return getUserById(userId);
}
