'use client';

import { useEffect, useState } from 'react';

interface Event {
  type?: string;
  time: string;
  agent?: string;
  command?: string;
  status?: string;
  message?: string;
  runPath?: string;
  duration_ms?: number;
  error?: string;
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const evtSource = new EventSource('http://localhost:3001/events');

    evtSource.onopen = () => {
      setConnected(true);
    };

    evtSource.onerror = () => {
      setConnected(false);
    };

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [data, ...prev].slice(0, 50)); // Keep last 50 events
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  const getStatusClass = (status?: string) => {
    if (!status) return '';
    return `event-status status-${status}`;
  };

  return (
    <main>
      <h1>🗼 Alpha Tower</h1>

      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <ul className="event-list">
        {events.length === 0 ? (
          <li style={{ color: '#888', padding: '1rem' }}>
            Waiting for events...
          </li>
        ) : (
          events.map((event, index) => (
            <li key={index} className="event-item">
              <div className="event-header">
                <div>
                  {event.agent && (
                    <span className="event-agent">{event.agent}</span>
                  )}
                  {event.command && (
                    <>
                      {' → '}
                      <span className="event-command">{event.command}</span>
                    </>
                  )}
                </div>
                <span className="event-time">{formatTime(event.time)}</span>
              </div>

              {event.status && (
                <div>
                  <span className={getStatusClass(event.status)}>
                    {event.status.toUpperCase()}
                  </span>
                </div>
              )}

              <div className="event-details">
                {event.message && <div>{event.message}</div>}
                {event.error && <div style={{ color: '#fca5a5' }}>Error: {event.error}</div>}
                {event.duration_ms && <div>Duration: {event.duration_ms}ms</div>}
                {event.runPath && (
                  <div>
                    <a href={`/${event.runPath}`} className="run-link" target="_blank" rel="noopener noreferrer">
                      📁 View artifacts
                    </a>
                  </div>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
