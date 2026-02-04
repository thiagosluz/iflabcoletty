import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Title for default fallback UI */
    title?: string;
    /** Description for default fallback UI */
    description?: string;
    /** Show "Reload" instead of "Back to start" when true (e.g. global boundary) */
    showReload?: boolean;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleBack = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/admin/dashboard';
    };

    render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            const title = this.props.title ?? 'Algo deu errado';
            const description =
                this.props.description ??
                'Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao início.';
            return (
                <div className="flex min-h-[200px] items-center justify-center p-6">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <CardTitle>{title}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </CardContent>
                        <CardFooter className="flex gap-2">
                            {this.props.showReload ? (
                                <Button onClick={this.handleReload}>Recarregar página</Button>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
                                        Tentar de novo
                                    </Button>
                                    <Button onClick={this.handleBack}>Voltar ao início</Button>
                                </>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            );
        }
        return this.props.children;
    }
}
