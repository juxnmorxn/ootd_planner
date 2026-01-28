import { useState, useEffect } from 'react';
import { ArrowLeft, Image as ImageIcon, Search, User as UserIcon, Calendar, Info, Trash2 } from 'lucide-react';
import { apiDb } from '../lib/api-db';
import type { Garment } from '../types';

interface AdminGarment extends Garment {
    owner_name: string;
    owner_email: string;
}

interface AdminGalleryProps {
    onBack: () => void;
}

export function AdminGallery({ onBack }: AdminGalleryProps) {
    const [garments, setGarments] = useState<AdminGarment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const loadGarments = async () => {
        try {
            setLoading(true);
            const data = await apiDb.getAllGarments();
            setGarments(data);
        } catch (err) {
            console.error('Error al cargar galería comunitaria:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGarments();
    }, []);

    const filteredGarments = garments.filter(g =>
        g.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.owner_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.sub_category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteGarment = async (garment: AdminGarment) => {
        if (confirm(`¿Estás seguro de que deseas eliminar esta prenda de ${garment.owner_name}?`)) {
            try {
                await apiDb.deleteGarment(garment.id, garment.user_id);
                setGarments(garments.filter(g => g.id !== garment.id));
            } catch (err) {
                alert('Error al eliminar la prenda');
            }
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Reciente';
        const date = new Date(parseInt(dateStr) || dateStr);
        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <ArrowLeft className="w-6 h-6 text-slate-700" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Galería Comunitaria</h1>
                            <p className="text-xs text-slate-500">Supervisión de contenido global</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por usuario, email o categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-600 font-medium">Escaneando clósets...</p>
                    </div>
                ) : filteredGarments.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                        <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No se encontraron fotos con esos criterios.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-scale-in">
                        {filteredGarments.map((garment) => (
                            <div key={garment.id} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                {/* Image */}
                                <div className="aspect-[3/4] overflow-hidden bg-slate-50">
                                    <img
                                        src={garment.image_data}
                                        alt={garment.sub_category}
                                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                                    />

                                    {/* Overlay Info on Hover */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <UserIcon className="w-3 h-3 text-indigo-300" />
                                            <p className="text-[10px] font-bold truncate">{garment.owner_name}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Info className="w-3 h-3 text-indigo-300" />
                                            <p className="text-[10px] truncate">{garment.sub_category}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteGarment(garment)}
                                            className="mt-3 w-full py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Eliminar
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Label (Visible always) */}
                                <div className="p-2 border-t border-slate-50 bg-white">
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="text-[10px] font-bold text-slate-800 truncate">{garment.owner_name}</p>
                                        <span className="text-[8px] text-slate-400 flex items-center gap-0.5">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {formatDate(garment.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
