import { removeBackground } from '@imgly/background-removal';

/**
 * Comprime y redimensiona una imagen para reducir su peso.
 *
 * - Limita el lado mayor a maxSize píxeles.
 * - Usa JPEG para que el parámetro quality tenga efecto.
 */
export async function compressImage(
    imageData: string,
    quality: number = 0.8,
    maxSize: number = 1024,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const maxSide = Math.max(img.width, img.height);
            const scale = maxSide > maxSize ? maxSize / maxSide : 1;

            const targetWidth = Math.round(img.width * scale);
            const targetHeight = Math.round(img.height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // JPEG respeta el parámetro quality y normalmente pesa mucho menos.
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
        };
        img.onerror = reject;
        img.src = imageData;
    });
}

/**
 * Remueve el fondo de una imagen usando IA (@imgly)
 * Optimizado para velocidad
 */
export async function removeBackgroundFromImage(imageData: string): Promise<string> {
    try {
        console.log('[AI] Starting background removal with @imgly...');
        const startTime = performance.now();

        // Comprimir imagen primero para acelerar procesamiento
        const compressed = await compressImage(imageData, 0.85, 768);

        const blob = await removeBackground(compressed, {
            model: 'isnet_quint8',  // Modelo ligero y rápido compatible con el tipo de la librería
            batch: true,            // Procesar en batch si hay GPU
            progress: (key, current, total) => {
                const percentage = Math.round((current / total) * 100);
                console.log(`[AI] ${key}: ${percentage}%`);
            },
        });

        const endTime = performance.now();
        console.log(`[AI] Background removal took: ${endTime - startTime}ms`);

        // Convertir blob a data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[AI] Background removal failed:', error);
        throw error;
    }
}
