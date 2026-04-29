// =========================
// UTIL BASE64 URL SAFE
// =========================
function base64url(input) {
  return btoa(JSON.stringify(input))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// =========================
// SIGNATURE HMAC SHA-256
// =========================
async function sign(data, secret) {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(data)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// =========================
// CREATE JWT
// =========================
export async function createJWT(payload, secret, expiresIn = 3600) {

  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const headerBase = base64url(header);
  const payloadBase = base64url(fullPayload);

  const signature = await sign(
    headerBase + "." + payloadBase,
    secret
  );

  return `${headerBase}.${payloadBase}.${signature}`;
}

// =========================
// VERIFY JWT
// =========================
export async function verifyJWT(token, secret) {

  if (!token) throw new Error("Missing token");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const [headerBase, payloadBase, signature] = parts;

  const expectedSig = await sign(
    headerBase + "." + payloadBase,
    secret
  );

  if (signature !== expectedSig) {
    throw new Error("Invalid signature");
  }

  const payload = JSON.parse(atob(payloadBase));

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
}

// =========================
// REQUIRE AUTH (UPGRADE)
// =========================
export async function requireAuthJWT(request, secret) {

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");

  const payload = await verifyJWT(token, secret);

  return payload; // { id, role, ... }
}