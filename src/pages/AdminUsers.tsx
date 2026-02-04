import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Shield, User as UserIcon, Trash2, Mail, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { apiDb } from '../lib/api-db';
import type { User, Garment } from '../types';
import { useStore } from '../lib/store';
import { useToast } from '../components/ui/Toast';

interface AdminUsersProps {
    onBack: () => void;
}

export function AdminUsers({ onBack }: AdminUsersProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userGarments, setUserGarments] = useState<Garment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingGarments, setLoadingGarments] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentUser = useStore((state) => state.currentUser);
    const { showToast } = useToast();

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await apiDb.getAllUsers();
            setUsers(data);
        } catch (err) {
            setError('Error al cargar la lista de usuarios');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadUserGarments = async (user: User) => {
        try {
            setLoadingGarments(true);
            const data = await apiDb.getGarmentsByUser(user.id);
            setUserGarments(data);
            setSelectedUser(user);
        } catch (err) {
            showToast({
                type: 'error',
                message: 'Error al cargar prendas del usuario',
            });
            console.error(err);
        } finally {
            setLoadingGarments(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleDeleteUser = async (user: User) => {
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${user.username}? Esta acción es irreversible.`)) {
            try {
                await apiDb.deleteUser(user.id);
                setUsers(users.filter(u => u.id !== user.id));
                showToast({
                    type: 'success',
                    message: `Usuario ${user.username} eliminado correctamente`,
                });
            } catch (err) {
                showToast({
                    type: 'error',
                    message: 'No se pudo eliminar el usuario',
                });
            }
        }
    };

    if (selectedUser) {
        return (
            <div
                className="min-h-screen pb-20"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
                {/* Header for User Gallery */}
                <div
                    className="sticky top-0 z-10 shadow-sm border-b"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg transition-colors hover:bg-black/5">
                            <ArrowLeft className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                            >
                                {selectedUser.profile_pic ? (
                                    <img src={selectedUser.profile_pic} alt={selectedUser.username} className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                )}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Clóset de {selectedUser.username || 'Usuario'}</h1>
                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{userGarments.length} prendas registradas</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    {loadingGarments ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}></div>
                        </div>
                    ) : userGarments.length === 0 ? (
                        <div
                            className="text-center py-20 rounded-2xl border border-dashed"
                            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                        >
                            <ImageIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                            <p>Este usuario aún no tiene prendas en su clóset.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {userGarments.map((garment) => (
                                <div
                                    key={garment.id}
                                    className="rounded-2xl overflow-hidden border shadow-sm p-2"
                                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                                >
                                    <div className="aspect-[3/4] overflow-hidden rounded-xl mb-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
                                        <img src={garment.image_data} alt={garment.sub_category} className="w-full h-full object-contain" />
                                    </div>
                                    <p className="text-[10px] font-bold text-center uppercase tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>{garment.sub_category}</p>
                                    <p className="text-[8px] text-center uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{garment.category}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen pb-20"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            <div
                className="sticky top-0 z-10 border-b"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            >
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-lg transition-colors hover:bg-black/5">
                        <ArrowLeft className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Usuarios Registrados</h1>
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                            <Users className="w-3 h-3" />
                            Gestión de comunidad ({users.length})
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}></div>
                        <p className="mt-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Cargando base de datos...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
                        {error}
                    </div>
                ) : users.length === 0 ? (
                    <div
                        className="text-center py-20 rounded-2xl border border-dashed"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                    >
                        <p>No hay usuarios registrados aparte de ti.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => loadUserGarments(user)}
                                className="p-4 rounded-2xl border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border"
                                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                                    >
                                        {user.profile_pic ? (
                                            <img src={user.profile_pic} alt={user.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{user.username || 'Usuario sin nombre'}</p>
                                            {user.role === 'admin' && (
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-full border border-indigo-100 flex items-center gap-0.5">
                                                    <Shield className="w-2.5 h-2.5" />
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                            <Mail className="w-3 h-3" />
                                            {user.email}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {user.id !== currentUser?.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteUser(user);
                                            }}
                                            className="p-2 rounded-lg transition-all"
                                            style={{ color: 'var(--text-tertiary)' }}
                                            title="Eliminar usuario"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <ChevronRight className="w-5 h-5 transition-colors" style={{ color: 'var(--text-tertiary)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
