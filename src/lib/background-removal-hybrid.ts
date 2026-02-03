/**
 * Eliminación de Fondo usando REMBG Backend (servidor Python)
 * Rápido (~1-2s) y muy eficiente
 * 
 * @param imageData - Base64 data URL de la imagen
 * @param onProgress - Callback para mostrar progreso
 * @returns PNG transparente como data URL
 */
import { removeBackgroundFromImage } from './img-process';

export async function removeBackgroundHybrid(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    try {
        onProgress?.('✨ Removiendo fondo...');
        return await removeBackgroundViaRembg(imageData, onProgress);
    } catch (error) {
        console.warn('[Background Removal] REMBG falló; usando fallback local (@imgly).', error);
        onProgress?.('🧠 Fallback local (puede tardar)...');
        return await removeBackgroundFromImage(imageData);
    }
}

/**
 * Elimina fondo usando REMBG Backend (servidor Python)
 * Mucho más rápido que @imgly: ~1-2 segundos
 * Requiere: Python + rembg instalado en servidor
 */
async function removeBackgroundViaRembg(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    try {
        onProgress?.('⏳ Procesando con servidor...');
        
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
            throw new Error(error.error || 'Error en servidor REMBG');
        }

        const data = await response.json();
        onProgress?.('✅ ¡Fondo removido!');
        return data.imageData;
    } catch (error) {
        console.error('[REMBG] Background removal error:', error);
        throw new Error(`No se pudo remover el fondo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}
