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
