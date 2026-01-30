import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, ChevronDown } from 'lucide-react';
import { useStore } from '../lib/store';
import { useOutfits } from '../hooks/useOutfits';
import { useGarments } from '../hooks/useGarments';
import { CategorySelector } from '../components/ui/CategorySelector';
import { GarmentCard } from '../components/closet/GarmentCard';
import { getCategoryInfo, getAllCategories, cn } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import type { OutfitLayer, GarmentCategory, Garment } from '../types';

interface OutfitEditorProps {
    date: string;
    outfitId?: string;
    onBack: () => void;
}

// Layout 70/30: 70% izquierda para prendas grandes, 30% derecha para accesorios y mochilas
const CATEGORY_SLOTS: Record<GarmentCategory, { x: number; y: number }[]> = {
    // Playeras/chamarras/abrigos: zona superior izquierda (70%)
    top: [
        { x: 35, y: 25 },
        { x: 37, y: 27 },
        { x: 33, y: 23 },
        { x: 35, y: 25 },
    ],
    // Pantalones: zona media-inferior izquierda (70%) - Aumentado para ser más rectangular
    bottom: [
        { x: 35, y: 66 },
        { x: 37, y: 68 },
        { x: 33, y: 64 },
        { x: 35, y: 66 },
    ],
    // Zapatos: Al final del lienzo, aprovechando el espacio blanco residual
    feet: [
        { x: 35, y: 96 },
        { x: 37, y: 98 },
    ],
    // Cabeza: Parte superior derecha
    head: [
        { x: 82, y: 15 },
        { x: 84, y: 17 },
    ],
    // Mochilas/bolsos: Parte inferior derecha
    bag: [
        { x: 82, y: 82 },
        { x: 84, y: 84 },
    ],
    // Accesorios: Centro derecha
    acc: [
        { x: 82, y: 48 },
        { x: 84, y: 50 },
    ],
};

// Rectángulos guía de fondo para visualizar el espacio máximo de cada categoría
const CATEGORY_GUIDES: Record<
    GarmentCategory,
    { left: number; top: number; width: number; height: number; color: string; label: string }
> = {
    top: {
        left: 4,
        top: 5, // Bajado para no tocar la barra de fecha
        width: 62,
        height: 40,
        color: 'rgba(191, 219, 254, 0.35)',
        label: 'TOP / PLAYERA',
    },
    bottom: {
        left: 4,
        top: 47,
        width: 62,
        height: 38, // Aumentado para más verticalidad
        color: 'rgba(209, 250, 229, 0.35)',
        label: 'BOTTOM / PANTALÓN',
    },
    feet: {
        left: 4,
        top: 85, // Pegado inmediatamente después de pantalones
        width: 62,
        height: 22, // Significativamente más alto para lucir mejor los tenis
        color: 'rgba(254, 249, 195, 0.35)',
        label: 'TENIS',
    },
    head: {
        left: 68,
        top: 2,
        width: 28,
        height: 26,
        color: 'rgba(254, 240, 138, 0.35)',
        label: 'GORRA',
    },
    acc: {
        left: 68,
        top: 30,
        width: 28,
        height: 36,
        color: 'rgba(252, 231, 243, 0.35)',
        label: 'ACC / ACCESORIOS',
    },
    bag: {
        left: 68,
        top: 68,
        width: 28,
        height: 28,
        color: 'rgba(221, 214, 254, 0.35)',
        label: 'BAG / MOCHILA',
    },
};

// Escalas base por categoría (1.0 para compatibilidad con outfits existentes)
const BASE_SCALE: Record<GarmentCategory, number> = {
    head: 1,
    top: 1,
    bottom: 1,
    feet: 1,
    acc: 1,
    bag: 1,
};

