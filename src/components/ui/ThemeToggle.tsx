import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';

export function ThemeToggle() {
    const { mode, setMode, getEffectiveTheme } = useTheme();
    const effectiveTheme = getEffectiveTheme();

    return (
        <button
            onClick={() => setMode(mode === 'auto' ? (effectiveTheme === 'dark' ? 'light' : 'dark') : (mode === 'light' ? 'dark' : 'auto'))}
            className="relative w-14 h-8 rounded-full transition-colors flex items-center px-1"
            style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: `1px solid var(--border-primary)`,
            }}
            aria-label="Cambiar tema"
        >
            <div
                className="absolute transition-all"
                style={{
                    left: effectiveTheme === 'dark' ? '6px' : '22px',
                }}
            >
                {effectiveTheme === 'light' ? (
                    <Sun className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                ) : (
                    <Moon className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                )}
            </div>
        </button>
    );
}
