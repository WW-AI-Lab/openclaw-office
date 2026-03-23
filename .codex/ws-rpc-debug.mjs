const [url, token, method, paramsJson = "{}", waitAfterRpcMsRaw = "0"] = process.argv.slice(2);

if (!url || !token || !method) {
  console.error("usage: node ws-rpc-debug.mjs <url> <token> <method> [paramsJson]");
  process.exit(64);
}

const WebSocketCtor = global.WebSocket;
if (!WebSocketCtor) {
  console.error("WebSocket not available in this Node runtime");
  process.exit(65);
}

const params = JSON.parse(paramsJson);
const waitAfterRpcMs = Number.parseInt(waitAfterRpcMsRaw, 10) || 0;
const ws = new WebSocketCtor(url);
const pendingEvents = [];
let connected = false;
let requestSent = false;

const timeout = setTimeout(() => {
  console.error("timeout");
  process.exit(1);
}, 12000);

function flushAndExit(code) {
  clearTimeout(timeout);
  if (pendingEvents.length > 0) {
    console.log(
      "EVENTS",
      JSON.stringify(
        pendingEvents.map((frame) => ({
          event: frame.event,
          payload: frame.payload,
        })),
        null,
        2,
      ),
    );
  }
  process.exit(code);
}

function flushAndExitAfterDelay(code) {
  if (waitAfterRpcMs > 0) {
    setTimeout(() => flushAndExit(code), waitAfterRpcMs);
    return;
  }
  flushAndExit(code);
}

ws.onopen = () => {
  console.log("open");
};

ws.onmessage = (event) => {
  const text = String(event.data);
  console.log("message", text);

  let frame;
  try {
    frame = JSON.parse(text);
  } catch {
    return;
  }

  if (frame.type === "event") {
    if (frame.event === "connect.challenge" && !connected) {
      ws.send(
        JSON.stringify({
          type: "req",
          id: "connect",
          method: "connect",
          params: {
            minProtocol: 1,
            maxProtocol: 3,
            client: { id: "openclaw-control-ui", version: "0.1.0", platform: "web", mode: "ui" },
            caps: ["tool-events"],
            scopes: ["operator.admin"],
            auth: { token },
          },
        }),
      );
      return;
    }

    pendingEvents.push(frame);
    return;
  }

  if (frame.type !== "res") {
    return;
  }

  if (frame.id === "connect") {
    if (!frame.ok) {
      console.error("CONNECT_ERR", frame.error?.code, frame.error?.message);
      flushAndExit(2);
      return;
    }

    connected = true;
    console.log("CONNECT_OK");

    if (!requestSent) {
      requestSent = true;
      ws.send(
        JSON.stringify({
          type: "req",
          id: "rpc",
          method,
          params,
        }),
      );
    }
    return;
  }

  if (frame.id === "rpc") {
    if (frame.ok) {
      console.log("RPC_OK", JSON.stringify(frame.payload, null, 2));
      flushAndExitAfterDelay(0);
      return;
    }

    console.error("RPC_ERR", frame.error?.code, frame.error?.message);
    flushAndExitAfterDelay(3);
  }
};

ws.onerror = () => {
  console.error("ws error");
};

ws.onclose = (event) => {
  console.log("close", event.code, event.reason || "");
};
