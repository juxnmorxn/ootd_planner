import type { Garment, Outfit, User, RegisterData, LoginCredentials } from '../types';

// En desarrollo local: localhost:3001
// En producción (Render, etc): misma ruta pero vía proxy
const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    // En producción, usar ruta relativa (el servidor frontend sirve /api)
    return '/api';
})();

class APIDatabase {
    // ============ USERS ============

    async createUser(user: User): Promise<User> {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
        });

        if (!response.ok) {
            throw new Error('Failed to create user');
        }

        return response.json();
    }

    async register(data: RegisterData): Promise<User> {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: data.email,
                password: data.password,
                username: data.username,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to register');
        }

        return response.json();
    }

    async login(credentials: LoginCredentials): Promise<User> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // El backend interpreta "username" como username o email
                username: credentials.username,
                password: credentials.password,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to login');
        }

        return response.json();
    }

    async getAllUsers(): Promise<User[]> {
        const response = await fetch(`${API_URL}/users`);

        if (!response.ok) {
            throw new Error('Failed to get users');
        }

        return response.json();
    }

    async getUser(id: string): Promise<User | null> {
        const response = await fetch(`${API_URL}/users/${id}`);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error('Failed to get user');
        }

        return response.json();
    }

    async deleteUser(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
    }

    async updateUser(id: string, data: { username?: string; email: string }): Promise<User> {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update user');
        }

        return response.json();
    }

    async updateProfilePicture(id: string, imageData: string): Promise<User> {
        const response = await fetch(`${API_URL}/users/${id}/profile-pic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data: imageData }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update profile picture');
        }

        return response.json();
    }

    // ============ GARMENTS ============

    async createGarment(garment: Omit<Garment, 'created_at'> & { id: string }): Promise<Garment> {
        const response = await fetch(`${API_URL}/garments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(garment),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create garment');
        }

        return response.json();
    }

    async getGarmentsByUser(userId: string): Promise<Garment[]> {
        const response = await fetch(`${API_URL}/garments/user/${userId}`);

        if (!response.ok) {
            throw new Error('Failed to get garments');
        }

        return response.json();
    }

    async getGarmentsByCategory(userId: string, category: string): Promise<Garment[]> {
        const response = await fetch(`${API_URL}/garments/user/${userId}/category/${category}`);

        if (!response.ok) {
            throw new Error('Failed to get garments by category');
        }

        return response.json();
    }

    async deleteGarment(id: string, userId: string): Promise<void> {
        const response = await fetch(`${API_URL}/garments/${id}?userId=${userId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete garment');
        }
    }

    async getAllGarments(): Promise<(Garment & { owner_name: string; owner_email: string })[]> {
        const response = await fetch(`${API_URL}/admin/garments`);

        if (!response.ok) {
            throw new Error('Failed to get all garments');
        }

        return response.json();
    }

    // ============ OUTFITS ============

    async createOutfit(outfit: Outfit): Promise<Outfit> {
        const response = await fetch(`${API_URL}/outfits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(outfit),
        });

        if (!response.ok) {
            throw new Error('Failed to create outfit');
        }

        return response.json();
    }

    async getOutfitByDate(userId: string, date: string): Promise<Outfit | null> {
        const response = await fetch(`${API_URL}/outfits/user/${userId}/date/${date}`);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error('Failed to get outfit');
        }

        return response.json();
    }

    async getOutfitById(id: string): Promise<Outfit | null> {
        const response = await fetch(`${API_URL}/outfits/${id}`);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error('Failed to get outfit');
        }

        return response.json();
    }

    async getOutfitOptionsByDate(userId: string, date: string): Promise<Outfit[]> {
        const response = await fetch(`${API_URL}/outfits/user/${userId}/date/${date}/options`);

        if (response.status === 404) {
            return [];
        }

        if (!response.ok) {
            throw new Error('Failed to get outfit options');
        }

        return response.json();
    }

    async getOutfitsByUser(userId: string): Promise<Outfit[]> {
        const response = await fetch(`${API_URL}/outfits/user/${userId}`);

        if (!response.ok) {
            throw new Error('Failed to get outfits');
        }

        return response.json();
    }

    async updateOutfit(id: string, layersJson: string): Promise<void> {
        const response = await fetch(`${API_URL}/outfits/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layers_json: layersJson }),
        });

        if (!response.ok) {
            throw new Error('Failed to update outfit');
        }
    }

    async deleteOutfit(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/outfits/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete outfit');
        }
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, oldPassword, newPassword }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to change password');
        }
    }

    // ============ STATS ============

    async getStats(userId: string): Promise<{ garments: number; outfits: number }> {
        const response = await fetch(`${API_URL}/stats/${userId}`);

        if (!response.ok) {
            throw new Error('Failed to get stats');
        }

        return response.json();
    }
}

// Singleton instance
export const apiDb = new APIDatabase();
export default apiDb;
