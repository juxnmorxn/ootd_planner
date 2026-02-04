import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {label}
                </label>
            )}
            <input
                className={cn(
                    'w-full px-4 py-2.5 rounded-xl border',
                    'focus:outline-none focus:ring-2 focus:border-transparent',
                    'transition-all',
                    error && 'border-red-500 focus:ring-red-500',
                    className
                )}
                style={{
                    backgroundColor: 'var(--input-bg)',
                    borderColor: error ? undefined : 'var(--input-border)',
                    color: 'var(--input-text)',
                }}
                placeholder={props.placeholder}
                {...props}
            />
            {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
        </div>
    );
}
