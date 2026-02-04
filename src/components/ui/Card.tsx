import { cn } from '../../lib/utils';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
    return (
        <div
            className={cn(
                'rounded-2xl shadow-sm overflow-hidden transition-all border',
                onClick && 'cursor-pointer hover:shadow-md active:scale-[0.98]',
                className
            )}
            style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
            }}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div 
            className={cn('px-4 py-3 border-b', className)}
            style={{
                borderBottomColor: 'var(--border-primary)',
            }}
        >
            {children}
        </div>
    );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('p-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div 
            className={cn('px-4 py-3 border-t', className)}
            style={{
                borderTopColor: 'var(--border-primary)',
            }}
        >
            {children}
        </div>
    );
}
