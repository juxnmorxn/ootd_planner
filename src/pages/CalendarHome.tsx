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
        <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden">
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

            {/* Main Section: The Stage (75%) - Con scroll y padding para barra inferior */}
            <div className="flex-1 overflow-y-auto pb-20 pt-2">
                <DailyOutfitStage
                    selectedDate={selectedDate}
                    onEditOutfit={handleEditOutfit}
                />
            </div>

            {/* Bottom Navigation is rendered by App.tsx */}
        </div>
    );
}
