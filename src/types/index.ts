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
    loginTimestamp?: number; // Timestamp en ms cuando se inició sesión (para logout 2 meses)
    lastSyncTimestamp?: number; // Timestamp en ms del último sync exitoso (para garantizar sync diario)
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
    image_data: string; // Base64 string (temporal offline) o URL Cloudinary
    category: GarmentCategory;
    sub_category: string; // e.g., 'Playera', 'Jeans', 'Gorra'
    created_at: string;
    pending_upload?: boolean; // True si imagen offline no está aún en Cloudinary
}

export interface Outfit {
    id: string; // UUID
    user_id: string; // UUID - CHANGED from number
    date_scheduled: string; // ISO format 'YYYY-MM-DD'
    // Número de opción dentro de ese día (1, 2, 3, ...)
    option_index?: number;
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

// ============ CHAT & MESSAGING ============

export interface Contact {
    id: string;
    user_id: string;
    contact_id: string;
    status: 'pendiente' | 'aceptado' | 'rechazado' | 'bloqueado';
    created_at: string;
    updated_at: string;
}

export interface Conversation {
    id: string;
    user_id_1: string;
    user_id_2: string;
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'image' | 'file';
    read: boolean;
    created_at: string;
}

export interface MessageWithSender extends Message {
    sender?: Pick<User, 'id' | 'username' | 'profile_pic'>;
    // Estado de entrega local (para UI):
    //  - pending: todavía enviando
    //  - sent: guardado/enviado
    //  - delivered: llegó al otro usuario (no siempre disponible)
    //  - read: el otro usuario lo abrió
    delivery_status?: 'pending' | 'sent' | 'delivered' | 'read';
    // ID temporal generado en el cliente para casar mensajes optimistas
    // con la confirmación del servidor (message:sent)
    client_id?: string;
}

export interface ConversationWithData extends Conversation {
    other_user?: Pick<User, 'id' | 'username' | 'profile_pic'>;
    last_message?: Message;
    unread_count?: number;
}

// ============ GROUP CHATS ============

export interface Group {
    id: string;
    name: string;
    description?: string | null;
    avatar_url?: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface GroupMember {
    id: string;
    group_id: string;
    user_id: string;
    role: 'admin' | 'member';
    added_by: string;
    added_at: string;
    removed_at?: string | null;
}

export interface GroupMessage {
    id: string;
    group_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'image' | 'file';
    read_by_json: string; // JSON string con array de user_ids que han leído el mensaje
    created_at: string;
}

export interface GroupMessageWithSender extends GroupMessage {
    sender?: Pick<User, 'id' | 'username' | 'profile_pic'>;
}

export interface GroupWithData extends Group {
    last_message?: GroupMessage;
    unread_count?: number;
    members_count?: number;
}
