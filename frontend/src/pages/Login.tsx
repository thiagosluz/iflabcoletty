import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/store/auth';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

import axios from 'axios';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const login = useAuthStore((state) => state.login);
    const navigate = useNavigate();

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            setError(''); // Clear previous errors

            // Sanctum CSRF - using global axios to bypass baseURL
            await axios.get('/sanctum/csrf-cookie', { withCredentials: true }).catch(() => { });

            const response = await apiClient.post('/login', data);
            login(response.data.token, response.data.user);
            navigate('/admin/dashboard');
        } catch (err: unknown) {
            const ax = err as { response?: { status?: number; headers?: Record<string, string>; data?: { message?: string } } };
            if (ax.response?.status === 429) {
                const retryAfter = ax.response.headers?.['retry-after'] ?? 60;
                setError(`Muitas tentativas de login. Aguarde ${retryAfter} segundos antes de tentar novamente.`);
            } else {
                setError(ax.response?.data?.message ?? 'Falha no login. Verifique suas credenciais.');
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Login Administrativo</CardTitle>
                    <CardDescription>Digite suas credenciais para acessar o painel.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input id="email" type="email" placeholder="admin@iflab.com" {...register('email')} />
                            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
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
                        <div className="flex justify-end">
                            <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                                Esqueceu sua senha?
                            </Link>
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div >
    );
}
