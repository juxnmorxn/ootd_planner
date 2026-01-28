import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../lib/store';

interface DateItem {
    date: Date;
    dayName: string;
    dayNumber: number;
    dateString: string;
    isToday: boolean;
}

interface HorizontalDateStripProps {
    selectedDate: string;
    onDateSelect: (dateString: string) => void;
    currentMonth: Date;
    onPreviousMonth: () => void;
    onNextMonth: () => void;
}

export function HorizontalDateStrip({
    selectedDate,
    onDateSelect,
    currentMonth,
    onPreviousMonth,
    onNextMonth,
}: HorizontalDateStripProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const selectedItemRef = useRef<HTMLButtonElement>(null);
    const setView = useStore((state) => state.setCurrentView);
    const currentUser = useStore((state) => state.currentUser);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weekDaysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
    ];

    // Generate all days for the month
    const dates: DateItem[] = Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(year, month, i + 1);
        const dateString = date.toISOString().split('T')[0];
        const today = new Date();
        const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

        return {
            date,
            dayName: weekDaysShort[date.getDay()],
            dayNumber: i + 1,
            dateString,
            isToday,
        };
    });

    // Auto-scroll to selected date
    useEffect(() => {
        if (selectedItemRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const item = selectedItemRef.current;
            const containerWidth = container.offsetWidth;
            const itemLeft = item.offsetLeft;
            const itemWidth = item.offsetWidth;

            // Center the selected item
            const scrollPosition = itemLeft - containerWidth / 2 + itemWidth / 2;
            container.scrollTo({
                left: scrollPosition,
                behavior: 'smooth',
            });
        }
    }, [selectedDate]);

    return (
        <div className="bg-white border-b border-slate-100">
            {/* Compact Month Header */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                        {monthNames[month]} {year}
                    </h2>
                    {currentUser?.role === 'admin' && (
                        <button
                            onClick={() => setView('admin-users')}
                            className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 animate-pulse"
                            title="Panel de Administración"
                        >
                            <Shield className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Admin</span>
                        </button>
                    )}
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={onPreviousMonth}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-slate-700" />
                    </button>
                    <button
                        onClick={onNextMonth}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-slate-700" />
                    </button>
                </div>
            </div>

            {/* Compact Date Strip */}
            <div
                ref={scrollContainerRef}
                className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-hide scroll-smooth"
                style={{
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {dates.map((item) => {
                    const isSelected = item.dateString === selectedDate;

                    return (
                        <button
                            key={item.dateString}
                            ref={isSelected ? selectedItemRef : null}
                            onClick={() => onDateSelect(item.dateString)}
                            className={cn(
                                'flex-shrink-0 flex flex-col items-center justify-center transition-all touch-manipulation',
                                'w-12 h-14 rounded-xl',
                                isSelected
                                    ? 'bg-black text-white shadow-md'
                                    : 'bg-transparent text-slate-400 hover:text-slate-600'
                            )}
                            style={{ scrollSnapAlign: 'center' }}
                        >
                            <span className={cn('text-[10px] font-medium mb-0.5', isSelected ? 'text-white/80' : 'text-slate-400')}>
                                {item.dayName}
                            </span>
                            <span className={cn('text-lg font-bold', isSelected ? 'text-white' : 'text-slate-900')}>
                                {item.dayNumber}
                            </span>
                            {item.isToday && !isSelected && <div className="w-1 h-1 bg-black rounded-full mt-0.5" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
