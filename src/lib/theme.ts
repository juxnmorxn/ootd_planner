import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'auto' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  applyTheme: () => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

// Detectar preferencia de color del sistema
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Aplicar tema al documento
const applyThemeToDOM = (theme: 'light' | 'dark') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'auto',
      setMode: (mode: ThemeMode) => {
        set({ mode });
        get().applyTheme();
      },
      applyTheme: () => {
        const effectiveTheme = get().getEffectiveTheme();
        applyThemeToDOM(effectiveTheme);
      },
      getEffectiveTheme: () => {
        const mode = get().mode;
        if (mode === 'auto') {
          return getSystemTheme();
        }
        return mode;
      },
    }),
    {
      name: 'outfit-planner-theme',
      onRehydrateStorage: () => (state) => {
        // Aplicar tema guardado al cargar
        if (state) {
          const effectiveTheme = state.mode === 'auto' ? getSystemTheme() : state.mode;
          applyThemeToDOM(effectiveTheme);
        }
      },
    }
  )
);
