import { useState, useEffect } from 'react';
import { watermelonService } from '../lib/watermelon-service';
import type { Garment, GarmentCategory } from '../types';
import { useStore } from '../lib/store';

/**
 * Hook to manage garments for the current user with offline-first support
 * Usa WatermelonDB: datos locales + sincronización automática
 */
export function useGarments(category?: GarmentCategory) {
    const currentUser = useStore((state) => state.currentUser);
    const [garments, setGarments] = useState<Garment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadGarments = async () => {
        if (!currentUser) {
            setGarments([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = category
                ? await watermelonService.getGarmentsByCategory(currentUser.id, category)
                : await watermelonService.getGarmentsByUser(currentUser.id);
            setGarments(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Failed to load garments:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGarments();
    }, [currentUser?.id, category]);

    // Escuchar cambios de sincronización
    useEffect(() => {
        const handleDbSynced = () => {
            console.log('[useGarments] Database synced, reloading...');
            loadGarments();
        };

        window.addEventListener('db-synced', handleDbSynced);
        return () => window.removeEventListener('db-synced', handleDbSynced);
    }, [currentUser?.id, category]);

    const addGarment = async (garment: Omit<Garment, 'created_at'>) => {
        try {
            const newGarment = await watermelonService.createGarment(garment as any);
            loadGarments(); // Recargar lista
            return newGarment;
        } catch (err) {
            console.error('Failed to add garment:', err);
            throw err;
        }
    };

    const deleteGarment = async (id: string) => {
        if (!currentUser) throw new Error('No user logged in');

        try {
            await watermelonService.deleteGarment(id);
            loadGarments(); // Recargar lista
        } catch (err) {
            console.error('Failed to delete garment:', err);
            throw err;
        }
    };

    const refresh = () => {
        loadGarments();
    };

    return {
        garments,
        loading,
        error,
        addGarment,
        deleteGarment,
        refresh,
    };
}
