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
            {categories.map((cat) => {
                const isSelected = selected === cat.key;

                return (
                    <button
                        key={cat.key}
                        onClick={() => onSelect(cat.key)}
                        className={cn(
                            'flex-shrink-0 px-3 py-1.5 rounded-full text-[15px] font-semibold transition-all uppercase tracking-wider',
                            isSelected ? 'shadow-sm' : 'hover:opacity-80'
                        )}
                        style={{
                            backgroundColor: isSelected ? 'var(--btn-primary-bg)' : 'transparent',
                            color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-tertiary)',
                        }}
                    >
                        {cat.label}
                    </button>
                );
            })}
        </div>
    );
}
