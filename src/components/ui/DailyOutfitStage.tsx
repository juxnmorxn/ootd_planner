import { useEffect, useState } from 'react';
import { Plus, Edit3 } from 'lucide-react';
import { useOutfits } from '../../hooks/useOutfits';
import { useGarments } from '../../hooks/useGarments';
import type { OutfitLayer, Outfit, GarmentCategory } from '../../types';

interface DailyOutfitStageProps {
    selectedDate: string;
    onEditOutfit: (outfitId?: string) => void;
}

export function DailyOutfitStage({ selectedDate, onEditOutfit }: DailyOutfitStageProps) {
    const { getOutfitOptionsByDate } = useOutfits();
    const { garments: allGarments } = useGarments();
    const [options, setOptions] = useState<Outfit[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOptions = async () => {
            setLoading(true);
            try {
                const data = await getOutfitOptionsByDate(selectedDate);
                setOptions(data);
                setCurrentIndex(0);
            } catch (error) {
                console.error('Failed to load outfits:', error);
            } finally {
                setLoading(false);
            }
        };

        loadOptions();
    }, [selectedDate]);

    if (loading) {
        return (
            <div
                className="flex-1 flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
                <div
                    className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent"
                    style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
                ></div>
            </div>
        );
    }

    if (options.length === 0) {
        return <EmptyStatePlaceholder onCreateOutfit={() => onEditOutfit(undefined)} />;
    }

    const currentOutfit = options[Math.min(currentIndex, options.length - 1)];

    return (
        <OutfitDisplay
            outfit={currentOutfit}
            totalOptions={options.length}
            allGarments={allGarments}
            onEdit={() => onEditOutfit(currentOutfit.id)}
            onSelectOption={(index) => setCurrentIndex(index)}
            currentIndex={currentIndex}
        />
    );
}

// Empty State Component
function EmptyStatePlaceholder({ onCreateOutfit }: { onCreateOutfit: () => void }) {
    return (
        <button
            onClick={onCreateOutfit}
            className="w-full min-h-[400px] flex items-center justify-center touch-manipulation group"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
            {/* CTA */}
            <div className="text-center px-8 py-12">
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:shadow-md transition-shadow border-2"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                    <Plus className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Sin outfit planeado
                </h3>
                <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                    Toca para armar tu look del día
                </p>
            </div>
        </button>
    );
}

// Outfit Display Component with Swipe
function OutfitDisplay({
    outfit,
    totalOptions,
    allGarments,
    onEdit,
    onSelectOption,
    currentIndex,
}: {
    outfit: Outfit;
    totalOptions: number;
    allGarments: any[];
    onEdit: () => void;
    onSelectOption: (index: number) => void;
    currentIndex: number;
}) {
    const { updateOutfit } = useOutfits();
    const [layers, setLayers] = useState<OutfitLayer[]>(() => JSON.parse(outfit.layers_json));

    // Sincronizar las capas cuando cambiamos de opción o se recarga desde el servidor
    useEffect(() => {
        setLayers(JSON.parse(outfit.layers_json));
    }, [outfit.id, outfit.layers_json]);
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
        <div
            className="flex-1 flex items-center justify-center relative overflow-hidden touch-none"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
            {/* Edit Button - Top Right */}
            <button
                onClick={onEdit}
                className="absolute top-3 right-3 z-20 pl-3 pr-4 py-2 rounded-full text-xs font-medium transition-all shadow-lg flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
            >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
            </button>

            {/* Garment Count Badge - Top Left */}
            <div className="absolute top-3 left-3 z-20 bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-full text-xs font-medium">
                {layers.length} {layers.length === 1 ? 'prenda' : 'prendas'}
            </div>

            {/* Option Tabs - Top Center Below Edit Button */}
            {totalOptions > 1 && (
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
                    {Array.from({ length: totalOptions }).map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectOption(index);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all backdrop-blur-sm ${
                                index === currentIndex
                                    ? 'bg-black text-white shadow-lg'
                                    : 'bg-black/50 text-white/70 hover:bg-black/60 hover:text-white'
                            }`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            )}

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
