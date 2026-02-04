import { cn } from '../../lib/utils';
import type { Garment } from '../../types';

interface GarmentCardProps {
    garment: Garment;
    onClick?: () => void;
    onDelete?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function GarmentCard({ garment, onClick, onDelete, size = 'md', className }: GarmentCardProps) {
    const sizes = {
        sm: 'w-20 h-20',
        md: 'aspect-square',
        lg: 'aspect-square',
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                'relative rounded-lg overflow-hidden group',
                onClick && 'cursor-pointer hover:ring-2 transition-all',
                sizes[size],
                className
            )}
            style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
            <div className="w-full h-full flex items-center justify-center p-2">
                <img
                    src={garment.image_data}
                    alt={garment.sub_category}
                    crossOrigin="anonymous"
                    className="max-w-full max-h-full object-contain"
                />
            </div>

            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                >
                    ×
                </button>
            )}

            {size !== 'sm' && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                    <p className="text-xs text-white font-medium truncate">{garment.sub_category}</p>
                </div>
            )}
        </div>
    );
}
