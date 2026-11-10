/**
 * DOSTHU WEBSOCKET CLIENT MANAGER
 * Handles resilient bidirectional real-time communication & event dispatching
 */
class SocketClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect(token) {
    this.token = token;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        // Authenticate with server
        this.send('auth', { token: this.token });
        this.dispatch('connected', {});
      };

      this.ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.event) {
            this.dispatch(msg.event, msg.data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = e => {
        this.isConnected = false;
        this.dispatch('disconnected', { code: e.code });
        this.scheduleReconnect();
      };

      this.ws.onerror = err => {
        console.warn('WebSocket encountered error:', err);
      };
    } catch (err) {
      console.error('WebSocket connection initialization error:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.token) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.token);
      }, delay);
    }
  }

  send(event, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify({ event, data }));
      return true;
    } catch (e) {
      console.error('Error sending WS frame:', e);
      return false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  dispatch(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in listener for event ${event}:`, err);
        }
      }
    }
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

const socketClient = new SocketClient();
window.socketClient = socketClient;
