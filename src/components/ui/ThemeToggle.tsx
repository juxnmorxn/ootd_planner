import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="relative w-14 h-8 rounded-full transition-colors flex items-center px-1"
            style={{
                backgroundColor: theme === 'dark' ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
                border: `1px solid var(--border-primary)`,
            }}
            aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
        >
            <div
                className="absolute transition-all"
                style={{
                    left: theme === 'dark' ? '6px' : '22px',
                }}
            >
                {theme === 'light' ? (
                    <Sun className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                ) : (
                    <Moon className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                )}
            </div>
        </button>
    );
}
