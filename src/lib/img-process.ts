import { removeBackground } from '@imgly/background-removal';

/**
 * Comprime una imagen reduciendo su calidad
 */
export async function compressImage(imageData: string, quality: number = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0);
            const compressed = canvas.toDataURL('image/png', quality);
            resolve(compressed);
        };
        img.onerror = reject;
        img.src = imageData;
    });
}

/**
 * Remueve el fondo de una imagen usando IA
 */
export async function removeBackgroundFromImage(imageData: string): Promise<string> {
    try {
        console.log('[AI] Starting background removal...');
        const startTime = performance.now();

        const blob = await removeBackground(imageData, {
            progress: (key, current, total) => {
                const percentage = Math.round((current / total) * 100);
                console.log(`[AI] ${key}: ${percentage}%`);
            },
        });

        const endTime = performance.now();
        console.log(`Background Removal: ${endTime - startTime} ms`);

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
