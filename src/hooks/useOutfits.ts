import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { Outfit, OutfitLayer } from '../types';
import { useStore } from '../lib/store';

/**
 * Hook to manage outfits for the current user with real-time updates
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
            const data = await db.getOutfitsByUser(currentUser.id);
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

    // Escuchar cambios en tiempo real
    useEffect(() => {
        const handleDbChange = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail.type === 'outfit') {
                console.log('[useOutfits] Detected change, reloading...');
                loadOutfits();
            }
        };

        window.addEventListener('db-change', handleDbChange);
        return () => window.removeEventListener('db-change', handleDbChange);
    }, [currentUser?.id]);

    const createOutfit = async (date: string, layers: OutfitLayer[]) => {
        if (!currentUser) throw new Error('No user logged in');

        try {
            const outfit = await db.createOutfit({
                id: '', // será sobrescrito en db.createOutfit
                user_id: currentUser.id,
                date_scheduled: date,
                layers_json: JSON.stringify(layers),
            } as any);
            // No need to update state manually, the event will trigger reload
            return outfit;
        } catch (err) {
            console.error('Failed to create outfit:', err);
            throw err;
        }
    };

    const updateOutfit = async (id: string, layers: OutfitLayer[]) => {
        try {
            await db.updateOutfit(id, JSON.stringify(layers));
            // No need to update state manually, the event will trigger reload
        } catch (err) {
            console.error('Failed to update outfit:', err);
            throw err;
        }
    };

    const deleteOutfit = async (id: string) => {
        try {
            await db.deleteOutfit(id);
            // No need to update state manually, the event will trigger reload
        } catch (err) {
            console.error('Failed to delete outfit:', err);
            throw err;
        }
    };

    const getOutfitByDate = async (date: string): Promise<Outfit | null> => {
        if (!currentUser) return null;
        return await db.getOutfitByDate(currentUser.id, date);
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
        refresh,
    };
}
