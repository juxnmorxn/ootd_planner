import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

export function Button({
    variant = 'primary',
    size = 'md',
    className,
    children,
    ...props
}: ButtonProps) {
    const baseStyles =
        'inline-flex items-center justify-center rounded-xl font-medium transition-all touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: '[background-color:var(--btn-primary-bg)] [color:var(--btn-primary-text)] hover:[background-color:var(--btn-primary-hover)]',
        secondary: '[background-color:var(--btn-secondary-bg)] [color:var(--btn-secondary-text)] hover:[background-color:var(--btn-secondary-hover)]',
        ghost: '[background-color:var(--btn-ghost-bg)] hover:[background-color:var(--btn-ghost-hover)] [color:var(--btn-ghost-text)]',
        danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            style={{
                backgroundColor: variant === 'primary' ? 'var(--btn-primary-bg)' : 
                                variant === 'secondary' ? 'var(--btn-secondary-bg)' :
                                variant === 'ghost' ? 'var(--btn-ghost-bg)' : undefined,
                color: variant === 'primary' ? 'var(--btn-primary-text)' :
                      variant === 'secondary' ? 'var(--btn-secondary-text)' :
                      variant === 'ghost' ? 'var(--btn-ghost-text)' : undefined,
            }}
            {...props}
        >
            {children}
        </button>
    );
}
