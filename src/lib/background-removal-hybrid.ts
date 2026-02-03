import { removeBackground } from '@imgly/background-removal';

/**
 * Eliminación de Fondo Offline para PWA:
 * - Usa @imgly local (~5-8s)
 * - Funciona completamente offline
 * - Primera vez descarga ~40MB de modelos
 * - Posteriores usos son más rápidos (caché)
 * 
 * @param imageData - Base64 data URL de la imagen
 * @param onProgress - Callback para mostrar progreso
 * @returns PNG transparente como data URL
 */
export async function removeBackgroundHybrid(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    onProgress?.('⏳ Preparando IA local...');
    return await removeBackgroundLocal(imageData, onProgress);
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
        onProgress?.('📥 Descargando modelos (~40MB primera vez)...');
        
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
