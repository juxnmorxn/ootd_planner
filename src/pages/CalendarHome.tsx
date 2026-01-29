import { useState } from 'react';
import { HorizontalDateStrip } from '../components/ui/HorizontalDateStrip';
import { DailyOutfitStage } from '../components/ui/DailyOutfitStage';
import { formatDateISO } from '../lib/utils';

interface CalendarHomeProps {
    onEditOutfit: (date: string, outfitId?: string) => void;
    onOpenMenu: () => void;
}

export function CalendarHome({ onEditOutfit }: CalendarHomeProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));

    const previousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleDateSelect = (dateString: string) => {
        setSelectedDate(dateString);
    };

    const handleEditOutfit = (outfitId?: string) => {
        onEditOutfit(selectedDate, outfitId);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50">
            {/* Top Section: Date Strip (15%) */}
            <div className="flex-shrink-0">
                <HorizontalDateStrip
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    currentMonth={currentMonth}
                    onPreviousMonth={previousMonth}
                    onNextMonth={nextMonth}
                />
            </div>

            {/* Main Section: The Stage (75%) */}
            <DailyOutfitStage
                selectedDate={selectedDate}
                onEditOutfit={handleEditOutfit}
            />

            {/* Bottom Navigation is rendered by App.tsx */}
        </div>
    );
}
