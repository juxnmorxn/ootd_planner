import { cn } from '../../lib/utils';

interface TabBarProps {
    tabs: Array<{
        key: string;
        label: string;
        icon?: string;
    }>;
    activeTab: string;
    onTabChange: (key: string) => void;
    className?: string;
}

export function TabBar({ tabs, activeTab, onTabChange, className }: TabBarProps) {
    return (
        <div className={cn('flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide', className)}>
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap transition-all text-[15px] font-semibold touch-manipulation',
                        activeTab === tab.key
                            ? 'bg-black text-white'
                            : 'bg-transparent text-[color:var(--text-tertiary)] hover:bg-[color:var(--bg-secondary)]'
                    )}
                >
                    {tab.icon && <span className="text-base">{tab.icon}</span>}
                    <span>{tab.label}</span>
                </button>
            ))}
        </div>
    );
}
