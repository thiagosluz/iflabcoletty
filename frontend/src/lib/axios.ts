import axios from 'axios';
import { toast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';

const apiClient = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true,
});

// Request interceptor to add token if available
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Debounce network-error toasts so we don't show one per failed request
const NETWORK_TOAST_COOLDOWN_MS = 4000;
let lastNetworkToastAt = 0;

// Response interceptor to handle errors and show global toasts
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            return Promise.reject(error);
        }

        if (status === 429) {
            toast({ ...getApiErrorToast(error) });
            return Promise.reject(error);
        }

        if (status !== undefined && status >= 500) {
            toast({ ...getApiErrorToast(error) });
            return Promise.reject(error);
        }

        const isNetworkError =
            error.code === 'ERR_NETWORK' ||
            error.code === 'ECONNABORTED' ||
            !error.response;
        if (isNetworkError) {
            const now = Date.now();
            if (now - lastNetworkToastAt >= NETWORK_TOAST_COOLDOWN_MS) {
                lastNetworkToastAt = now;
                toast({ ...getApiErrorToast(error) });
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
