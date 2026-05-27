import dotenv from "dotenv";
import { RoomServiceClient } from "livekit-server-sdk";

dotenv.config({ path: ".env.local" });

const url = process.env.LIVEKIT_URL;
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

console.log("LIVEKIT_URL       :", JSON.stringify(url));
console.log("LIVEKIT_API_KEY   :", JSON.stringify(apiKey), "(len:", apiKey?.length, ")");
console.log("LIVEKIT_API_SECRET: (len:", apiSecret?.length, ")");
console.log("System time UTC   :", new Date().toISOString());

if (!url || !apiKey || !apiSecret) {
  console.error("Missing env");
  process.exit(1);
}

const httpUrl = url.replace(/^wss?:\/\//, "https://");
const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);

svc
  .listRooms()
  .then((rooms) => {
    console.log("\nlistRooms OK. Rooms:", rooms.length);
  })
  .catch((err) => {
    console.error("\nlistRooms FAILED:", err);
    process.exit(1);
  });
