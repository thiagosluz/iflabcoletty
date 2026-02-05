import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import apiClient from './axios';

declare global {
    interface Window {
        Pusher?: typeof Pusher;
    }
}

// Make Pusher available globally (required by Laravel Echo with Reverb)
if (typeof window !== 'undefined') {
    window.Pusher = Pusher;
}

interface EchoChannel {
    name: string;
}
type AuthorizeCallback = (err: boolean, data?: unknown) => void;

// Configure Echo for Laravel Reverb
const echoConfig: Record<string, unknown> = {
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY || 'iflab-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
    wsPort: import.meta.env.VITE_REVERB_PORT || 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT || 8080,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: EchoChannel) => {
        return {
            authorize: (socketId: string, callback: AuthorizeCallback) => {
                apiClient.post('/broadcasting/auth', {
                    socket_id: socketId,
                    channel_name: channel.name
                })
                .then(response => {
                    callback(false, response.data);
                })
                .catch(error => {
                    callback(true, error);
                });
            }
        };
    },
};

const echo = new Echo(echoConfig as Parameters<typeof Echo>[0]);

interface EchoConnector {
    connector?: {
        pusher?: {
            connection?: {
                bind: (event: string, cb: (arg?: unknown) => void) => void;
                state?: string;
            };
        };
    };
}

// Add connection event listeners for debugging
if (typeof window !== 'undefined') {
    const connector = (echo as unknown as EchoConnector).connector;
    if (connector?.pusher?.connection) {
        connector.pusher.connection.bind('connected', () => {
            console.log('Echo connected to Reverb');
        });

        connector.pusher.connection.bind('disconnected', () => {
            console.log('Echo disconnected from Reverb');
        });

        connector.pusher.connection.bind('state_change', (states: unknown) => {
            console.log('Echo connection state change:', states);
        });

        connector.pusher.connection.bind('error', (error: unknown) => {
            console.error('Echo connection error:', error);
        });

        connector.pusher.connection.bind('unavailable', () => {
            console.warn('Echo connection unavailable');
        });

        connector.pusher.connection.bind('failed', () => {
            console.error('Echo connection failed');
        });
    }
}

// Helper function to check if Echo is connected
export const isEchoConnected = (): boolean => {
    if (typeof window === 'undefined') return false;
    const connector = (echo as unknown as EchoConnector).connector;
    const state = connector?.pusher?.connection?.state;
    return state === 'connected' || state === 'connecting';
};

export default echo;
