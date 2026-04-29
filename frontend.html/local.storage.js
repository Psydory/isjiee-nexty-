// =========================
// STORAGE KEYS
// =========================
const KEYS = {
  TOKEN: "token",
  USER: "user",
  COOKIE_CONSENT: "cookie_consent"
};

// =========================
// TOKEN
// =========================
export function setToken(token) {
  localStorage.setItem(KEYS.TOKEN, token);
}

export function getToken() {
  return localStorage.getItem(KEYS.TOKEN);
}

export function removeToken() {
  localStorage.removeItem(KEYS.TOKEN);
}

// =========================
// USER
// =========================
export function setUser(user) {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function getUser() {
  const data = localStorage.getItem(KEYS.USER);
  return data ? JSON.parse(data) : null;
}

export function removeUser() {
  localStorage.removeItem(KEYS.USER);
}

// =========================
// SESSION
// =========================
export function clearSession() {
  removeToken();
  removeUser();
}

// =========================
// COOKIE CONSENT
// =========================
export function setCookieConsent(value) {
  localStorage.setItem(KEYS.COOKIE_CONSENT, value);
}

export function getCookieConsent() {
  return localStorage.getItem(KEYS.COOKIE_CONSENT);
}

// =========================
// FULL RESET (DEBUG / LOGOUT HARD)
// =========================
export function clearAll() {
  localStorage.clear();
}