import apiClient from '@/lib/axios';

export interface AgentPackage {
    version: string;
    size: number;
    size_human: string;
    download_url: string;
    exists: boolean;
    is_latest: boolean;
    created_at: string | null;
}

export interface AgentInstaller {
    platform: 'windows' | 'linux';
    filename: string;
    size?: number;
    size_human?: string;
    download_url?: string;
    exists: boolean;
}

export interface AgentSourceCode {
    available: boolean;
    download_url: string | null;
    size: number;
    size_human: string;
}

export interface AgentFilesResponse {
    packages: AgentPackage[];
    installers: AgentInstaller[];
    source_code: AgentSourceCode;
    latest_version: string;
}

export interface BuildPackageResponse {
    message: string;
    version: string | null;
    path?: string | null;
    size?: number | null;
    output?: string;
}

const AgentDownloadService = {
    listFiles: async (): Promise<AgentFilesResponse> => {
        const response = await apiClient.get('/agent/files');
        return response.data;
    },

    downloadPackage: async (version: string): Promise<Blob> => {
        const response = await apiClient.get(`/agent/download/${version}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    downloadInstaller: async (platform: 'windows' | 'linux'): Promise<Blob> => {
        const response = await apiClient.get(`/agent/installer/${platform}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    downloadSourceCode: async (): Promise<Blob> => {
        const response = await apiClient.get('/agent/source-code', {
            responseType: 'blob',
        });
        return response.data;
    },

    buildPackage: async (params?: { version?: string; force?: boolean }): Promise<BuildPackageResponse> => {
        const response = await apiClient.post('/agent/build-package', params ?? {});
        return response.data;
    },
};

export default AgentDownloadService;
