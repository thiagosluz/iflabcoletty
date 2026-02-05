
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cn, isComputerOnline, copyToClipboard } from './utils';

describe('utils', () => {
    describe('cn', () => {
        it('merges class names correctly', () => {
            expect(cn('c-1', 'c-2')).toBe('c-1 c-2');
        });

        it('handles conditional classes', () => {
            const trueCondition = true;
            const falseCondition = false;
            expect(cn('c-1', trueCondition && 'c-2', falseCondition && 'c-3')).toBe('c-1 c-2');
        });

        it('merges tailwind classes using tailwind-merge', () => {
            expect(cn('p-2 p-4')).toBe('p-4');
        });
    });

    describe('isComputerOnline', () => {
        it('returns true if updated recently', () => {
            const now = new Date();
            const recent = new Date(now.getTime() - 2 * 60 * 1000); // 2 mins ago
            expect(isComputerOnline(recent)).toBe(true);
        });

        it('returns false if updated long ago', () => {
            const now = new Date();
            const old = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
            expect(isComputerOnline(old)).toBe(false);
        });

        it('handles custom threshold', () => {
            const now = new Date();
            const slightlyOld = new Date(now.getTime() - 6 * 60 * 1000); // 6 mins ago
            expect(isComputerOnline(slightlyOld, 10)).toBe(true); // threshold 10 mins
        });

        it('handles string input', () => {
            const now = new Date();
            const recent = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
            expect(isComputerOnline(recent)).toBe(true);
        });
    });

    describe('copyToClipboard', () => {
        // Mock document.execCommand and navigator.clipboard
        const originalClipboard = navigator.clipboard;

        afterEach(() => {
            // specific cleanup if needed, but we modify globals so relying on jsdom reset or manual restore
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
                writable: true
            });
            vi.restoreAllMocks();
        });

        it('uses navigator.clipboard if available', async () => {
            const writeTextMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                writable: true
            });

            const result = await copyToClipboard('test text');
            expect(writeTextMock).toHaveBeenCalledWith('test text');
            expect(result).toBe(true);
        });

        it('falls back to execCommand if clipboard API throws', async () => {
            // Mock clipboard to fail
            const writeTextMock = vi.fn().mockRejectedValue(new Error('fail'));
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                writable: true
            });

            // Mock execCommand
            document.execCommand = vi.fn().mockReturnValue(true);
            // Mock body.appendChild and removeChild to avoid polluting validation
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            const result = await copyToClipboard('fallback text');
            expect(writeTextMock).toHaveBeenCalled();
            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(result).toBe(true);
        });
    });
});
