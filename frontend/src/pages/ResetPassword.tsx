import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

// Schema for password validation
const resetPasswordSchema = z.object({
    email: z.string().email(),
    token: z.string().min(1),
    password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    password_confirmation: z.string(),
}).refine((data) => data.password === data.password_confirmation, {
    message: "As senhas não conferem",
    path: ["password_confirmation"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Get token and email from URL parameters
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            email,
            token,
        }
    });

    // Ensure email and token are set if they change (e.g. late load)
    useEffect(() => {
        if (email) setValue('email', email);
        if (token) setValue('token', token);
    }, [email, token, setValue]);

    const onSubmit = async (data: ResetPasswordFormData) => {
        try {
            setStatus('idle');
            setMessage('');

            await apiClient.post('/reset-password', data);

            setStatus('success');
            setMessage('Sua senha foi redefinida com sucesso!');

            // Redirect to login after a few seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (error: unknown) {
            setStatus('error');
            const err = error as { response?: { data?: { email?: string; message?: string; errors?: Record<string, string[]> } } };
            // Handle different error structures (flat message or validation errors array)
            const validationError = err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : null;
            setMessage(validationError || err.response?.data?.email || err.response?.data?.message || 'Falha ao redefinir a senha. O link pode ter expirado.');
        }
    };

    if (!token) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-red-600">Link Inválido</CardTitle>
                        <CardDescription>
                            O link de redefinição de senha é inválido ou está incompleto.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link to="/forgot-password" className="w-full">
                            <Button className="w-full">Solicitar novo link</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Criar Nova Senha</CardTitle>
                    <CardDescription>
                        Defina sua nova senha para acessar o sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'success' ? (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
                                {message}
                            </div>
                            <p className="text-center text-sm text-gray-500">
                                Você será redirecionado para o login em instantes...
                            </p>
                            <Button className="w-full" onClick={() => navigate('/login')}>
                                Ir para Login agora
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {/* Hidden fields for token and email */}
                            <input type="hidden" {...register('token')} />
                            <input type="hidden" {...register('email')} />

                            <div className="space-y-2">
                                <Label htmlFor="password">Nova Senha</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        {...register('password')}
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-gray-500" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-gray-500" />
                                        )}
                                        <span className="sr-only">{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</span>
                                    </Button>
                                </div>
                                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation">Confirmar Nova Senha</Label>
                                <Input
                                    id="password_confirmation"
                                    type={showPassword ? "text" : "password"}
                                    {...register('password_confirmation')}
                                />
                                {errors.password_confirmation && <p className="text-sm text-red-500">{errors.password_confirmation.message}</p>}
                            </div>

                            {status === 'error' && (
                                <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">
                                    {message}
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Redefinindo...' : 'Redefinir Senha'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
