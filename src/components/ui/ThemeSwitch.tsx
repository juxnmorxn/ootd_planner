import React from 'react';
import { useTheme } from '../../lib/theme';
import { Switch } from './Switch';

export const ThemeSwitch: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Switch
            checked={theme === 'dark'}
            onChange={() => toggleTheme()}
        />
    );
};
