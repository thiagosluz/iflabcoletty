import { create } from 'zustand';
import apiClient from '@/lib/axios';

interface User {
    id: number;
    name: string;
    email: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),

    login: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user, isAuthenticated: true });
    },

    logout: async () => {
        try {
            await apiClient.post('/logout');
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false });
    },

    checkAuth: async () => {
        try {
            const { data } = await apiClient.get('/me');
            set({ user: data, isAuthenticated: true });
        } catch {
            localStorage.removeItem('token');
            set({ token: null, user: null, isAuthenticated: false });
        }
    },
}));
