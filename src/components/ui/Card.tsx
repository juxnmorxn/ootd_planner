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
                'bg-white rounded-2xl shadow-sm overflow-hidden transition-all border border-slate-100',
                onClick && 'cursor-pointer hover:shadow-md active:scale-[0.98]',
                className
            )}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('px-4 py-3 border-b border-slate-100', className)}>
            {children}
        </div>
    );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('p-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('px-4 py-3 border-t border-slate-100', className)}>
            {children}
        </div>
    );
}
