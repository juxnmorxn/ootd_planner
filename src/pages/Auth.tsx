import { useState } from 'react';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { db } from '../lib/db';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';

interface AuthProps {
    onSuccess: () => void;
}

export function Auth({ onSuccess }: AuthProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const setCurrentUser = useStore((state) => state.setCurrentUser);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // El backend acepta username O email en el campo "username",
            // así que usamos siempre el email como identificador de login.
            const user = await db.login({ username: email, password });
            setCurrentUser(user);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validations
        if (!email) {
            setError('El email es obligatorio');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            const user = await db.register({
                email,
                password,
                username: username || undefined,
            });
            setCurrentUser(user);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear la cuenta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            {/* Logo */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-black rounded-2xl mb-4 shadow-lg">
                    <span className="text-4xl">👔</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">Outfit Planner</h1>
                <p className="text-slate-600">
                    {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu clóset digital'}
                </p>
            </div>

            {/* Form Card */}
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                    {/* Email (required) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                                placeholder="tu@email.com"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Username (optional, only for register) */}
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nombre de usuario <span className="text-slate-400">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                                placeholder="usuario123"
                            />
                        </div>
                    )}

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password (only for register) */}
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Confirmar contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full"
                        size="lg"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {mode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'}
                            </span>
                        ) : (
                            mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
                        )}
                    </Button>
                </form>

                {/* Toggle Mode */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setMode(mode === 'login' ? 'register' : 'login');
                            setError('');
                            setPassword('');
                            setConfirmPassword('');
                        }}
                        className="text-sm text-slate-600 hover:text-black transition-colors"
                    >
                        {mode === 'login' ? (
                            <>
                                ¿No tienes cuenta? <span className="font-semibold">Regístrate</span>
                            </>
                        ) : (
                            <>
                                ¿Ya tienes cuenta? <span className="font-semibold">Inicia sesión</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Footer Note */}
            <p className="mt-6 text-xs text-slate-500 text-center max-w-sm">
                Tus datos se guardan de forma segura en tu dispositivo.
                {mode === 'register' && ' Las contraseñas están encriptadas con bcrypt.'}
            </p>
        </div>
    );
}
