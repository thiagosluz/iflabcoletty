
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge Component', () => {
    it('renders with default variant', () => {
        render(<Badge>Default</Badge>);
        const badge = screen.getByText('Default');
        expect(badge).toBeInTheDocument();
        // Check for default classes (bg-primary) through partial string matching if needed, 
        // but checking presence is key. 
        expect(badge).toHaveClass('bg-primary');
    });

    it('renders with destructive variant', () => {
        render(<Badge variant="destructive">Destructive</Badge>);
        const badge = screen.getByText('Destructive');
        expect(badge).toHaveClass('bg-destructive');
    });

    it('renders with secondary variant', () => {
        render(<Badge variant="secondary">Secondary</Badge>);
        const badge = screen.getByText('Secondary');
        expect(badge).toHaveClass('bg-secondary');
    });

    it('renders with outline variant', () => {
        render(<Badge variant="outline">Outline</Badge>);
        const badge = screen.getByText('Outline');
        expect(badge).toHaveClass('text-foreground');
    });

    it('merges custom className', () => {
        render(<Badge className="custom-class">Custom</Badge>);
        const badge = screen.getByText('Custom');
        expect(badge).toHaveClass('custom-class');
    });
});
