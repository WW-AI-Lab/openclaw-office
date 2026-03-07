import { uuid } from "@/lib/uuid";
import type {
  ConnectionStatus,
  ConnectParams,
  GatewayEventFrame,
  GatewayFrame,
  GatewayResponseFrame,
  HelloOk,
} from "./types";

const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_MS = 1000;

type EventHandler = (event: GatewayEventFrame) => void;
type StatusHandler = (status: ConnectionStatus, error?: string) => void;
type ResponseHandler = (frame: GatewayResponseFrame) => void;

export class GatewayWsClient {
  private ws: WebSocket | null = null;
  private url = "";
  private token = "";
  private status: ConnectionStatus = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shutdownReceived = false;

  private eventHandlers = new Map<string, Set<EventHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private responseHandlers = new Map<string, ResponseHandler>();

  private snapshot: HelloOk["snapshot"] | null = null;
  private serverInfo: HelloOk["server"] | null = null;
  private handleClose: () => void = () => {};

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSnapshot(): HelloOk["snapshot"] | null {
    return this.snapshot;
  }

  getServerInfo(): HelloOk["server"] | null {
    return this.serverInfo;
  }

  isConnected(): boolean {
    return this.status === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string, token: string): void {
    this.url = url;
    this.token = token;
    this.shutdownReceived = false;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.shutdownReceived = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.removeEventListener("close", this.handleClose);
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  onEvent(eventName: string, handler: EventHandler): () => void {
    let handlers = this.eventHandlers.get(eventName);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(eventName, handlers);
    }
    handlers.add(handler);
    return () => handlers!.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onResponse(id: string, handler: ResponseHandler): void {
    this.responseHandlers.set(id, handler);
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private doConnect(): void {
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.handleClose = () => {
      if (!this.shutdownReceived) {
        this.scheduleReconnect();
      }
    };

    this.ws.addEventListener("open", () => {
      // Wait for challenge event from server
    });
    this.ws.addEventListener("message", (e) => {
      this.handleMessage(e);
    });
    this.ws.addEventListener("close", this.handleClose);
    this.ws.addEventListener("error", () => {
      // onclose will fire after onerror
    });
  }

  private handleMessage(e: MessageEvent): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(e.data as string) as GatewayFrame;
    } catch {
      return;
    }

    if (frame.type === "event") {
      const eventFrame = frame as GatewayEventFrame;
      this.handleEvent(eventFrame);
    } else if (frame.type === "res") {
      const resFrame = frame as GatewayResponseFrame;
      this.handleResponse(resFrame);
    }
  }

  private handleEvent(frame: GatewayEventFrame): void {
    if (frame.event === "connect.challenge") {
      this.sendConnect();
      return;
    }

    if (frame.event === "shutdown") {
      this.shutdownReceived = true;
      this.clearReconnectTimer();
      this.setStatus("disconnected");
    }

    const handlers = this.eventHandlers.get(frame.event);
    if (handlers) {
      for (const handler of handlers) {
        handler(frame);
      }
    }

    const wildcardHandlers = this.eventHandlers.get("*");
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        handler(frame);
      }
    }
  }

  private handleResponse(frame: GatewayResponseFrame): void {
    const handler = this.responseHandlers.get(frame.id);
    if (handler) {
      this.responseHandlers.delete(frame.id);
      handler(frame);
      return;
    }

    // connect 响应（可能没有 id 匹配）
    if (frame.ok && (frame.payload as HelloOk)?.type === "hello-ok") {
      this.handleConnectSuccess(frame.payload as HelloOk);
    } else if (!frame.ok) {
      this.setStatus("error", frame.error.message);
    }
  }

  private sendConnect(): void {
    const params: ConnectParams = {
      minProtocol: 1,
      maxProtocol: 3,
      client: {
        id: "openclaw-control-ui",
        version: "0.1.0",
        platform: "web",
        mode: "ui",
      },
      caps: ["tool-events"],
      scopes: ["operator.admin"],
    };

    if (this.token) {
      params.auth = { token: this.token };
    }

    this.send({
      type: "req",
      id: uuid(),
      method: "connect",
      params,
    });
  }

  private handleConnectSuccess(payload: HelloOk): void {
    this.snapshot = payload.snapshot ?? null;
    this.serverInfo = payload.server ?? null;
    this.reconnectAttempt = 0;
    this.setStatus("connected");
  }

  private scheduleReconnect(): void {
    if (this.shutdownReceived) {
      return;
    }
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    const delay =
      Math.min(BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt), MAX_DELAY_MS) +
      Math.random() * JITTER_MS;

    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status, error);
    }
  }
}
