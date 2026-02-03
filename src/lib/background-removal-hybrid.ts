/**
 * Eliminación de Fondo usando REMBG Backend (servidor)
 * Rápido (~1-2s) y funciona en PWA
 * 
 * @param imageData - Base64 data URL de la imagen
 * @param onProgress - Callback para mostrar progreso
 * @returns PNG transparente como data URL
 */
export async function removeBackgroundHybrid(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    try {
        onProgress?.('🌐 Enviando a servidor... (~1-2s)');
        return await removeBackgroundViaServer(imageData, onProgress);
    } catch (error) {
        console.error('[Background Removal] Error:', error);
        throw error;
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
        onProgress?.('⏳ Procesando...');
        
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
