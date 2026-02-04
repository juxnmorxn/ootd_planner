import { useState, useRef } from 'react';
import { X, Camera, Upload, Loader, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../lib/store';
import { useGarments } from '../../hooks/useGarments';
import { compressImage } from '../../lib/img-process';
import { removeBackgroundHybrid } from '../../lib/background-removal-hybrid';
import { getCategoryInfo } from '../../lib/utils';
import type { GarmentCategory } from '../../types';
import { useToast } from '../ui/Toast';

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
    const { showToast } = useToast();

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
                // 1) Comprimir/redimensionar para que el modelo procese menos píxeles
                setLoadingText('✨ Optimizando...');
                const smaller = await compressImage(dataUrl, 0.8);

                // 2) Usar estrategia HYBRID: REMBG Backend si hay internet, fallback a @imgly local
                const processed = await removeBackgroundHybrid(smaller, (msg) => {
                    setLoadingText(msg);
                });
                setImageData(processed);
            } else {
                const compressed = await compressImage(dataUrl);
                setImageData(compressed);
            }
        } catch (error) {
            console.error('Failed to process image:', error);
            showToast({
                type: 'error',
                message: 'Error al procesar la imagen: ' + (error instanceof Error ? error.message : 'Desconocido'),
            });
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
            showToast({
                type: 'success',
                message: 'Prenda guardada en tu clóset',
            });
            onClose();
        } catch (error) {
            console.error('Failed to save garment:', error);
            showToast({
                type: 'error',
                message: 'Error al guardar la prenda',
            });
        } finally {
            setLoading(false);
            setLoadingText('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className="rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[calc(100vh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto flex flex-col safe-area-inset-top safe-area-inset-bottom border"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            >
                {/* Header */}
                <div
                    className="sticky top-0 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10 flex-shrink-0 border-b"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Agregar {categoryInfo.label}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
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
                                {/* AI Toggle - REMBG (Muy rápido) */}
                                <div
                                    onClick={() => setUseAI(!useAI)}
                                    className="flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer"
                                    style={{
                                        borderColor: useAI ? 'var(--accent-primary)' : 'var(--border-primary)',
                                        backgroundColor: useAI ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2 rounded-lg"
                                            style={{
                                                backgroundColor: useAI ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                color: useAI ? 'var(--btn-primary-text)' : 'var(--text-tertiary)',
                                            }}
                                        >
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Eliminar fondo con IA</p>
                                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                {useAI ? '⚡ Activado (~1-2s)' : 'Desactivado'}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                                        style={{ borderColor: useAI ? 'var(--accent-primary)' : 'var(--border-primary)' }}
                                    >
                                        {useAI && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />}
                                    </div>
                                </div>

                                {/* Upload Area */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                    className="w-full aspect-square border-2 border-dashed rounded-2xl transition-colors flex flex-col items-center justify-center gap-3"
                                    style={{
                                        borderColor: 'var(--border-primary)',
                                        backgroundColor: 'var(--bg-primary)',
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="w-12 h-12 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{loadingText}</p>
                                            {useAI && (
                                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                    Usando REMBG (servidor Python)
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-12 h-12" style={{ color: 'var(--text-tertiary)' }} />
                                            <div className="text-center px-4">
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                    Seleccionar de galería
                                                </p>
                                                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
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
                                    className="w-full px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: 'var(--bg-primary)',
                                        color: 'var(--text-secondary)',
                                    }}
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
                                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                        Vista Previa
                                    </span>
                                    {useAI && (
                                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                                            <Sparkles className="w-3 h-3" /> Fondo eliminado
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="w-40 h-40 rounded-2xl flex items-center justify-center relative overflow-hidden ring-1"
                                    style={{
                                        backgroundColor: 'var(--bg-primary)',
                                        borderColor: 'var(--border-primary)',
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
                                    className="mt-3 text-sm transition-colors w-full text-center py-2 rounded-lg"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    ← Intentar con otra foto
                                </button>
                            </div>

                            {/* Sub-category Selection */}
                            <div className="mb-6">
                                <label className="block text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                                    ¿Qué tipo de {categoryInfo.label.toLowerCase()} es?
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {categoryInfo.subCategories.map((sub) => (
                                        <button
                                            key={sub}
                                            onClick={() => setSelectedSubCategory(sub)}
                                            className="px-4 py-3 rounded-xl text-base font-semibold transition-all border-2"
                                            style={{
                                                backgroundColor:
                                                    selectedSubCategory === sub ? 'var(--btn-primary-bg)' : 'var(--bg-secondary)',
                                                color:
                                                    selectedSubCategory === sub
                                                        ? 'var(--btn-primary-text)'
                                                        : 'var(--text-secondary)',
                                                borderColor:
                                                    selectedSubCategory === sub
                                                        ? 'var(--btn-primary-bg)'
                                                        : 'var(--border-primary)',
                                            }}
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
                                className="w-full py-4 rounded-xl font-bold text-lg transition-all"
                                style={{
                                    backgroundColor: !selectedSubCategory || loading ? 'var(--bg-secondary)' : 'var(--btn-primary-bg)',
                                    color: !selectedSubCategory || loading ? 'var(--text-tertiary)' : 'var(--btn-primary-text)',
                                    cursor: !selectedSubCategory || loading ? 'not-allowed' : 'pointer',
                                    opacity: !selectedSubCategory || loading ? 0.6 : 1,
                                }}
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
