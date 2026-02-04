import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OutfitLayer } from '../types';

interface AppState {
    // Current user session (persisted)
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    logout: () => void;

    // Current view (auth, calendar, closet, chats, etc.)
    currentView:
        | 'auth'
        | 'calendar'
        | 'outfit-editor'
        | 'closet'
        | 'profile'
        | 'admin-users'
        | 'contacts'
        | 'chats'
        | 'fondos';
    setCurrentView: (
        view:
            | 'auth'
            | 'calendar'
            | 'outfit-editor'
            | 'closet'
            | 'profile'
            | 'admin-users'
            | 'contacts'
            | 'chats'
            | 'fondos'
    ) => void;

    // Active outfit being edited
    activeOutfit: {
        id: string | null;
        date: string | null;
        layers: OutfitLayer[];
    };
    setActiveOutfitId: (id: string | null) => void;
    setActiveOutfitDate: (date: string | null) => void;
    setActiveOutfitLayers: (layers: OutfitLayer[]) => void;
    addLayer: (layer: OutfitLayer) => void;
    updateLayer: (garmentId: string, updates: Partial<OutfitLayer>) => void;
    removeLayer: (garmentId: string) => void;
    clearActiveOutfit: () => void;

    // UI state
    selectedCategory: string | null;
    setSelectedCategory: (category: string | null) => void;
    
    // Chat state: target user to open chat with (set from Contacts)
    currentChatTargetUserId: string | null;
    setCurrentChatTargetUserId: (userId: string | null) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            // User session
            currentUser: null,
            setCurrentUser: (user) => set({ currentUser: user }),
            logout: () => set({
                currentUser: null,
                currentView: 'auth',
                activeOutfit: { id: null, date: null, layers: [] },
                currentChatTargetUserId: null,
            }),

            // Current view
            currentView: 'auth',
            setCurrentView: (view) => set({ currentView: view }),

            // Active outfit
            activeOutfit: {
                id: null,
                date: null,
                layers: [],
            },

            setActiveOutfitId: (id) =>
                set((state) => ({
                    activeOutfit: { ...state.activeOutfit, id },
                })),

            setActiveOutfitDate: (date) =>
                set((state) => ({
                    activeOutfit: { ...state.activeOutfit, date },
                })),

            setActiveOutfitLayers: (layers) =>
                set((state) => ({
                    activeOutfit: { ...state.activeOutfit, layers },
                })),

            addLayer: (layer) =>
                set((state) => ({
                    activeOutfit: {
                        ...state.activeOutfit,
                        layers: [...state.activeOutfit.layers, layer],
                    },
                })),

            updateLayer: (garmentId, updates) =>
                set((state) => ({
                    activeOutfit: {
                        ...state.activeOutfit,
                        layers: state.activeOutfit.layers.map((layer) =>
                            layer.garment_id === garmentId ? { ...layer, ...updates } : layer
                        ),
                    },
                })),

            removeLayer: (garmentId) =>
                set((state) => ({
                    activeOutfit: {
                        ...state.activeOutfit,
                        layers: state.activeOutfit.layers.filter(
                            (layer) => layer.garment_id !== garmentId
                        ),
                    },
                })),

            clearActiveOutfit: () =>
                set({
                    activeOutfit: {
                        id: null,
                        date: null,
                        layers: [],
                    },
                }),

            // UI state
            selectedCategory: null,
            setSelectedCategory: (category) => set({ selectedCategory: category }),

            // Chat state
            currentChatTargetUserId: null,
            setCurrentChatTargetUserId: (userId) => set({ currentChatTargetUserId: userId }),
        }),
        {
            name: 'outfit-planner-storage', // localStorage key
            partialize: (state) => ({
                // Persist session and current view
                currentUser: state.currentUser,
                currentView: state.currentView,
            }),
        }
    )
);
