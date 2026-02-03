import { useState, useEffect, useRef } from 'react';
import { watermelonService } from './lib/watermelon-service';
import { syncDatabase } from './lib/watermelon';
import { useStore } from './lib/store';
import { Auth } from './pages/Auth';
import { CalendarHome } from './pages/CalendarHome';
import { OutfitEditor } from './pages/OutfitEditor';
import { Closet } from './pages/Closet';
import { Profile } from './pages/Profile';
import { BottomNav } from './components/layout/BottomNav';
import { Chats } from './pages/Chats';
import { Contacts } from './pages/Contacts';

import { AdminUsers } from './pages/AdminUsers';

function App() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const isProcessingHistoryRef = useRef(false);
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const view = useStore((state) => state.currentView);
  const setView = useStore((state) => state.setCurrentView);

  // Saber si el store persistido (localStorage) ya se rehidrató
  const hasHydrated = (useStore as any).persist?.hasHydrated
    ? (useStore as any).persist.hasHydrated()
    : true;

  // Validar que view sea uno de los valores esperados; si no, resetear a 'auth'
  const validViews = [
    'auth',
    'calendar',
    'outfit-editor',
    'closet',
    'profile',
    'admin-users',
    'contacts',
    'chats',
  ];
  const safeView = validViews.includes(view) ? view : 'auth';

  useEffect(() => {
    // Validar sesión: logout automático si > 60 días
    if (currentUser && currentUser.loginTimestamp) {
      const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
      const sessionAgeMs = Date.now() - currentUser.loginTimestamp;
      
      if (sessionAgeMs > TWO_MONTHS_MS) {
        console.log('[App] Session expired (60+ days), logging out');
        logout();
        return;
      }
    }

    // Chequear si necesita sync diario (hace > 24h que no sincroniza)
    if (currentUser && navigator.onLine) {
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const lastSync = currentUser.lastSyncTimestamp || 0;
      const timeSinceLastSync = Date.now() - lastSync;

      if (timeSinceLastSync > ONE_DAY_MS) {
        console.log('[App] Forcing daily sync (>24h since last sync)');
        (async () => {
          try {
            const apiUrl = window.location.hostname === 'localhost'
              ? 'http://localhost:3001/api'
              : '/api';
            await syncDatabase(currentUser.id, apiUrl);
            // Actualizar lastSyncTimestamp en el store
            setCurrentUser({
              ...currentUser,
              lastSyncTimestamp: Date.now(),
            });
          } catch (error) {
            console.error('[App] Daily sync failed:', error);
          }
        })();
      }
    }
  }, [currentUser?.id]);

  // Chequear expiración periódicamente
  useEffect(() => {
    const checkExpiry = setInterval(() => {
      if (currentUser && currentUser.loginTimestamp) {
        const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
        const sessionAgeMs = Date.now() - currentUser.loginTimestamp;
        
        if (sessionAgeMs > TWO_MONTHS_MS) {
          console.log('[App] Session expired, logging out');
          logout();
          clearInterval(checkExpiry);
        }
      }
    }, 60000); // Chequear cada minuto
    
    return () => clearInterval(checkExpiry);
  }, [currentUser, logout]);

  useEffect(() => {
    // Init local database layer when a user session exists
    if (!currentUser) return;
    (async () => {
      try {
        await watermelonService.initialize(currentUser.id);
      } catch (error) {
        console.error('[App] Watermelon init failed:', error);
      }
    })();
  }, [currentUser?.id]);

  // Manejo del historial y gestos de navegación del sistema
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.appView) {
        isProcessingHistoryRef.current = true;
        setView(state.appView);
        if (state.selectedDate) setSelectedDate(state.selectedDate);
        if (state.selectedOutfitId) setSelectedOutfitId(state.selectedOutfitId);
        setTimeout(() => {
          isProcessingHistoryRef.current = false;
        }, 0);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Sincronizar cambios de vista con el historial del navegador
  useEffect(() => {
    if (!currentUser || isProcessingHistoryRef.current) return;

    const state = {
      appView: safeView,
      selectedDate,
      selectedOutfitId,
      timestamp: Date.now(),
    };

    // Usa replaceState para la primera carga, pushState para cambios
    if (window.history.state?.appView !== safeView) {
      window.history.pushState(state, '', window.location.href);
    }
  }, [safeView, selectedDate, selectedOutfitId, currentUser]);

  useEffect(() => {
    // Si el view rehidratado es inválido, resetea a 'auth'
    if (!validViews.includes(view)) {
      console.warn(`[App] Invalid view from localStorage: ${view}, resetting to auth`);
      setView('auth');
    }
    // If user is logged in (from persisted state), go to calendar
    if (currentUser && safeView === 'auth') {
      setView('calendar');
    }
  }, [currentUser]);

  // initializeDatabase() removed: initialization is now split into two effects

  const handleAuthSuccess = () => {
    setView('calendar');
  };

  const handleEditOutfit = (date: string, outfitId?: string) => {
    setSelectedDate(date);
    setSelectedOutfitId(outfitId || null);
    setView('outfit-editor');
  };

  const handleBackToCalendar = () => {
    setView('calendar');
    setSelectedDate(null);
    setSelectedOutfitId(null);
  };

  const handleNavigate = (item: 'calendar' | 'closet' | 'settings') => {
    if (item === 'settings') {
      setView('profile');
      return;
    }
    setView(item);
  };

  const handleLogout = () => {
    // Limpiar sesión en el store persistido y volver a la pantalla de auth
    logout();
    setView('auth');
  };

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-black border-t-transparent mb-4"></div>
          <p className="text-slate-900 text-xl font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if no user is logged in
  if (!currentUser) {
    return <Auth onSuccess={handleAuthSuccess} />;
  }

  // Show bottom nav for main views (calendar and closet)
  const showBottomNav = safeView === 'calendar' || safeView === 'closet';
  const navActive = (safeView === 'calendar' ? 'calendar' : safeView === 'closet' ? 'closet' : 'calendar') as 'calendar' | 'closet';

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col">
        {safeView === 'calendar' && (
          <CalendarHome
            onEditOutfit={handleEditOutfit}
            onOpenMenu={() => setView('closet')}
          />
        )}

        {safeView === 'outfit-editor' && selectedDate && (
          <OutfitEditor date={selectedDate} outfitId={selectedOutfitId || undefined} onBack={handleBackToCalendar} />
        )}

        {safeView === 'closet' && <Closet />}

        {safeView === 'profile' && (
          <Profile onBack={() => setView('calendar')} onLogout={handleLogout} />
        )}

        {safeView === 'admin-users' && (
          <AdminUsers onBack={() => setView('profile')} />
        )}

        {safeView === 'contacts' && (
          <Contacts
            userId={currentUser.id}
          />
        )}

        {safeView === 'chats' && (
          <Chats
            userId={currentUser.id}
          />
        )}
      </div>
      {showBottomNav && (
        <BottomNav
          active={navActive}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}

export default App;
