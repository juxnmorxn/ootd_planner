import { Home, ShirtIcon, User } from 'lucide-react';
import { cn } from '../../lib/utils';

type NavItem = 'calendar' | 'closet' | 'settings';

interface BottomNavProps {
    active: NavItem;
    onNavigate: (item: NavItem) => void;
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
    const items: Array<{ key: NavItem; icon: typeof Home; label: string }> = [
        { key: 'calendar', icon: Home, label: 'Calendario' },
        { key: 'closet', icon: ShirtIcon, label: 'Clóset' },
        // La opción "Ajustes" realmente abre tu pantalla de perfil,
        // así que la mostramos como "Perfil" con el icono de usuario.
        { key: 'settings', icon: User, label: 'Perfil' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40" style={{paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(4rem + env(safe-area-inset-bottom))'}}>
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;

                    return (
                        <button
                            key={item.key}
                            onClick={() => onNavigate(item.key)}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors touch-manipulation',
                                isActive ? 'text-black' : 'text-gray-400'
                            )}
                        >
                            <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
