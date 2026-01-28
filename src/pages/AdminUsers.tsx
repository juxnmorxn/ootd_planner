import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Shield, User as UserIcon, Trash2, Mail, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { apiDb } from '../lib/api-db';
import type { User, Garment } from '../types';
import { useStore } from '../lib/store';

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
            alert('Error al cargar prendas del usuario');
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
            } catch (err) {
                alert('No se pudo eliminar el usuario');
            }
        }
    };

    if (selectedUser) {
        return (
            <div className="min-h-screen bg-slate-50 pb-20">
                {/* Header for User Gallery */}
                <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <ArrowLeft className="w-6 h-6 text-slate-700" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200">
                                {selectedUser.profile_pic ? (
                                    <img src={selectedUser.profile_pic} alt={selectedUser.username} className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-5 h-5 text-slate-400" />
                                )}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Clóset de {selectedUser.username || 'Usuario'}</h1>
                                <p className="text-xs text-slate-500">{userGarments.length} prendas registradas</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    {loadingGarments ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : userGarments.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">Este usuario aún no tiene prendas en su clóset.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {userGarments.map((garment) => (
                                <div key={garment.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm p-2">
                                    <div className="aspect-[3/4] overflow-hidden bg-slate-50 rounded-xl mb-2">
                                        <img src={garment.image_data} alt={garment.sub_category} className="w-full h-full object-contain" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-800 text-center uppercase tracking-tight truncate">{garment.sub_category}</p>
                                    <p className="text-[8px] text-slate-400 text-center uppercase tracking-widest">{garment.category}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Usuarios Registrados</h1>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Gestión de comunidad ({users.length})
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-600 font-medium">Cargando base de datos...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
                        {error}
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500">No hay usuarios registrados aparte de ti.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => loadUserGarments(user)}
                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer hover:border-indigo-200"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200">
                                        {user.profile_pic ? (
                                            <img src={user.profile_pic} alt={user.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-6 h-6 text-slate-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900">{user.username || 'Usuario sin nombre'}</p>
                                            {user.role === 'admin' && (
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-full border border-indigo-100 flex items-center gap-0.5">
                                                    <Shield className="w-2.5 h-2.5" />
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
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
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Eliminar usuario"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
