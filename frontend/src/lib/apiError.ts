/**
 * Central helper for API/network errors to show consistent toast content.
 * Use with: toast({ ...getApiErrorToast(error), variant: 'destructive' }) or spread and variant is already set.
 */

export interface ApiErrorToastOptions {
    title: string;
    description: string;
    variant: 'default' | 'destructive';
}

function getMessage(data: unknown): string | undefined {
    if (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string') {
        return (data as { message: string }).message;
    }
    return undefined;
}

/**
 * Maps a caught error (typically from Axios) to toast props: title, description, variant.
 * Handles: 429 (rate limit), 5xx (server), ERR_NETWORK / no response (connection), other 4xx.
 */
export function getApiErrorToast(error: unknown): ApiErrorToastOptions {
    const err = error as {
        response?: { status?: number; data?: unknown; headers?: { 'retry-after'?: string } };
        code?: string;
    };
    const status = err.response?.status;
    const data = err.response?.data;
    const backendMessage = getMessage(data);
    const retryAfter = err.response?.headers?.['retry-after'];

    if (status === 429) {
        const desc = retryAfter
            ? `Tente novamente em ${retryAfter} segundos.`
            : backendMessage ?? 'Muitas requisições. Aguarde um momento.';
        return {
            title: 'Muitas requisições',
            description: desc,
            variant: 'destructive',
        };
    }

    if (status !== undefined && status >= 500) {
        return {
            title: 'Erro no servidor',
            description: backendMessage ?? 'Algo deu errado no servidor. Tente mais tarde.',
            variant: 'destructive',
        };
    }

    const isNetworkError =
        err.code === 'ERR_NETWORK' ||
        err.code === 'ECONNABORTED' ||
        !err.response;

    if (isNetworkError) {
        return {
            title: 'Sem conexão',
            description: 'Verifique sua internet e tente novamente.',
            variant: 'destructive',
        };
    }

    return {
        title: 'Erro',
        description: backendMessage ?? 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
    };
}