export function OutfitEditor({ date, outfitId: initialOutfitId, onBack }: OutfitEditorProps) {
    const currentUser = useStore((state) => state.currentUser);
    const { activeOutfit, setActiveOutfitLayers, addLayer, removeLayer, clearActiveOutfit } = useStore();
    const { createOutfit, updateOutfit, getOutfitByDate, getOutfitById, deleteOutfit } = useOutfits();
    const [outfitId, setOutfitId] = useState<string | null>(initialOutfitId || null);
    const [selectedCategory, setSelectedCategory] = useState<GarmentCategory | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [swipeStart, setSwipeStart] = useState<{ x: number; y: number; garmentId: string } | null>(null);
    const [smallMessage, setSmallMessage] = useState<string | null>(null);
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [showSubcategoryMenu, setShowSubcategoryMenu] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);
    const { garments: allGarments } = useGarments();
    const { showToast } = useToast();

    useEffect(() => {
        const loadOutfit = async () => {
            // Si viene un outfitId específico desde el calendario, cargar ese
            if (initialOutfitId) {
                const byId = await getOutfitById(initialOutfitId);
                if (byId) {
                    setOutfitId(byId.id);
                    const layers: OutfitLayer[] = JSON.parse(byId.layers_json);
                    setActiveOutfitLayers(layers);
                    return;
                }
            }

            // Si no hay id específico, usar la primera opción del día (si existe)
            const existing = await getOutfitByDate(date);
            if (existing) {
                setOutfitId(existing.id);
                const layers: OutfitLayer[] = JSON.parse(existing.layers_json);
                setActiveOutfitLayers(layers);
            } else {
                setOutfitId(null);
                setActiveOutfitLayers([]);
            }
        };

        loadOutfit();
        return () => clearActiveOutfit();
    }, [date, initialOutfitId]);

    const handleSave = async () => {
        try {
            if (outfitId) {
                await updateOutfit(outfitId, activeOutfit.layers);
            } else {
                const newOutfit = await createOutfit(date, activeOutfit.layers);
                setOutfitId(newOutfit.id);
            }
            showToast({ type: 'success', message: 'Outfit guardado correctamente' });
            onBack();
        } catch (error) {
            console.error('Failed to save outfit:', error);
            showToast({ type: 'error', message: 'Error al guardar el outfit' });
        }
    };

    const handleDelete = async () => {
        if (!outfitId) return;
        if (confirm('¿Eliminar este outfit?')) {
            await deleteOutfit(outfitId);
            clearActiveOutfit();
            showToast({ type: 'success', message: 'Outfit eliminado' });
            onBack();
        }
    };

    const getGarmentById = (id: string) => {
        return allGarments.find((g) => g.id === id);
    };

    const getNextSlotForCategory = (category: GarmentCategory): { x: number; y: number; slotIndex: number } | null => {
        const slots = CATEGORY_SLOTS[category];
        const categoryLayers = activeOutfit.layers.filter((layer) => {
            const garment = getGarmentById(layer.garment_id);
            return garment?.category === category;
        });

        for (let i = 0; i < slots.length; i++) {
            const isOccupied = categoryLayers.some(
                (layer) => layer.position_x === slots[i].x && layer.position_y === slots[i].y
            );
            if (!isOccupied) {
                return { ...slots[i], slotIndex: i };
            }
        }

        return null;
    };

    const handleAddGarment = (garment: Garment) => {
        // No permitir agregar la misma prenda más de una vez en el outfit
        const alreadyInOutfit = activeOutfit.layers.some((layer) => layer.garment_id === garment.id);
        if (alreadyInOutfit) {
            showToast({ type: 'info', message: 'Esta prenda ya está en este outfit.' });
            return;
        }

        const nextSlot = getNextSlotForCategory(garment.category);

        if (!nextSlot) {
            showToast({
                type: 'info',
                message: `No hay más espacio para ${garment.category}. Máximo ${CATEGORY_SLOTS[garment.category].length} prendas.`,
            });
            return;
        }

        const newLayer: OutfitLayer = {
            garment_id: garment.id,
            z_index: activeOutfit.layers.length + 1,
            position_x: nextSlot.x,
            position_y: nextSlot.y,
            scale: BASE_SCALE[garment.category] ?? 1,
            rotation: 0,
        };
        addLayer(newLayer);
    };

    const rotateCategoryGarments = (category: GarmentCategory, direction: 'left' | 'right') => {
        const categoryLayers = activeOutfit.layers.filter((layer) => {
            const garment = getGarmentById(layer.garment_id);
            return garment?.category === category;
        });

        if (categoryLayers.length <= 1) return;

        const slots = CATEGORY_SLOTS[category];

        // Obtener las posiciones actuales de cada prenda con su slot y z-index
        const currentPositions = categoryLayers.map((layer) => {
            const slotIndex = slots.findIndex((s) => s.x === layer.position_x && s.y === layer.position_y);
            return {
                garment_id: layer.garment_id,
                slotIndex: slotIndex >= 0 ? slotIndex : 0,
                slot: slotIndex >= 0 ? slots[slotIndex] : slots[0],
                z_index: layer.z_index,
            };
        });

        // Ordenar por slotIndex
        const sortedPositions = [...currentPositions].sort((a, b) => a.slotIndex - b.slotIndex);

        // Crear arrays de slots y z-indexes ocupados en orden
        const occupiedSlots = sortedPositions.map((p) => p.slot);
        const occupiedZIndexes = sortedPositions.map((p) => p.z_index);

        // Rotar ambos arrays
        let rotatedSlots: typeof occupiedSlots;
        let rotatedZIndexes: typeof occupiedZIndexes;

        if (direction === 'right') {
            // Mover el último al principio
            rotatedSlots = [occupiedSlots[occupiedSlots.length - 1], ...occupiedSlots.slice(0, -1)];
            rotatedZIndexes = [occupiedZIndexes[occupiedZIndexes.length - 1], ...occupiedZIndexes.slice(0, -1)];
        } else {
            // Mover el primero al final
            rotatedSlots = [...occupiedSlots.slice(1), occupiedSlots[0]];
            rotatedZIndexes = [...occupiedZIndexes.slice(1), occupiedZIndexes[0]];
        }

        // Mapear cada prenda a su nuevo slot y z-index
        const newPositions = sortedPositions.map((pos, index) => ({
            garment_id: pos.garment_id,
            newSlot: rotatedSlots[index],
            newZIndex: rotatedZIndexes[index],
        }));

        // Aplicar las nuevas posiciones y z-indexes
        const newLayers = activeOutfit.layers.map((layer) => {
            const newPos = newPositions.find((p) => p.garment_id === layer.garment_id);
            if (newPos && newPos.newSlot) {
                return {
                    ...layer,
                    position_x: newPos.newSlot.x,
                    position_y: newPos.newSlot.y,
                    z_index: newPos.newZIndex,
                };
            }
            return layer;
        });

        setActiveOutfitLayers(newLayers);
    };

    // Touch/Mouse handlers for swipe
    const handleSwipeStart = (clientX: number, clientY: number, garmentId: string) => {
        setSwipeStart({ x: clientX, y: clientY, garmentId });
    };

    const handleSwipeEnd = (clientX: number, clientY: number) => {
        if (!swipeStart) return;

        const swipeDistanceX = clientX - swipeStart.x;
        const swipeDistanceY = Math.abs(clientY - swipeStart.y);
        const SWIPE_THRESHOLD = 50;

        // Solo detectar swipe horizontal
        if (Math.abs(swipeDistanceX) > SWIPE_THRESHOLD && swipeDistanceY < 30) {
            const garment = getGarmentById(swipeStart.garmentId);
            if (garment) {
                const direction = swipeDistanceX > 0 ? 'right' : 'left';
                rotateCategoryGarments(garment.category, direction);
            }
        }

        setSwipeStart(null);
    };

    const handleMouseDown = (e: React.MouseEvent, garmentId: string) => {
        e.preventDefault();
        handleSwipeStart(e.clientX, e.clientY, garmentId);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        handleSwipeEnd(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent, garmentId: string) => {
        const touch = e.touches[0];
        handleSwipeStart(touch.clientX, touch.clientY, garmentId);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            handleSwipeEnd(touch.clientX, touch.clientY);
        }
    };

    // Filtrado
    const categoryGarments = selectedCategory
        ? allGarments.filter((g) => {
            if (g.category !== selectedCategory) return false;
            if (selectedSubCategory && selectedSubCategory !== 'all') {
                return g.sub_category === selectedSubCategory;
            }
            return true;
        })
        : [];

    const categoryInfo = selectedCategory ? getCategoryInfo(selectedCategory, currentUser || undefined) : null;
    const availableSubCategories = categoryInfo
        ? ['all', ...new Set(allGarments.filter((g) => g.category === selectedCategory).map((g) => g.sub_category))]
        : [];

    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top Bar */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-100 fade-in-down">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </button>

                    <h1 className="text-lg font-bold text-slate-900 capitalize">{formattedDate}</h1>

                    <div className="flex gap-2">
                        {outfitId && (
                            <>
                                <button
                                    onClick={async () => {
                                        try {
                                            const duplicated = await createOutfit(date, activeOutfit.layers);
                                            setOutfitId(duplicated.id);
                                            showToast({ type: 'success', message: 'Se creó una nueva opción para este día' });
                                        } catch (error) {
                                            console.error('Failed to duplicate outfit:', error);
                                            showToast({ type: 'error', message: 'No se pudo duplicar el outfit' });
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                                >
                                    Duplicar
                                </button>
                                <button onClick={handleDelete} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </button>
                            </>
                        )}
                        <button onClick={handleSave} className="px-4 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                            Guardar
                        </button>
                    </div>
                </div>
            </div>

            {/* Canvas Area - Fixed Slots with Swipe */}
            <div className="flex-1 relative overflow-hidden bg-white">
                <div
                    ref={canvasRef}
                    className="absolute inset-0 p-8 overflow-auto touch-none"
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="relative w-full aspect-[9/16] min-h-[650px]">
                        {/* Guías de categoría: rectángulos de fondo para ver el espacio máximo recomendado */}
                        {Object.entries(CATEGORY_GUIDES).map(([key, guide]) => (
                            <div
                                key={key}
                                className="absolute rounded-xl border border-dashed border-slate-300/60 flex items-center justify-center pointer-events-none select-none"
                                style={{
                                    left: `${guide.left}%`,
                                    top: `${guide.top}%`,
                                    width: `${guide.width}%`,
                                    height: `${guide.height}%`,
                                    transform: 'translate(0, 0)',
                                    backgroundColor: guide.color,
                                }}
                            >
                                <span className="text-[10px] font-semibold tracking-wide text-slate-600 text-center px-2">
                                    {guide.label}
                                </span>
                            </div>
                        ))}

                        {activeOutfit.layers
                            .sort((a, b) => a.z_index - b.z_index)
                            .map((layer) => {
                                const garment = getGarmentById(layer.garment_id);
                                if (!garment) return null;

                                return (
                                    <div
                                        key={layer.garment_id}
                                        onMouseDown={(e) => handleMouseDown(e, layer.garment_id)}
                                        onTouchStart={(e) => handleTouchStart(e, layer.garment_id)}
                                        className="absolute transition-all duration-300 ease-out cursor-grab active:cursor-grabbing scale-in-soft flex items-center justify-center overflow-hidden"
                                        style={{
                                            left: `${layer.position_x}%`,
                                            top: `${layer.position_y}%`,
                                            width: `${CATEGORY_GUIDES[garment.category].width}%`,
                                            height: `${CATEGORY_GUIDES[garment.category].height}%`,
                                            transform: `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
                                            zIndex: layer.z_index,
                                        }}
                                    >
                                        <div className="relative group w-full h-full p-2 flex items-center justify-center">
                                            <img
                                                src={garment.image_data}
                                                alt={garment.sub_category}
                                                className="max-w-full max-h-full object-contain drop-shadow-lg select-none"
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeLayer(layer.garment_id);
                                                }}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                        {/* Si no hay prendas, solo deja los espacios guía, sin mensaje ni ícono */}
                    </div>
                </div>
            </div>

            {/* Bottom Sheet */}
            <div className="bg-white border-t border-slate-200 safe-area-inset-bottom fade-in-up">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="space-y-4">
                        {/* Nivel 1: Categorías */}
                        {!selectedCategory && (
                            <>
                                <CategorySelector
                                    selected={null}
                                    onSelect={(cat) => {
                                        setSelectedCategory(cat);
                                        setSelectedSubCategory(null);
                                        setSmallMessage(null);
                                        setShowCategoryMenu(false);
                                        setShowSubcategoryMenu(false);
                                    }}
                                />
                                {smallMessage && (
                                    <p className="text-[11px] text-red-500 mt-1">{smallMessage}</p>
                                )}
                            </>
                        )}

                        {/* Nivel 2: Subcategorías dentro de una categoría */}
                        {selectedCategory && (!selectedSubCategory || selectedSubCategory === 'all') && (
                            <>
                                <div className="flex items-center justify-between mb-2">
                                    <button
                                        onClick={() => {
                                            setSelectedCategory(null);
                                            setSelectedSubCategory(null);
                                            setSmallMessage(null);
                                            setShowCategoryMenu(false);
                                            setShowSubcategoryMenu(false);
                                        }}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        Categorías
                                    </button>
                                    {categoryInfo && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCategoryMenu((prev) => !prev);
                                                setShowSubcategoryMenu(false);
                                            }}
                                            className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1"
                                        >
                                            {categoryInfo.label}
                                            <ChevronDown
                                                className={cn(
                                                    'w-3 h-3 transition-transform duration-150',
                                                    // Cerrado: flecha hacia arriba (rotate-180). Abierto: hacia abajo (rotate-0).
                                                    showCategoryMenu ? 'rotate-0' : 'rotate-180'
                                                )}
                                            />
                                        </button>
                                    )}
                                </div>

                                {/* Menú rápido de categorías (despliegue desde la etiqueta de la derecha) */}
                                {showCategoryMenu && (
                                    <div className="flex gap-2 overflow-x-auto pb-2 justify-end mt-1 w-full touch-pan-x fade-in-up">
                                        {getAllCategories().map((cat) => (
                                            <button
                                                key={cat.key}
                                                onClick={() => {
                                                    setSelectedCategory(cat.key as GarmentCategory);
                                                    setSelectedSubCategory(null);
                                                    setSmallMessage(null);
                                                    setShowCategoryMenu(false);
                                                    setShowSubcategoryMenu(false);
                                                }}
                                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                    selectedCategory === cat.key
                                                        ? 'bg-black text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {availableSubCategories.length > 1 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filtrar por tipo</p>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {availableSubCategories
                                                .filter((sub) => sub !== 'all')
                                                .map((sub) => (
                                                    <button
                                                        key={sub}
                                                        onClick={() => {
                                                            setSelectedSubCategory(sub);
                                                            setSmallMessage(null);
                                                        }}
                                                        className={`
                              flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                              ${selectedSubCategory === sub
                                                                ? 'bg-black text-white'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            }
                            `}
                                                    >
                                                        {sub}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Nivel 3: Prendas dentro de una subcategoría */}
                        {selectedCategory && selectedSubCategory && selectedSubCategory !== 'all' && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <button
                                        onClick={() => {
                                            setSelectedSubCategory(null);
                                            setSmallMessage(null);
                                            setShowSubcategoryMenu(false);
                                        }}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        Subcategorías
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowSubcategoryMenu((prev) => !prev);
                                            setShowCategoryMenu(false);
                                        }}
                                        className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                                    >
                                        {selectedSubCategory}
                                        <ChevronDown
                                            className={cn(
                                                'w-3 h-3 transition-transform duration-150',
                                                showSubcategoryMenu ? 'rotate-0' : 'rotate-180'
                                            )}
                                        />
                                    </button>
                                </div>

                                {/* Menú rápido de subcategorías desde la etiqueta de la derecha */}
                                {showSubcategoryMenu && (
                                    <div className="flex gap-2 overflow-x-auto pb-2 justify-end mt-1 w-full touch-pan-x fade-in-up">
                                        {availableSubCategories
                                            .filter((sub) => sub !== 'all')
                                            .map((sub) => (
                                                <button
                                                    key={sub}
                                                    onClick={() => {
                                                        setSelectedSubCategory(sub);
                                                        setSmallMessage(null);
                                                        setShowSubcategoryMenu(false);
                                                    }}
                                                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                        selectedSubCategory === sub
                                                            ? 'bg-black text-white'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {sub}
                                                </button>
                                            ))}
                                    </div>
                                )}

                                <p className="text-sm font-semibold text-slate-700 mb-3">Selecciona una prenda</p>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {categoryGarments.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                            No hay prendas de tipo "{selectedSubCategory}"
                                        </p>
                                    ) : (
                                        categoryGarments.map((garment) => (
                                            <div key={garment.id} className="flex-shrink-0">
                                                <GarmentCard garment={garment} size="sm" onClick={() => handleAddGarment(garment)} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
