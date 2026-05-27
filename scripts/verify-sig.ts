import dotenv from "dotenv";
import { AccessToken } from "livekit-server-sdk";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

async function main() {
  const at = new AccessToken(apiKey, apiSecret, { identity: "verifier" });
  at.addGrant({ roomList: true });
  const token = await at.toJwt();

  const [h, p, s] = token.split(".");
  console.log("Full JWT:", token);
  console.log("\nHeader :", JSON.parse(Buffer.from(h, "base64url").toString()));
  console.log("Payload:", JSON.parse(Buffer.from(p, "base64url").toString()));
  console.log("Sig (b64url):", s);

  const expected = crypto
    .createHmac("sha256", apiSecret)
    .update(`${h}.${p}`)
    .digest("base64url");
  console.log("Manual HMAC :", expected);
  console.log("Signatures match:", expected === s);

  console.log("\n--- apiKey hex ---", Buffer.from(apiKey).toString("hex"));
  console.log("--- apiSecret hex ---", Buffer.from(apiSecret).toString("hex"));
}
main();
