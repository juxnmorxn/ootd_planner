// Database Models
export interface User {
    id: string; // UUID
    email: string; // Email es obligatorio para autenticación y sync
    username?: string; // Opcional: se puede derivar del email
    role?: 'admin' | 'user'; // Rol de usuario para permisos
    password_hash?: string; // Nunca se expone al cliente en respuestas de auth
    profile_pic?: string; // Base64 o URL
    custom_subcategories?: string; // JSON string de CustomSubcategories
    created_at?: string;
    updated_at?: string;
}

// Custom subcategories per category
export interface CustomSubcategories {
    head?: string[];
    top?: string[];
    bottom?: string[];
    feet?: string[];
    acc?: string[];
    bag?: string[];
}

export type GarmentCategory = 'head' | 'top' | 'bottom' | 'feet' | 'acc' | 'bag';

export interface Garment {
    id: string; // UUID
    user_id: string; // UUID - CHANGED from number
    image_data: string; // Base64 string
    category: GarmentCategory;
    sub_category: string; // e.g., 'Playera', 'Jeans', 'Gorra'
    created_at: string;
}

export interface Outfit {
    id: string; // UUID
    user_id: string; // UUID - CHANGED from number
    date_scheduled: string; // ISO format 'YYYY-MM-DD'
    layers_json: string; // JSON string of OutfitLayer[]
}

// JSON Structure for layers_json
export interface OutfitLayer {
    garment_id: string; // FK to garments table
    z_index: number; // Stacking order (1, 2, 3...)
    position_x: number; // Relative coordinate in canvas %
    position_y: number; // Relative coordinate in canvas %
    scale: number; // Zoom of the garment (e.g., 1.0, 1.2)
    rotation: number; // Degrees
}

// Parsed Outfit with layers
export interface OutfitWithLayers extends Omit<Outfit, 'layers_json'> {
    layers: OutfitLayer[];
}

// Category metadata for UI
export interface CategoryInfo {
    key: GarmentCategory;
    label: string;
    icon: string;
    subCategories: string[];
}

// Auth types
export interface LoginCredentials {
    username: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    username?: string;
}

export interface AuthSession {
    userId: string;
    username: string;
    expiresAt?: string; // For future token-based auth
}
