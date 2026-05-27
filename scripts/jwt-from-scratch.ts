import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;
const url = process.env.LIVEKIT_URL!;

const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  iss: apiKey,
  sub: apiKey,
  iat: now,
  nbf: now,
  exp: now + 600,
  video: { roomList: true },
};

const b64url = (obj: object) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const h = b64url(header);
const p = b64url(payload);
const sig = crypto
  .createHmac("sha256", apiSecret)
  .update(`${h}.${p}`)
  .digest("base64url");
const jwt = `${h}.${p}.${sig}`;

console.log("Hand-crafted JWT (no SDK):");
console.log(jwt);
console.log("\nUsing:");
console.log("  URL    :", url);
console.log("  KEY    :", apiKey);
console.log("  SECRET : (len", apiSecret.length, ")");

const httpUrl = url.replace(/^wss?:\/\//, "https://");
fetch(`${httpUrl}/twirp/livekit.RoomService/ListRooms`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
  },
  body: "{}",
}).then(async (res) => {
  console.log("\nResponse status:", res.status);
  console.log("Response body  :", await res.text());
});
