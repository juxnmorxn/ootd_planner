import React from 'react';
import { useTheme } from '../../lib/theme';
import { Switch } from './Switch';

export const ThemeSwitch: React.FC = () => {
    const { mode, setMode, getEffectiveTheme } = useTheme();
    const effectiveTheme = getEffectiveTheme();

    return (
        <Switch
            checked={effectiveTheme === 'dark'}
            onChange={() => {
                // Alternar entre auto -> dark -> light -> auto
                if (mode === 'auto') {
                    setMode(effectiveTheme === 'dark' ? 'light' : 'dark');
                } else if (mode === 'light') {
                    setMode('dark');
                } else {
                    setMode('auto');
                }
            }}
        />
    );
};
