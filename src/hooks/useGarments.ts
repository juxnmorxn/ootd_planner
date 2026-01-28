import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { Garment, GarmentCategory } from '../types';
import { useStore } from '../lib/store';

/**
 * Hook to manage garments for the current user with real-time updates
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
                ? await db.getGarmentsByCategory(currentUser.id, category)
                : await db.getGarmentsByUser(currentUser.id);
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

    // Escuchar cambios en tiempo real
    useEffect(() => {
        const handleDbChange = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail.type === 'garment') {
                console.log('[useGarments] Detected change, reloading...');
                loadGarments();
            }
        };

        window.addEventListener('db-change', handleDbChange);
        return () => window.removeEventListener('db-change', handleDbChange);
    }, [currentUser?.id, category]);

    const addGarment = async (garment: Omit<Garment, 'created_at'>) => {
        try {
            const newGarment = await db.createGarment(garment);
            // No need to update state manually, the event will trigger reload
            return newGarment;
        } catch (err) {
            console.error('Failed to add garment:', err);
            throw err;
        }
    };

    const deleteGarment = async (id: string) => {
        if (!currentUser) throw new Error('No user logged in');

        try {
            await db.deleteGarment(id, currentUser.id);
            // No need to update state manually, the event will trigger reload
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
