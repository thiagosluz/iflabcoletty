import apiClient from '@/lib/axios';

export interface SoftwareInstallation {
    id: number;
    computer_id: number;
    user_id: number;
    software_name: string | null;
    installer_type: 'upload' | 'url' | 'network';
    installer_path: string | null;
    installer_url: string | null;
    network_path: string | null;
    file_id: string | null;
    install_args: string | null;
    silent_mode: boolean;
    reboot_after: boolean;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output: string | null;
    error_message: string | null;
    executed_at: string | null;
    created_at: string;
    updated_at: string;
    computer?: {
        id: number;
        hostname: string;
        machine_id: string;
    };
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface UploadResponse {
    file_id: string;
    filename: string;
    size: number;
    extension: string;
    download_url: string;
}

export interface CreateInstallationRequest {
    computer_ids: number[];
    method: 'upload' | 'url' | 'network';
    software_name?: string;
    install_args?: string;
    silent_mode?: boolean;
    reboot_after?: boolean;
    file_id?: string;
    installer_url?: string;
    network_path?: string;
}

const SoftwareInstallationService = {
    uploadInstaller: async (file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await apiClient.post('/software-installations/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        
        return response.data;
    },

    createInstallation: async (data: CreateInstallationRequest): Promise<{ message: string; created: number; skipped: number; errors: string[] }> => {
        const response = await apiClient.post('/software-installations', data);
        return response.data;
    },

    getInstallations: async (params?: {
        status?: string;
        computer_id?: number;
        search?: string;
        per_page?: number;
    }): Promise<{ data: SoftwareInstallation[]; current_page: number; last_page: number; total: number }> => {
        const response = await apiClient.get('/software-installations', { params });
        return response.data;
    },

    getInstallation: async (id: number): Promise<SoftwareInstallation> => {
        const response = await apiClient.get(`/software-installations/${id}`);
        return response.data;
    },

    deleteInstallation: async (id: number): Promise<{ message: string }> => {
        const response = await apiClient.delete(`/software-installations/${id}`);
        return response.data;
    },
};

export default SoftwareInstallationService;
