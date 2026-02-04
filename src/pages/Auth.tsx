import { useMemo, useState } from 'react';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/db';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import type { User as UserType } from '../types';

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

    const isOffline = useMemo(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false), []);

    const continueOffline = () => {
        const now = new Date().toISOString();
        const safeEmail = (email || '').trim();
        const safeUsername = (username || '').trim();

        const finalEmail = safeEmail || `${safeUsername || 'user'}@offline.local`;
        const finalUsername = safeUsername || finalEmail.split('@')[0];

        const offlineUser: UserType = {
            id: uuidv4(),
            email: finalEmail,
            username: finalUsername,
            role: 'user',
            created_at: now,
            updated_at: now,
            loginTimestamp: Date.now(), // Guardar timestamp de login
            lastSyncTimestamp: 0, // Nunca sincronizado
        };

        setCurrentUser(offlineUser);
        onSuccess();
    };

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
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            {/* Logo */}
            <div className="text-center mb-8">
                <div
                    className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 shadow-lg"
                    style={{ backgroundColor: 'var(--btn-primary-bg)' }}
                >
                    <span className="text-4xl">👔</span>
                </div>
                <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Outfit Planner</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu clóset digital'}
                </p>
            </div>

            {/* Form Card */}
            <div
                className="w-full max-w-sm rounded-2xl shadow-sm border p-6"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            >
                <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                    {/* Email (required) */}
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                            Email
                        </label>
                        <div className="relative">
                            <User
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                                style={{ color: 'var(--text-tertiary)' }}
                            />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                                style={{
                                    backgroundColor: 'var(--input-bg)',
                                    borderColor: 'var(--input-border)',
                                    color: 'var(--input-text)',
                                }}
                                placeholder="tu@email.com"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Username (optional, only for register) */}
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                                Nombre de usuario <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                                style={{
                                    backgroundColor: 'var(--input-bg)',
                                    borderColor: 'var(--input-border)',
                                    color: 'var(--input-text)',
                                }}
                                placeholder="usuario123"
                            />
                        </div>
                    )}

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                            Contraseña
                        </label>
                        <div className="relative">
                            <Lock
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                                style={{ color: 'var(--text-tertiary)' }}
                            />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                                style={{
                                    backgroundColor: 'var(--input-bg)',
                                    borderColor: 'var(--input-border)',
                                    color: 'var(--input-text)',
                                }}
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password (only for register) */}
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                                Confirmar contraseña
                            </label>
                            <div className="relative">
                                <Lock
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                                    style={{
                                        backgroundColor: 'var(--input-bg)',
                                        borderColor: 'var(--input-border)',
                                        color: 'var(--input-text)',
                                    }}
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

                {/* Offline Mode */}
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={continueOffline}
                        className="w-full px-4 py-3 rounded-xl border font-semibold transition-colors"
                        style={{
                            borderColor: 'var(--border-primary)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        Continuar offline
                    </button>
                    <p className="mt-2 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                        {isOffline
                            ? 'Sin conexión: usarás solo datos locales (se sincroniza cuando haya internet).'
                            : 'También puedes usar la app sin crear cuenta (modo local).'}
                    </p>
                </div>

                {/* Toggle Mode */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setMode(mode === 'login' ? 'register' : 'login');
                            setError('');
                            setPassword('');
                            setConfirmPassword('');
                        }}
                        className="text-sm transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
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
            <p className="mt-6 text-xs text-center max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
                Tus datos se guardan de forma segura en tu dispositivo.
                {mode === 'register' && ' Las contraseñas están encriptadas con bcrypt.'}
            </p>
        </div>
    );
}
