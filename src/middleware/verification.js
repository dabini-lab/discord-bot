// ==========================================================
// DISCORD WEBHOOK VERIFICATION
// ==========================================================
import nacl from "tweetnacl";
import { config } from "../config/environment.js";

export function verifyDiscordSignature(req, res, next) {
  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");
  const body = req.rawBody;

  if (!signature || !timestamp) {
    return res.status(401).send("Unauthorized");
  }

  const isValid = verifyKey(
    body,
    signature,
    timestamp,
    config.discord.publicKey
  );
  if (!isValid) {
    return res.status(401).send("Unauthorized");
  }

  next();
}

function verifyKey(body, signature, timestamp, clientPublicKey) {
  try {
    const message = timestamp + body;
    const publicKey = Buffer.from(clientPublicKey, "hex");
    const sig = Buffer.from(signature, "hex");
    const msg = Buffer.from(message);

    return nacl.sign.detached.verify(msg, sig, publicKey);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
