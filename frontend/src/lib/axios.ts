import axios from 'axios';

const apiClient = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true, // Important for Sanctum cookie (if using cookies) OR to handle cors correctly
});

// Request interceptor to add token if available
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
    (response) => {
        // Store rate limit headers for potential use
        if (response.headers['x-ratelimit-limit']) {
            // Could store in state if needed
        }
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        
        // Handle rate limiting (429 Too Many Requests)
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 60;
            const message = error.response.data?.message || 
                `Muitas requisições. Tente novamente em ${retryAfter} segundos.`;
            
            // You could show a toast notification here
            console.warn('Rate limit exceeded:', message);
            
            // Optionally, you could dispatch a toast notification
            // toast.error(message);
        }
        
        return Promise.reject(error);
    }
);

export default apiClient;
