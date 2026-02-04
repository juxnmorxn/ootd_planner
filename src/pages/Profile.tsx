import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Camera, LogOut, Trash2, Lock, Mail, User as UserIcon, Shield, Users, RefreshCw, Clock } from 'lucide-react';
import { useStore } from '../lib/store';
import { db } from '../lib/db';
import { watermelonService } from '../lib/watermelon-service';
import { syncDatabase } from '../lib/watermelon';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';

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
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!currentUser) {
        return null;
    }

    const handleManualSync = async () => {
        setSyncing(true);
        try {
            const apiUrl = window.location.hostname === 'localhost'
                ? 'http://localhost:3001/api'
                : '/api';
            await syncDatabase(currentUser.id, apiUrl);
            setCurrentUser({
                ...currentUser,
                lastSyncTimestamp: Date.now(),
            });
            showToast({
                type: 'success',
                message: '✅ Sincronizado correctamente',
            });
        } catch (err) {
            showToast({
                type: 'error',
                message: 'Error al sincronizar',
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleClearData = async () => {
        if (!window.confirm('¿Borrar todos los datos locales? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await watermelonService.clearAll();
            showToast({
                type: 'success',
                message: 'Datos locales borrados',
            });
        } catch (err) {
            showToast({
                type: 'error',
                message: 'Error al borrar datos',
            });
        }
    };

    const formatLastSync = (timestamp?: number) => {
        if (!timestamp || timestamp === 0) return 'Nunca sincronizado';
        
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Hace poco';
        if (minutes < 60) return `Hace ${minutes}m`;
        if (hours < 24) return `Hace ${hours}h`;
        return `Hace ${days}d`;
    };

    const sessionDaysLeft = currentUser.loginTimestamp 
        ? Math.floor((60 * 24 * 60 * 60 * 1000 - (Date.now() - currentUser.loginTimestamp)) / (24 * 60 * 60 * 1000))
        : 60;

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
        <div
            className="min-h-screen overflow-y-auto pb-20"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            {/* Header */}
            <div
                className="border-b sticky top-0 z-10"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            >
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mi Perfil</h1>
                    <div className="w-8" />
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* Profile Header */}
                <div
                    className="rounded-2xl shadow-sm border p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <div className="flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative mb-4">
                            <div
                                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
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
                                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors"
                                style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
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
                            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                {currentUser.username || currentUser.email}
                            </h2>
                            {currentUser.role === 'admin' && (
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-full border border-indigo-100 flex items-center gap-1 shadow-sm">
                                    <Shield className="w-3 h-3" />
                                    Super Admin
                                </span>
                            )}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
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
                    <div className="rounded-2xl shadow-md p-6 text-white animate-fade-in-up" style={{ backgroundColor: 'var(--accent-primary)' }}>
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

                {/* Social & Contacts */}
                <div
                    className="rounded-2xl shadow-sm border p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Contactos y Chats</h3>
                    <p className="text-sm mb-4 text-left" style={{ color: 'var(--text-secondary)' }}>
                        Agrega amigos por su nombre de usuario, gestiona solicitudes de amistad y chatea solo con tus contactos aceptados.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setView('contacts')}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            Ver contactos y solicitudes
                        </Button>
                        <Button
                            onClick={() => setView('chats')}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            💬
                            Ir a chats
                        </Button>
                    </div>
                </div>

                {/* Appearance */}
                <div
                    className="rounded-2xl shadow-sm border border-slate-100 p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Apariencia</h3>
                    <p className="text-sm mb-4 text-left" style={{ color: 'var(--text-secondary)' }}>
                        Controla el tema claro/oscuro y prueba fondos.
                    </p>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Tema oscuro</span>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Actívalo para usar la interfaz oscura.</span>
                        </div>
                        <ThemeSwitch />
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => setView('fondos')}
                        className="w-full flex items-center justify-center gap-2"
                    >
                        🎨
                        Fondos
                    </Button>
                </div>

                {/* Edit Profile */}
                <div
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Información Personal</h3>

                    {editing ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
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
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
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
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Usuario</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{currentUser.username || 'Sin usuario'}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
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
                <div
                    className="bg-white rounded-2xl shadow-sm border p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
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

                {/* Synchronization & Storage */}
                <div
                    className="bg-white rounded-2xl shadow-sm border p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                        Sincronización
                    </h3>
                    <div className="space-y-4">
                        {/* Last Sync Info */}
                        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                            <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Última sincronización</span>
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {currentUser?.lastSyncTimestamp && currentUser.lastSyncTimestamp > 0
                                    ? formatLastSync(currentUser.lastSyncTimestamp)
                                    : 'Nunca'}
                            </span>
                        </div>

                        {/* Session Info */}
                        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                            <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sesión válida por</span>
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {currentUser?.loginTimestamp
                                    ? `${Math.max(0, sessionDaysLeft)} días`
                                    : 'N/A'}
                            </span>
                        </div>

                        {/* Sync Button */}
                        <Button
                            onClick={handleManualSync}
                            disabled={syncing}
                            className="w-full"
                        >
                            <RefreshCw className={`w-5 h-5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                        </Button>

                        {/* Clear Data Button */}
                        <Button
                            variant="secondary"
                            onClick={handleClearData}
                            className="w-full"
                        >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Borrar Datos Locales
                        </Button>

                        <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
                            Las imágenes se sincronizan automáticamente con Cloudinary cuando hay conexión.
                            Tus datos están seguros en múltiples dispositivos.
                        </p>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="rounded-2xl shadow-sm border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-danger, #fecaca)' }}>
                    <h3 className="text-lg font-semibold mb-4 text-red-600">Zona de Peligro</h3>
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
