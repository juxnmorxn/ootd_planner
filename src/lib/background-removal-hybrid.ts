/**
 * Eliminación de Fondo usando SOLO @imgly (Frontend)
 * - Sin dependencia en servidor Python
 * - Funciona completamente offline
 * - Tiempo: 10-30s (pero siempre disponible)
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
        onProgress?.('🧠 Removiendo fondo (esto puede tardar ~15-30 segundos)...');
        const result = await removeBackgroundFromImage(imageData);
        onProgress?.('✅ ¡Fondo removido!');
        return result;
    } catch (error) {
        console.error('[Background Removal] Error:', error);
        throw new Error(
            `No se pudo remover el fondo: ${error instanceof Error ? error.message : 'Error desconocido'}`
        );
    }
}
