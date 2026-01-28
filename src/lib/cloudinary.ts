import { v2 as cloudinary } from 'cloudinary';

// Configuración de Cloudinary
cloudinary.config({
    cloud_name: 'dogl9tho3',
    api_key: '637587472785454',
    api_secret: 'cAi5Slb_lBoqNBqKWtIy2uURaRo',
});

/**
 * Sube una imagen a Cloudinary
 * @param imageData - Base64 data URL de la imagen
 * @param userId - ID del usuario (para organizar en carpetas)
 * @param garmentId - ID de la prenda
 * @returns URL pública de la imagen subida
 */
export async function uploadImageToCloudinary(
    imageData: string,
    userId: string,
    garmentId: string
): Promise<string> {
    try {
        const result = await cloudinary.uploader.upload(imageData, {
            folder: `outfit-planner/${userId}/garments`,
            public_id: garmentId,
            upload_preset: 'oodt_123',
            overwrite: true,
            resource_type: 'image',
        });

        return result.secure_url;
    } catch (error) {
        console.error('[Cloudinary] Upload error:', error);
        throw new Error('Failed to upload image to Cloudinary');
    }
}

/**
 * Elimina una imagen de Cloudinary
 * @param userId - ID del usuario
 * @param garmentId - ID de la prenda
 */
export async function deleteImageFromCloudinary(userId: string, garmentId: string): Promise<void> {
    try {
        await cloudinary.uploader.destroy(`outfit-planner/${userId}/garments/${garmentId}`);
    } catch (error) {
        console.error('[Cloudinary] Delete error:', error);
        // No lanzar error, solo logear
    }
}

/**
 * Obtiene la URL optimizada de una imagen
 * @param publicId - Public ID de la imagen en Cloudinary
 * @param width - Ancho deseado (opcional)
 * @returns URL optimizada
 */
export function getOptimizedImageUrl(publicId: string, width?: number): string {
    return cloudinary.url(publicId, {
        width: width || 800,
        quality: 'auto',
        fetch_format: 'auto',
    });
}
