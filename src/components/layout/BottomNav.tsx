import { Home, ShirtIcon, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { User } from '../../types';

type NavItem = 'calendar' | 'closet' | 'chat-inbox' | 'settings';

interface BottomNavProps {
    active: NavItem;
    onNavigate: (item: NavItem) => void;
    currentUser?: User | null;
}

export function BottomNav({ active, onNavigate, currentUser }: BottomNavProps) {
    const items: Array<{ key: NavItem; icon?: typeof Home; label: string; isProfile?: boolean }> = [
        { key: 'calendar', icon: Home, label: 'Calendario' },
        { key: 'closet', icon: ShirtIcon, label: 'Clóset' },
        { key: 'chat-inbox', icon: MessageCircle, label: 'Mensajes' },
        { key: 'settings', label: 'Perfil', isProfile: true },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-40 border-t"
            style={{
                paddingBottom: 'env(safe-area-inset-bottom)',
                height: 'calc(4rem + env(safe-area-inset-bottom))',
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
            }}
        >
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {items.map((item) => {
                    const isActive = active === item.key;

                    return (
                        <button
                            key={item.key}
                            onClick={() => onNavigate(item.key)}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors touch-manipulation',
                                isActive ? 'font-semibold' : 'opacity-70'
                            )}
                            style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        >
                            {item.isProfile ? (
                                // Mostrar foto de perfil en un círculo
                                <div
                                    className={cn(
                                        'w-6 h-6 rounded-full overflow-hidden flex items-center justify-center transition-all',
                                        isActive ? 'ring-2 ring-offset-1' : ''
                                    )}
                                    style={{
                                        backgroundColor: 'var(--bg-tertiary)',
                                        ringColor: isActive ? 'var(--accent-color)' : undefined,
                                        ringOffsetColor: isActive ? 'var(--bg-secondary)' : undefined,
                                    }}
                                >
                                    {currentUser?.profile_pic ? (
                                        <img
                                            src={currentUser.profile_pic}
                                            alt="Perfil"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full flex items-center justify-center text-xs font-bold"
                                            style={{
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: 'white',
                                            }}
                                        >
                                            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // Mostrar icono normal
                                <>
                                    {item.icon && <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />}
                                </>
                            )}
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
