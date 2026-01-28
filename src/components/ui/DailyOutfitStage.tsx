import { useEffect, useState } from 'react';
import { Plus, Edit3 } from 'lucide-react';
import { useOutfits } from '../../hooks/useOutfits';
import { useGarments } from '../../hooks/useGarments';
import type { OutfitLayer, Outfit, GarmentCategory } from '../../types';

interface DailyOutfitStageProps {
    selectedDate: string;
    onEditOutfit: () => void;
}

export function DailyOutfitStage({ selectedDate, onEditOutfit }: DailyOutfitStageProps) {
    const { getOutfitByDate } = useOutfits();
    const { garments: allGarments } = useGarments();
    const [outfit, setOutfit] = useState<Outfit | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOutfit();
    }, [selectedDate]);

    const loadOutfit = async () => {
        setLoading(true);
        try {
            const data = await getOutfitByDate(selectedDate);
            setOutfit(data);
        } catch (error) {
            console.error('Failed to load outfit:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
            </div>
        );
    }

    if (!outfit) {
        return <EmptyStatePlaceholder onCreateOutfit={onEditOutfit} />;
    }

    return <OutfitDisplay outfit={outfit} allGarments={allGarments} onEdit={onEditOutfit} />;
}

// Empty State Component
function EmptyStatePlaceholder({ onCreateOutfit }: { onCreateOutfit: () => void }) {
    return (
        <button
            onClick={onCreateOutfit}
            className="flex-1 flex items-center justify-center bg-white relative overflow-hidden touch-manipulation group"
        >
            {/* Mannequin Silhouette Background */}
            <svg viewBox="0 0 200 400" className="absolute h-3/4 opacity-5 group-hover:opacity-10 transition-opacity" fill="currentColor">
                <ellipse cx="100" cy="50" rx="30" ry="40" />
                <rect x="70" y="90" width="60" height="120" rx="10" />
                <rect x="60" y="210" width="35" height="180" rx="8" />
                <rect x="105" y="210" width="35" height="180" rx="8" />
            </svg>

            {/* CTA */}
            <div className="relative z-10 text-center px-8">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:shadow-md transition-shadow border-2 border-slate-100">
                    <Plus className="w-10 h-10 text-slate-400 group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Sin outfit planeado</h3>
                <p className="text-slate-500">Toca para armar tu look del día</p>
            </div>
        </button>
    );
}

