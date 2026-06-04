#!/usr/bin/env node

const crypto = require("crypto");

const ACTIONS = new Set([
  "albatross",
  "double-eagle",
  "eagle",
  "birdie",
  "par",
  "bogey",
  "double-bogey",
  "undo",
  "reset",
  "clear"
]);

const OBS_URL = process.env.OBS_WS_URL || "ws://127.0.0.1:4455";
const OBS_PASSWORD = process.env.OBS_WS_PASSWORD || "";
const EVENT_NAME = "nssGolfScoreboard";

function usage() {
  console.error([
    "Usage: node obs-golf-scoreboard-control.js <action>",
    "",
    "Actions:",
    "  albatross | double-eagle | eagle | birdie | par | bogey | double-bogey | undo | reset",
    "",
    "Environment:",
    "  OBS_WS_URL       Defaults to ws://127.0.0.1:4455",
    "  OBS_WS_PASSWORD  Required if OBS WebSocket authentication is enabled"
  ].join("\n"));
}

function normalizeAction(raw) {
  return String(raw || "").trim().toLowerCase().replace(/[\s_]/g, "-");
}

function makeAuthentication(password, salt, challenge) {
  const secret = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("base64");

  return crypto
    .createHash("sha256")
    .update(secret + challenge)
    .digest("base64");
}

function send(socket, op, d = {}) {
  socket.send(JSON.stringify({ op, d }));
}

function once(socket, eventName) {
  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      cleanup();
      resolve(JSON.parse(event.data));
    };
    const handleError = (event) => {
      cleanup();
      reject(event?.error || new Error(`WebSocket ${eventName} failed`));
    };
    const cleanup = () => {
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("message", handleMessage, { once: true });
    socket.addEventListener("error", handleError, { once: true });
  });
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    if (socket.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", (event) => reject(event?.error || new Error("Could not connect to OBS WebSocket")), { once: true });
  });
}

async function identify(socket, hello) {
  const auth = hello.d?.authentication;
  const identifyPayload = { rpcVersion: 1 };

  if (auth) {
    if (!OBS_PASSWORD) {
      throw new Error("OBS WebSocket requires a password. Set OBS_WS_PASSWORD and try again.");
    }

    identifyPayload.authentication = makeAuthentication(
      OBS_PASSWORD,
      auth.salt,
      auth.challenge
    );
  }

  send(socket, 1, identifyPayload);

  const identified = await once(socket, "identified");
  if (identified.op !== 2) {
    throw new Error(`OBS did not accept Identify. Received op ${identified.op}.`);
  }
}

async function callVendorRequest(socket, action) {
  const requestId = `golf-scoreboard-${Date.now()}`;

  send(socket, 6, {
    requestType: "CallVendorRequest",
    requestId,
    requestData: {
      vendorName: "obs-browser",
      requestType: "emit_event",
      requestData: {
        event_name: EVENT_NAME,
        event_data: { action }
      }
    }
  });

  const response = await once(socket, "request response");
  const status = response.d?.requestStatus;
  if (response.op !== 7 || !status?.result) {
    throw new Error(status?.comment || `OBS request failed: ${JSON.stringify(response)}`);
  }
}

async function main() {
  const action = normalizeAction(process.argv[2]);
  if (!ACTIONS.has(action)) {
    usage();
    process.exitCode = 2;
    return;
  }

  const socket = new WebSocket(OBS_URL);

  try {
    await waitForOpen(socket);

    const hello = await once(socket, "hello");
    if (hello.op !== 0) {
      throw new Error(`OBS did not send Hello. Received op ${hello.op}.`);
    }

    await identify(socket, hello);
    await callVendorRequest(socket, action);
    console.log(`Sent golf scoreboard action: ${action}`);
  } finally {
    socket.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
