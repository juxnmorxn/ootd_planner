import { removeBackground } from '@imgly/background-removal';

/**
 * Estrategia Hybrid de Eliminación de Fondo:
 * - Si hay conexión: Usa REMBG Backend (rápido, ~1-2s)
 * - Si NO hay conexión: Fallback a @imgly local (lento, ~5-8s, offline)
 * 
 * @param imageData - Base64 data URL de la imagen
 * @param onProgress - Callback para mostrar progreso
 * @returns PNG transparente como data URL
 */
export async function removeBackgroundHybrid(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    const isOnline = navigator.onLine;
    
    if (isOnline) {
        try {
            onProgress?.('🌐 Enviando a servidor... (~1-2s)');
            return await removeBackgroundViaServer(imageData, onProgress);
        } catch (error) {
            console.warn('[Hybrid] REMBG Backend falló, fallback a local IA:', error);
            onProgress?.('⚠️ Servidor no disponible, usando IA local... (~5-8s)');
            return await removeBackgroundLocal(imageData, onProgress);
        }
    } else {
        onProgress?.('📱 Modo offline: IA local... (~5-8s, ~40MB primera vez)');
        return await removeBackgroundLocal(imageData, onProgress);
    }
}

/**
 * Elimina fondo usando REMBG Backend (servidor)
 * Rápido y sin usar recursos del dispositivo
 */
async function removeBackgroundViaServer(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    try {
        onProgress?.('⏳ Procesando en servidor...');
        
        const response = await fetch('/api/remove-background', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageData,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en servidor');
        }

        const data = await response.json();
        onProgress?.('✅ ¡Fondo removido!');
        return data.imageData;
    } catch (error) {
        console.error('[Backend] Background removal error:', error);
        throw error;
    }
}

/**
 * Elimina fondo usando @imgly local (100% offline)
 * Lento pero funciona sin conexión
 */
async function removeBackgroundLocal(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    try {
        onProgress?.('📥 Descargando modelos IA (~40MB)...');
        
        const blob = await removeBackground(imageData, {
            progress: (key: string, current: number, total: number) => {
                const percentage = Math.round((current / total) * 100);
                onProgress?.(`🤖 Procesando: ${key} (${percentage}%)`);
            },
        });

        onProgress?.('🔄 Finalizando...');
        
        // Convertir blob a data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[Local IA] Background removal failed:', error);
        throw error;
    }
}
