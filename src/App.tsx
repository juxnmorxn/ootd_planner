import { useState, useEffect } from 'react';
import { db } from './lib/db';
import { useStore } from './lib/store';
import { Auth } from './pages/Auth';
import { CalendarHome } from './pages/CalendarHome';
import { OutfitEditor } from './pages/OutfitEditor';
import { Closet } from './pages/Closet';
import { Profile } from './pages/Profile';
import { BottomNav } from './components/layout/BottomNav';

import { AdminUsers } from './pages/AdminUsers';

function App() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [dbInitialized, setDbInitialized] = useState(false);
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const view = useStore((state) => state.currentView);
  const setView = useStore((state) => state.setCurrentView);

  // Saber si el store persistido (localStorage) ya se rehidrató
  const hasHydrated = (useStore as any).persist?.hasHydrated
    ? (useStore as any).persist.hasHydrated()
    : true;

  // Validar que view sea uno de los valores esperados; si no, resetear a 'auth'
  const validViews = ['auth', 'calendar', 'outfit-editor', 'closet', 'profile', 'admin-users'];
  const safeView = validViews.includes(view) ? view : 'auth';

  useEffect(() => {
    initializeDatabase();
  }, []);

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

  const initializeDatabase = async () => {
    try {
      await db.initialize();

      setDbInitialized(true);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // No bloqueamos la app, pero mostramos error
      setDbInitialized(true);
    }
  };

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

  if (!dbInitialized || !hasHydrated) {
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
    <div className="relative min-h-screen">
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
