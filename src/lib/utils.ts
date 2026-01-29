import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CategoryInfo, GarmentCategory, CustomSubcategories, User } from '../types';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Parse ISO date string to Date object
 */
export function parseISODate(dateString: string): Date {
    return new Date(dateString);
}

/**
 * Get category metadata for UI
 */
export const CATEGORY_INFO: Record<GarmentCategory, CategoryInfo> = {
    head: {
        key: 'head',
        label: 'Cabeza',
        icon: '🧢',
        subCategories: [
            'Gorra',
            'Sombrero',
            'Beanie / gorro de lana',
            'Bucket hat',
            'Bandana / pañoleta',
            'Otro',
        ],
    },
    top: {
        key: 'top',
        label: 'Parte de arriba',
        icon: '👕',
        subCategories: [
            'Playera',
            'Playera sin mangas',
            'Camisa manga corta',
            'Camisa manga larga',
            'Blusa',
            'Sudadera',
            'Chamarra',
            'Abrigo',
            'Saco / blazer',
            'Top',
            'Crop top',
            'Otro',
        ],
    },
    bottom: {
        key: 'bottom',
        label: 'Parte de abajo',
        icon: '👖',
        subCategories: [
            'Jeans',
            'Pantalón',
            'Pantalón de vestir',
            'Jogger',
            'Pants deportivos',
            'Pantalón cargo',
            'Short',
            'Falda corta',
            'Falda larga',
            'Leggings',
            'Biker shorts',
            'Otro',
        ],
    },
    feet: {
        key: 'feet',
        label: 'Calzado',
        icon: '👟',
        subCategories: [
            'Tenis',
            'Tenis para correr',
            'Tenis blancos',
            'Zapatos',
            'Mocasines',
            'Botines',
            'Botas largas',
            'Botas de lluvia',
            'Sandalias',
            'Chanclas',
            'Tacones',
            'Plataformas',
            'Huaraches',
            'Otro',
        ],
    },
    acc: {
        key: 'acc',
        label: 'Accesorios',
        icon: '💍',
        subCategories: [
            'Aretes',
            'Collar',
            'Pulsera',
            'Anillo',
            'Lentes de sol',
            'Cinturón',
            'Bufanda',
            'Pashmina',
            'Guantes',
            'Gorra',
            'Otro',
        ],
    },
    bag: {
        key: 'bag',
        label: 'Bolsas y mochilas',
        icon: '🎒',
        subCategories: [
            'Mochila',
            'Mochila chica',
            'Mochila grande',
            'Bolsa',
            'Bolsa cruzada',
            'Clutch',
            'Tote bag',
            'Cangurera',
            'Maletín',
            'Gym bag',
            'Otro',
        ],
    },
};

/**
 * Get all categories as array
 */
export function getAllCategories(): CategoryInfo[] {
    return Object.values(CATEGORY_INFO);
}

/**
 * Get category info by key with custom subcategories merged
 */
export function getCategoryInfo(category: GarmentCategory, user?: User): CategoryInfo {
    const baseInfo = CATEGORY_INFO[category] || {
        key: 'top',
        label: 'Prenda',
        icon: '👔',
        subCategories: []
    };

    // If no user or no custom subcategories, return base
    if (!user?.custom_subcategories) {
        return baseInfo;
    }

    try {
        const customSubs: CustomSubcategories = JSON.parse(user.custom_subcategories);
        const userSubs = customSubs[category] || [];

        // Merge custom subcategories (excluding "Otro" from base, add custom, then add "Otro" at end)
        const baseSubs = baseInfo.subCategories.filter(s => s !== 'Otro');
        const allSubs = [...baseSubs, ...userSubs, 'Otro'];

        return {
            ...baseInfo,
            subCategories: allSubs
        };
    } catch {
        return baseInfo;
    }
}

/**
 * Add a custom subcategory for a user
 */
export function addCustomSubcategory(
    user: User,
    category: GarmentCategory,
    subcategory: string
): CustomSubcategories {
    let customSubs: CustomSubcategories = {};

    if (user.custom_subcategories) {
        try {
            customSubs = JSON.parse(user.custom_subcategories);
        } catch {
            customSubs = {};
        }
    }

    // Initialize category array if doesn't exist
    if (!customSubs[category]) {
        customSubs[category] = [];
    }

    // Add if not already exists
    if (!customSubs[category]!.includes(subcategory)) {
        customSubs[category]!.push(subcategory);
    }

    return customSubs;
}

/**
 * Generate a simple hash for PIN (NOT cryptographically secure)
 * For production, use a proper hashing library
 */
export async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify PIN against hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
    const pinHash = await hashPin(pin);
    return pinHash === hash;
}
