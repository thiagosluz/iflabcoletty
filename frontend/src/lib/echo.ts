import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import apiClient from './axios';

// Make Pusher available globally (required by Laravel Echo with Reverb)
// This must be done before creating Echo instance
if (typeof window !== 'undefined') {
    (window as any).Pusher = Pusher;
}

// Configure Echo for Laravel Reverb
const echoConfig: any = {
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY || 'iflab-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
    wsPort: import.meta.env.VITE_REVERB_PORT || 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT || 8080,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    // Use custom authorizer to reuse apiClient with its interceptors and dynamic token handling
    authorizer: (channel: any, options: any) => {
        return {
            authorize: (socketId: string, callback: Function) => {
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

const echo = new Echo(echoConfig);

// Add connection event listeners for debugging
if (typeof window !== 'undefined') {
    const connector = (echo as any).connector;
    if (connector?.pusher?.connection) {
        connector.pusher.connection.bind('connected', () => {
            console.log('Echo connected to Reverb');
        });

        connector.pusher.connection.bind('disconnected', () => {
            console.log('Echo disconnected from Reverb');
        });

        connector.pusher.connection.bind('state_change', (states: any) => {
            console.log('Echo connection state change:', states);
        });

        connector.pusher.connection.bind('error', (error: any) => {
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
    const connector = (echo as any).connector;
    const state = connector?.pusher?.connection?.state;
    return state === 'connected' || state === 'connecting';
};

export default echo;
