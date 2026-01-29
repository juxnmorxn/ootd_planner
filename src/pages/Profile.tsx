import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Camera, LogOut, Trash2, Lock, Mail, User as UserIcon, Shield, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { db } from '../lib/db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

interface ProfileProps {
    onBack: () => void;
    onLogout: () => void;
}

export function Profile({ onBack, onLogout }: ProfileProps) {
    const currentUser = useStore((state) => state.currentUser);
    const setCurrentUser = useStore((state) => state.setCurrentUser);
    const logout = useStore((state) => state.logout);
    const setView = useStore((state) => state.setCurrentView);
    const { showToast } = useToast();

    const [editing, setEditing] = useState(false);
    const [username, setUsername] = useState(currentUser?.username || '');
    const [email, setEmail] = useState(currentUser?.email || '');
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!currentUser) {
        return null;
    }

    const handleUpdateProfile = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const updatedUser = await db.updateUser(currentUser.id, {
                username: username || undefined,
                email,
            });
            setCurrentUser(updatedUser);
            setEditing(false);
            setSuccess('Perfil actualizado correctamente');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al actualizar perfil');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        setError('');
        setSuccess('');

        if (newPassword.length < 6) {
            setError('La nueva contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            await db.changePassword(currentUser.id, oldPassword, newPassword);
            setShowChangePassword(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            setSuccess('Contraseña cambiada correctamente');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
        } finally {
            setLoading(false);
        }
    };
    const handleAvatarClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const toBase64 = (f: File) =>
                new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = (err) => reject(err);
                    reader.readAsDataURL(f);
                });

            const imageData = await toBase64(file);
            const updatedUser = await db.updateProfilePicture(currentUser.id, imageData);
            setCurrentUser(updatedUser);
            setSuccess('Foto de perfil actualizada');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al actualizar foto de perfil');
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteAccount = () => {
        showToast({
            type: 'info',
            message: 'La opción de eliminar cuenta estará disponible próximamente.',
        });
    };

    const handleLogout = () => {
        logout();
        onLogout();
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-100">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">Mi Perfil</h1>
                    <div className="w-8" />
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* Profile Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative mb-4">
                            <div className="w-24 h-24 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-4xl font-bold text-slate-700 overflow-hidden">
                                {currentUser.profile_pic ? (
                                    <img
                                        src={currentUser.profile_pic}
                                        alt="Foto de perfil"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    (currentUser.username || currentUser.email)
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleAvatarClick}
                                className="absolute bottom-0 right-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-800 transition-colors"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-bold text-slate-900">
                                {currentUser.username || currentUser.email}
                            </h2>
                            {currentUser.role === 'admin' && (
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-full border border-indigo-100 flex items-center gap-1 shadow-sm">
                                    <Shield className="w-3 h-3" />
                                    Super Admin
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500">
                            Miembro desde{' '}
                            {currentUser.created_at
                                ? new Date(currentUser.created_at).toLocaleDateString('es-MX', {
                                    month: 'long',
                                    year: 'numeric',
                                })
                                : 'fecha desconocida'}
                        </p>
                    </div>
                </div>

                {/* Admin Access (Only for admins) - TOP LEVEL FOR VISIBILITY */}
                {currentUser.role === 'admin' && (
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-md p-6 text-white animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Panel de Control</h3>
                                <p className="text-indigo-100 text-xs text-left">Gestión de la plataforma</p>
                            </div>
                        </div>
                        <p className="text-sm text-indigo-50 mb-4 opacity-90 text-left">
                            Como superadministrador, puedes gestionar usuarios y supervisar la comunidad.
                        </p>
                        <Button
                            onClick={() => setView('admin-users')}
                            className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-sm font-bold flex items-center justify-center gap-2"
                        >
                            <Users className="w-5 h-5" />
                            Gestión de Comunidad
                        </Button>
                    </div>
                )}

                {/* Edit Profile */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Información Personal</h3>

                    {editing ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <UserIcon className="w-4 h-4 inline mr-2" />
                                    Nombre de usuario
                                </label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="usuario123"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <Mail className="w-4 h-4 inline mr-2" />
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                                    {success}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setEditing(false);
                                        setUsername(currentUser.username || '');
                                        setEmail(currentUser.email || '');
                                        setError('');
                                    }}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleUpdateProfile}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-600">Usuario</span>
                                <span className="text-sm font-medium text-slate-900">{currentUser.username || 'Sin usuario'}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-600">Email</span>
                                <span className="text-sm font-medium text-slate-900">
                                    {currentUser.email || 'No configurado'}
                                </span>
                            </div>

                            {success && (
                                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                                    {success}
                                </div>
                            )}

                            <Button
                                variant="secondary"
                                onClick={() => setEditing(true)}
                                className="w-full"
                            >
                                Editar Perfil
                            </Button>
                        </div>
                    )}
                </div>

                {/* Change Password */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        <Lock className="w-5 h-5 inline mr-2" />
                        Seguridad
                    </h3>

                    {showChangePassword ? (
                        <div className="space-y-4">
                            <Input
                                type="password"
                                label="Contraseña actual"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                            <Input
                                type="password"
                                label="Nueva contraseña"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                            <Input
                                type="password"
                                label="Confirmar nueva contraseña"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                placeholder="••••••••"
                            />

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setShowChangePassword(false);
                                        setOldPassword('');
                                        setNewPassword('');
                                        setConfirmNewPassword('');
                                        setError('');
                                    }}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleChangePassword}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    {loading ? 'Cambiando...' : 'Cambiar'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="secondary"
                            onClick={() => setShowChangePassword(true)}
                            className="w-full"
                        >
                            Cambiar Contraseña
                        </Button>
                    )}
                </div>

                {/* Future Features (Disabled) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 opacity-50">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Próximamente</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-slate-600">☁️ Sincronización en la nube</span>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Pronto</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-slate-600">🔗 Invitar amigos al armario</span>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Pronto</span>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
                    <h3 className="text-lg font-semibold text-red-600 mb-4">Zona de Peligro</h3>
                    <div className="space-y-3">
                        <Button
                            variant="secondary"
                            onClick={handleLogout}
                            className="w-full"
                        >
                            <LogOut className="w-5 h-5 mr-2" />
                            Cerrar Sesión
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteAccount}
                            className="w-full"
                        >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Eliminar Cuenta
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
