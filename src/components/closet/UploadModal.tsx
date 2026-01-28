import { useState, useRef } from 'react';
import { X, Camera, Upload, Loader, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../lib/store';
import { useGarments } from '../../hooks/useGarments';
import { compressImage, removeBackgroundFromImage } from '../../lib/img-process';
import { getCategoryInfo } from '../../lib/utils';
import type { GarmentCategory } from '../../types';

interface UploadModalProps {
    category: GarmentCategory;
    onClose: () => void;
}

export function UploadModal({ category, onClose }: UploadModalProps) {
    const currentUser = useStore((state) => state.currentUser);
    const { addGarment } = useGarments(category);
    const [imageData, setImageData] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [useAI, setUseAI] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const categoryInfo = getCategoryInfo(category);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setLoadingText('Procesando imagen...');

        try {
            // Convertir File a DataURL primero
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            if (useAI) {
                setLoadingText('Eliminando fondo con IA...');
                const processed = await removeBackgroundFromImage(dataUrl);
                setImageData(processed);
            } else {
                const compressed = await compressImage(dataUrl);
                setImageData(compressed);
            }
        } catch (error) {
            console.error('Failed to process image:', error);
            alert('Error al procesar la imagen: ' + (error instanceof Error ? error.message : 'Desconocido'));
        } finally {
            setLoading(false);
            setLoadingText('');
        }
    };

    const handleSave = async () => {
        if (!imageData || !selectedSubCategory || !currentUser) return;

        setLoading(true);
        setLoadingText('Guardando...');

        try {
            await addGarment({
                id: uuidv4(),
                user_id: currentUser.id,
                image_data: imageData,
                category,
                sub_category: selectedSubCategory,
            });

            onClose();
        } catch (error) {
            console.error('Failed to save garment:', error);
            alert('Error al guardar la prenda');
        } finally {
            setLoading(false);
            setLoadingText('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <h2 className="text-xl font-bold text-slate-900">
                        Agregar {categoryInfo.label}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!imageData ? (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <div className="space-y-4">
                                {/* AI Toggle */}
                                <div
                                    onClick={() => setUseAI(!useAI)}
                                    className={`
                    flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                    ${useAI ? 'border-black bg-slate-50' : 'border-slate-100'}
                  `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${useAI ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">Eliminar fondo con IA</p>
                                            <p className="text-xs text-slate-500">
                                                {useAI ? 'Activado (puede tardar unos segundos)' : 'Desactivado (más rápido)'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${useAI ? 'border-black' : 'border-slate-300'}`}>
                                        {useAI && <div className="w-3 h-3 bg-black rounded-full" />}
                                    </div>
                                </div>

                                {/* Upload Area */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                    className="w-full aspect-square border-2 border-dashed border-slate-300 rounded-2xl hover:border-black transition-colors flex flex-col items-center justify-center gap-3 bg-slate-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="w-12 h-12 text-black animate-spin" />
                                            <p className="text-sm text-slate-600 font-medium">{loadingText}</p>
                                            <p className="text-xs text-slate-400">Esto corre 100% en tu dispositivo</p>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-12 h-12 text-slate-400" />
                                            <div className="text-center px-4">
                                                <p className="text-sm font-medium text-slate-700">
                                                    Seleccionar de galería
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    PNG, JPG hasta 10MB
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </button>

                                {/* Camera Button */}
                                <button
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.setAttribute('capture', 'environment');
                                            fileInputRef.current.click();
                                        }
                                    }}
                                    disabled={loading}
                                    className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Camera className="w-5 h-5" />
                                    Tomar Foto
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Image Preview */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Vista Previa</span>
                                    {useAI && (
                                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                                            <Sparkles className="w-3 h-3" /> Fondo eliminado
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center p-8 relative overflow-hidden ring-1 ring-slate-100"
                                    style={{
                                        backgroundImage: 'repeating-conic-gradient(#f8fafc 0% 25%, #e2e8f0 0% 50%)',
                                        backgroundSize: '20px 20px',
                                    }}
                                >
                                    <img
                                        src={imageData}
                                        alt="Preview"
                                        className="max-w-full max-h-full object-contain relative z-10 drop-shadow-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setImageData(null);
                                        setSelectedSubCategory('');
                                    }}
                                    className="mt-3 text-sm text-slate-600 hover:text-black transition-colors w-full text-center py-2 hover:bg-slate-50 rounded-lg"
                                >
                                    ← Intentar con otra foto
                                </button>
                            </div>

                            {/* Sub-category Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-3">
                                    ¿Qué tipo de {categoryInfo.label.toLowerCase()} es?
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {categoryInfo.subCategories.map((sub) => (
                                        <button
                                            key={sub}
                                            onClick={() => setSelectedSubCategory(sub)}
                                            className={`
                        px-4 py-3 rounded-xl text-sm font-medium transition-all border-2
                        ${selectedSubCategory === sub
                                                    ? 'bg-black text-white border-black shadow-lg shadow-black/10'
                                                    : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'
                                                }
                      `}
                                        >
                                            {sub}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={!selectedSubCategory || loading}
                                className={`
                  w-full py-4 rounded-xl font-bold text-lg transition-all
                  ${!selectedSubCategory || loading
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-black text-white hover:bg-slate-800 shadow-xl shadow-black/20 active:scale-[0.98]'
                                    }
                `}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader className="w-5 h-5 animate-spin" />
                                        {loadingText}
                                    </span>
                                ) : (
                                    'Guardar en Clóset'
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
