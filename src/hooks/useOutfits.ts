import { useState, useEffect } from 'react';
import { watermelonService } from '../lib/watermelon-service';
import type { Outfit, OutfitLayer } from '../types';
import { useStore } from '../lib/store';

/**
 * Hook to manage outfits for the current user with offline-first support
 * Usa WatermelonDB: datos locales + sincronización automática
 */
export function useOutfits() {
    const currentUser = useStore((state) => state.currentUser);
    const [outfits, setOutfits] = useState<Outfit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadOutfits = async () => {
        if (!currentUser) {
            setOutfits([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await watermelonService.getOutfitsByUser(currentUser.id);
            setOutfits(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Failed to load outfits:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOutfits();
    }, [currentUser?.id]);

    // Escuchar cambios de sincronización
    useEffect(() => {
        const handleDbSynced = () => {
            console.log('[useOutfits] Database synced, reloading...');
            loadOutfits();
        };

        window.addEventListener('db-synced', handleDbSynced);
        return () => window.removeEventListener('db-synced', handleDbSynced);
    }, [currentUser?.id]);

    const createOutfit = async (date: string, layers: OutfitLayer[]) => {
        if (!currentUser) throw new Error('No user logged in');

        try {
            const outfit: Outfit = {
                id: '', // Se genera en WatermelonDB
                user_id: currentUser.id,
                date_scheduled: date,
                layers_json: JSON.stringify(layers),
            };

            const result = await watermelonService.createOutfit(outfit);
            loadOutfits(); // Recargar lista
            return result;
        } catch (err) {
            console.error('Failed to create outfit:', err);
            throw err;
        }
    };

    const updateOutfit = async (id: string, layers: OutfitLayer[]) => {
        try {
            await watermelonService.updateOutfit(id, JSON.stringify(layers));
            loadOutfits(); // Recargar lista
        } catch (err) {
            console.error('Failed to update outfit:', err);
            throw err;
        }
    };

    const deleteOutfit = async (id: string) => {
        try {
            await watermelonService.deleteOutfit(id);
            loadOutfits(); // Recargar lista
        } catch (err) {
            console.error('Failed to delete outfit:', err);
            throw err;
        }
    };

    const getOutfitByDate = async (date: string): Promise<Outfit | null> => {
        if (!currentUser) return null;
        return await watermelonService.getOutfitByDate(currentUser.id, date);
    };

    const duplicateOutfit = async (source: Outfit): Promise<Outfit> => {
        const layers: OutfitLayer[] = JSON.parse(source.layers_json);
        return await createOutfit(source.date_scheduled, layers);
    };

    const refresh = () => {
        loadOutfits();
    };

    return {
        outfits,
        loading,
        error,
        createOutfit,
        updateOutfit,
        deleteOutfit,
        getOutfitByDate,
        duplicateOutfit,
        refresh,
    };
}
