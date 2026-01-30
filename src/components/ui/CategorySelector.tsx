import { getAllCategories } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { GarmentCategory } from '../../types';

interface CategorySelectorProps {
    selected: GarmentCategory | null;
    onSelect: (category: GarmentCategory) => void;
    className?: string;
}

export function CategorySelector({ selected, onSelect, className }: CategorySelectorProps) {
    const categories = getAllCategories();

    return (
        <div className={cn('flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide', className)}>
            {categories.map((cat) => (
                <button
                    key={cat.key}
                    onClick={() => onSelect(cat.key)}
                    className={cn(
                        'flex-shrink-0 px-3 py-1.5 rounded-full text-[15px] font-semibold transition-all uppercase tracking-wider',
                        selected === cat.key
                            ? 'bg-black text-white'
                            : 'bg-transparent text-slate-400 hover:text-slate-600'
                    )}
                >
                    {cat.label}
                </button>
            ))}
        </div>
    );
}
