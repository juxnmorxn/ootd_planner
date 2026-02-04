import React from 'react';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange }) => {
    const handleToggle = () => onChange(!checked);

    return (
        <button
            type="button"
            onClick={handleToggle}
            className="relative inline-flex items-center transition-colors"
            style={{
                width: 44,
                height: 24,
                borderRadius: 999,
                padding: 2,
                backgroundColor: checked ? '#22c55e' : '#4b5563',
            }}
            aria-pressed={checked}
        >
            <span
                className="transition-transform bg-white shadow"
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    transform: checked ? 'translateX(20px)' : 'translateX(0px)',
                }}
            />
        </button>
    );
};