// Outfit Display Component with Swipe
function OutfitDisplay({ outfit, allGarments, onEdit }: { outfit: Outfit; allGarments: any[]; onEdit: () => void }) {
    const { updateOutfit } = useOutfits();
    const [layers, setLayers] = useState<OutfitLayer[]>(JSON.parse(outfit.layers_json));
    const [swipeStart, setSwipeStart] = useState<{ x: number; y: number; garmentId: string } | null>(null);

    const getGarmentById = (id: string) => {
        return allGarments.find((g) => g.id === id);
    };

    const rotateCategoryGarments = (category: GarmentCategory, direction: 'left' | 'right') => {
        const categoryLayers = layers.filter((layer) => {
            const garment = getGarmentById(layer.garment_id);
            return garment?.category === category;
        });

        if (categoryLayers.length <= 1) return;

        // Obtener posiciones y z-indexes actuales
        const currentPositions = categoryLayers.map((layer) => ({
            garment_id: layer.garment_id,
            position_x: layer.position_x,
            position_y: layer.position_y,
            z_index: layer.z_index,
        }));

        // Ordenar por posición x (de izquierda a derecha)
        const sortedPositions = [...currentPositions].sort((a, b) => a.position_x - b.position_x);

        // Extraer arrays de posiciones y z-indexes
        const positions = sortedPositions.map((p) => ({ x: p.position_x, y: p.position_y }));
        const zIndexes = sortedPositions.map((p) => p.z_index);

        // Rotar ambos arrays
        let rotatedPositions: typeof positions;
        let rotatedZIndexes: typeof zIndexes;

        if (direction === 'right') {
            rotatedPositions = [positions[positions.length - 1], ...positions.slice(0, -1)];
            rotatedZIndexes = [zIndexes[zIndexes.length - 1], ...zIndexes.slice(0, -1)];
        } else {
            rotatedPositions = [...positions.slice(1), positions[0]];
            rotatedZIndexes = [...zIndexes.slice(1), zIndexes[0]];
        }

        // Mapear nuevas posiciones
        const newPositions = sortedPositions.map((pos, index) => ({
            garment_id: pos.garment_id,
            newPosition: rotatedPositions[index],
            newZIndex: rotatedZIndexes[index],
        }));

        // Aplicar cambios
        const newLayers = layers.map((layer) => {
            const newPos = newPositions.find((p) => p.garment_id === layer.garment_id);
            if (newPos) {
                return {
                    ...layer,
                    position_x: newPos.newPosition.x,
                    position_y: newPos.newPosition.y,
                    z_index: newPos.newZIndex,
                };
            }
            return layer;
        });

        setLayers(newLayers);

        // Guardar cambios en la base de datos
        updateOutfit(outfit.id, newLayers);
    };

    // Touch/Mouse handlers
    const handleSwipeStart = (e: React.MouseEvent | React.TouchEvent, garmentId: string) => {
        e.stopPropagation();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setSwipeStart({ x: clientX, y: clientY, garmentId });
    };

    const handleSwipeEnd = (e: React.MouseEvent | React.TouchEvent) => {
        if (!swipeStart) return;

        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;

        const swipeDistanceX = clientX - swipeStart.x;
        const swipeDistanceY = Math.abs(clientY - swipeStart.y);
        const SWIPE_THRESHOLD = 50;

        if (Math.abs(swipeDistanceX) > SWIPE_THRESHOLD && swipeDistanceY < 30) {
            const garment = getGarmentById(swipeStart.garmentId);
            if (garment) {
                const direction = swipeDistanceX > 0 ? 'right' : 'left';
                rotateCategoryGarments(garment.category, direction);
            }
        }

        setSwipeStart(null);
    };

    return (
        <div className="flex-1 flex items-center justify-center bg-white relative overflow-hidden touch-none">
            {/* Edit Button - Top Right */}
            <button
                onClick={onEdit}
                className="absolute top-3 right-3 z-20 bg-black text-white pl-3 pr-4 py-2 rounded-full text-xs font-medium hover:bg-slate-800 transition-all shadow-lg flex items-center gap-1.5"
            >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
            </button>

            {/* Garment Count Badge - Top Left */}
            <div className="absolute top-3 left-3 z-20 bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-full text-xs font-medium">
                {layers.length} {layers.length === 1 ? 'prenda' : 'prendas'}
            </div>

            {/* Swipe Hint - Bottom Left */}
            <div className="absolute bottom-3 left-3 z-20 bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
                Desliza → o ← para rotar
            </div>

            {/* Outfit Layers - Full Screen */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative w-full h-full max-w-lg">
                    {layers
                        .sort((a, b) => a.z_index - b.z_index)
                        .map((layer) => {
                            const garment = getGarmentById(layer.garment_id);
                            if (!garment) return null;

                            return (
                                <div
                                    key={layer.garment_id}
                                    onMouseDown={(e) => handleSwipeStart(e, layer.garment_id)}
                                    onMouseUp={handleSwipeEnd}
                                    onTouchStart={(e) => handleSwipeStart(e, layer.garment_id)}
                                    onTouchEnd={handleSwipeEnd}
                                    className="absolute cursor-grab active:cursor-grabbing transition-all duration-300 ease-out"
                                    style={{
                                        left: `${layer.position_x}%`,
                                        top: `${layer.position_y}%`,
                                        transform: `translate(-50%, -50%) scale(${layer.scale * 1.6}) rotate(${layer.rotation}deg)`,
                                        zIndex: layer.z_index,
                                    }}
                                >
                                    <img
                                        src={garment.image_data}
                                        alt={garment.sub_category}
                                        className="w-48 h-48 object-contain drop-shadow-2xl select-none"
                                    />
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}
