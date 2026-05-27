import dotenv from "dotenv";
import { AccessToken } from "livekit-server-sdk";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

const at = new AccessToken(apiKey, apiSecret, { identity: "test" });
at.addGrant({ roomJoin: true, room: "test" });

const token = await at.toJwt();
const [header, payload] = token.split(".");
const decode = (s: string) =>
  JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

console.log("Header :", decode(header));
console.log("Payload:", decode(payload));
console.log("iss matches LIVEKIT_API_KEY?", decode(payload).iss === apiKey);
