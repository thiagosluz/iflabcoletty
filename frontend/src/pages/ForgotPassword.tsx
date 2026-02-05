import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Link } from 'react-router-dom';

// Schema for email validation
const forgotPasswordSchema = z.object({
    email: z.string().email('Por favor, insira um e-mail válido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            setStatus('idle');
            setMessage('');

            await apiClient.post('/forgot-password', data);

            setStatus('success');
            setMessage('Um link de redefinição de senha foi enviado para o seu e-mail.');
        } catch (error: unknown) {
            setStatus('error');
            const err = error as { response?: { data?: { email?: string; message?: string } } };
            setMessage(err.response?.data?.email || err.response?.data?.message || 'Ocorreu um erro ao tentar enviar o e-mail. Tente novamente.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Redefinir Senha</CardTitle>
                    <CardDescription>
                        Digite seu e-mail e enviaremos um link para você redefinir sua senha.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {status === 'success' ? (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
                            <span className="block sm:inline">{message}</span>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    {...register('email')}
                                    disabled={isSubmitting}
                                />
                                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                            </div>

                            {status === 'error' && (
                                <div className="text-sm text-red-500">
                                    {message}
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Enviando...' : 'Enviar Link de Redefinição'}
                            </Button>
                        </form>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                        Voltar para o Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
