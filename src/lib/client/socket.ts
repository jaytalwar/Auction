import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | undefined;

/**
 * Reuses the existing connection when called again with the same token —
 * important because React's StrictMode double-invokes effects in dev, and
 * AuthContext's session-restore effect calls this on mount. Without this
 * guard, the second call disconnects the first connection mid-handshake
 * ("WebSocket is closed before the connection is established"), and
 * whichever component grabbed a reference to that first socket is left
 * holding a dead connection.
 */
export function connectSocket(token?: string): Socket {
  if (socket && currentToken === token && !socket.disconnected) {
    return socket;
  }
  socket?.disconnect();
  currentToken = token;
  socket = io('/auctions', {
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = undefined;
}
