import { ArrowLeft } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';

export function Fondos() {
    const setView = useStore((state) => state.setCurrentView);
    const { theme } = useTheme();

    return (
        <div style={{ backgroundColor: 'var(--bg-primary)' }} className="min-h-screen">
            <div className="min-h-screen">
                <div className="safe-area-inset-top" />

                <header 
                    className="px-4 pt-4"
                    style={{ borderBottomColor: 'var(--border-primary)' }}
                >
                    <div className="max-w-md mx-auto flex items-center justify-between">
                        <button
                            onClick={() => setView('profile')}
                            className="w-10 h-10 flex items-center justify-center rounded-xl border"
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)',
                            }}
                            aria-label="Volver"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center flex-1">
                            <h1 
                                className="text-lg font-bold"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                Fondos y Temas
                            </h1>
                            <p 
                                className="text-xs"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Personaliza tu experiencia
                            </p>
                        </div>
                        <div className="w-10" />
                    </div>
                </header>

                <main className="px-4 py-6">
                    <div className="max-w-md mx-auto space-y-4">
                        <div 
                            className="rounded-3xl border p-5"
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h2 
                                    className="font-semibold"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Tema
                                </h2>
                                <ThemeSwitch />
                            </div>
                            <p 
                                className="text-sm"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Tema actual: <span style={{ color: 'var(--text-secondary)' }}>{theme === 'light' ? 'Claro' : 'Oscuro'}</span>
                            </p>
                        </div>

                        <div 
                            className="rounded-3xl border p-5"
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                            }}
                        >
                            <h3 
                                className="font-semibold mb-2"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                Tokens CSS
                            </h3>
                            <p 
                                className="text-sm mb-3"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Los colores y componentes usan variables CSS reutilizables. Cambia el tema para ver los cambios en tiempo real.
                            </p>
                            <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-primary)' }}>
                                <div 
                                    className="text-xs font-mono"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    --bg-primary: <span style={{ color: 'var(--accent-primary)' }}>var(--bg-primary)</span>
                                </div>
                                <div 
                                    className="text-xs font-mono mt-1"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    --text-primary: <span style={{ color: 'var(--accent-primary)' }}>var(--text-primary)</span>
                                </div>
                                <div 
                                    className="text-xs font-mono mt-1"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    --btn-primary-bg: <span style={{ color: 'var(--accent-primary)' }}>var(--btn-primary-bg)</span>
                                </div>
                            </div>
                        </div>

                        <div className="safe-area-inset-bottom" />
                    </div>
                </main>
            </div>
        </div>
    );
}
