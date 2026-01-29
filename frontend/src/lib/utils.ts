import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { useEffect, useState } from "react"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Check if a computer is online based on its updated_at timestamp
 * A computer is considered online if it was updated within the last 5 minutes
 * @param updatedAt - ISO date string or Date object
 * @param thresholdMinutes - Threshold in minutes (default: 5)
 * @returns true if computer is online, false otherwise
 */
export function isComputerOnline(updatedAt: string | Date, thresholdMinutes: number = 5): boolean {
    const date = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
    const now = new Date();
    const diffMinutes = (now.getTime() - date.getTime()) / 1000 / 60;
    return diffMinutes < thresholdMinutes;
}

/**
 * Copy text to clipboard. Works in HTTP (non-secure) contexts by falling back to
 * document.execCommand('copy') when navigator.clipboard is unavailable.
 * @param text - Text to copy
 * @returns true if copy succeeded, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to fallback
        }
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}
