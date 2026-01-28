import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useGarments } from '../hooks/useGarments';
import { getAllCategories } from '../lib/utils';
import { TabBar } from '../components/ui/TabBar';
import { GarmentCard } from '../components/closet/GarmentCard';
import { UploadModal } from '../components/closet/UploadModal';
import type { GarmentCategory } from '../types';

export function Closet() {
    const categories = getAllCategories();
    const [activeCategory, setActiveCategory] = useState<GarmentCategory | 'all'>('all');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [gridColumns, setGridColumns] = useState(2); // Default to 2 columns as requested
    const [initialDistance, setInitialDistance] = useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setInitialDistance(dist);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (initialDistance && e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );

            const ratio = dist / initialDistance;

            // Pinch out (fingers apart) -> Zoom In -> 2 columns
            if (ratio > 1.25) {
                setGridColumns(2);
            }
            // Pinch in (fingers together) -> Zoom Out -> 3 columns
            else if (ratio < 0.75) {
                setGridColumns(3);
            }
        }
    };

    const handleTouchEnd = () => {
        setInitialDistance(null);
    };

    const categoryForQuery = activeCategory === 'all' ? undefined : activeCategory;
    const { garments, loading, deleteGarment } = useGarments(categoryForQuery);

    const handleDelete = async (id: string) => {
        if (confirm('¿Eliminar esta prenda?')) {
            await deleteGarment(id);
        }
    };

    const tabs = [
        { key: 'all', label: 'Todo' },
        ...categories.map((cat) => ({
            key: cat.key,
            label: cat.label,
            icon: cat.icon,
        })),
    ];

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header with Tabs */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">Mi Clóset</h1>
                    <TabBar
                        tabs={tabs}
                        activeTab={activeCategory}
                        onTabChange={(key) => setActiveCategory(key as GarmentCategory | 'all')}
                    />
                </div>
            </div>

            {/* Garments Grid */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
                        <p className="mt-4 text-slate-600">Cargando...</p>
                    </div>
                ) : garments.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">
                            {activeCategory === 'all' ? '👕' : categories.find((c) => c.key === activeCategory)?.icon}
                        </div>
                        <p className="text-slate-600 mb-6">
                            {activeCategory === 'all'
                                ? 'No tienes prendas en tu clóset'
                                : `No tienes prendas en ${categories.find((c) => c.key === activeCategory)?.label}`
                            }
                        </p>
                        {activeCategory !== 'all' && (
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                Agregar Primera Prenda
                            </button>
                        )}
                        {activeCategory === 'all' && (
                            <p className="text-sm text-slate-500 mt-2">
                                Selecciona una categoría para agregar prendas
                            </p>
                        )}
                    </div>
                ) : (
                    <div
                        className={`grid gap-2 transition-all duration-300 ${gridColumns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {garments.map((garment) => (
                            <GarmentCard
                                key={garment.id}
                                garment={garment}
                                onDelete={() => handleDelete(garment.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Action Button - Solo visible cuando NO está en 'Todo' */}
            {activeCategory !== 'all' && (
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="fixed bottom-24 right-6 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all flex items-center justify-center z-40"
                >
                    <Plus className="w-7 h-7" />
                </button>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <UploadModal
                    category={activeCategory === 'all' ? 'top' : activeCategory}
                    onClose={() => setShowUploadModal(false)}
                />
            )}
        </div>
    );
}
