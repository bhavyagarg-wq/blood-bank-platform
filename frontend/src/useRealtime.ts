import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

export interface RealtimeEvent {
  event: string;
  payload: unknown;
  receivedAt: string;
}

const WATCHED_EVENTS = [
  'inventory_updated',
  'emergency_request_created',
  'matches_proposed',
  'potential_match',
  'match_accepted',
  'match_rejected',
  'match_status_changed',
  'request_status_changed',
  'donation_scheduled',
];

/**
 * Opens an authenticated socket and keeps a rolling feed of the latest events.
 * `onEvent` is held in a ref so the socket is not torn down on every render.
 */
export function useRealtime(onEvent?: (event: RealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket: Socket = io({ auth: { token }, transports: ['websocket'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    for (const name of WATCHED_EVENTS) {
      socket.on(name, (payload: unknown) => {
        const entry: RealtimeEvent = { event: name, payload, receivedAt: new Date().toISOString() };
        setEvents((previous) => [entry, ...previous].slice(0, 25));
        handlerRef.current?.(entry);
      });
    }

    return () => {
      socket.close();
    };
  }, []);

  return { connected, events };
}
