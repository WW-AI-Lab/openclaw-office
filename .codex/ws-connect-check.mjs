const url = process.argv[2];
const token = process.argv[3];
const WebSocketCtor = global.WebSocket;
if (!WebSocketCtor) {
  console.error('WebSocket not available in this Node runtime');
  process.exit(9);
}
const ws = new WebSocketCtor(url);
const timer = setTimeout(() => {
  console.error('timeout waiting for hello');
  process.exit(1);
}, 8000);
let sentConnect = false;
ws.onopen = () => console.log('open');
ws.onmessage = (event) => {
  const text = String(event.data);
  console.log('message', text);
  let frame;
  try { frame = JSON.parse(text); } catch { return; }
  if (frame.type === 'event' && frame.event === 'connect.challenge' && !sentConnect) {
    sentConnect = true;
    ws.send(JSON.stringify({
      type: 'req',
      id: 'debug-connect',
      method: 'connect',
      params: {
        minProtocol: 1,
        maxProtocol: 3,
        client: { id: 'openclaw-control-ui', version: '0.1.0', platform: 'web', mode: 'ui' },
        caps: ['tool-events'],
        scopes: ['operator.admin'],
        auth: { token }
      }
    }));
    return;
  }
  if (frame.type === 'res') {
    clearTimeout(timer);
    if (frame.ok) {
      console.log('CONNECT_OK');
      process.exit(0);
    }
    console.error('CONNECT_ERR', frame.error?.code, frame.error?.message);
    process.exit(2);
  }
};
ws.onerror = (err) => {
  console.error('ws error');
};
ws.onclose = (event) => {
  console.log('close', event.code, event.reason || '');
};
