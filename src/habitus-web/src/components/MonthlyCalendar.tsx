import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReservationDto, SharedSpaceDto } from '../types';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import { Card } from './ui';

interface MonthlyCalendarProps {
  reservations: ReservationDto[];
  spaces: SharedSpaceDto[];
  onSelectDay: (date: Date) => void;
  onSelectReservation: (reservation: ReservationDto) => void;
}

// Weekday abbreviations, index 0 = Sunday (matches Date.getDay()).
const buildDays = (t: TranslateFn): string[] => [
  t('calendar.day.short.0'),
  t('calendar.day.short.1'),
  t('calendar.day.short.2'),
  t('calendar.day.short.3'),
  t('calendar.day.short.4'),
  t('calendar.day.short.5'),
  t('calendar.day.short.6'),
];

// Full month names, index 0 = January (matches Date.getMonth()).
const buildMonths = (t: TranslateFn): string[] => [
  t('calendar.month.0'),
  t('calendar.month.1'),
  t('calendar.month.2'),
  t('calendar.month.3'),
  t('calendar.month.4'),
  t('calendar.month.5'),
  t('calendar.month.6'),
  t('calendar.month.7'),
  t('calendar.month.8'),
  t('calendar.month.9'),
  t('calendar.month.10'),
  t('calendar.month.11'),
];

export default function MonthlyCalendar({
  reservations,
  spaces,
  onSelectDay,
  onSelectReservation,
}: MonthlyCalendarProps) {
  const { t } = useTranslation();
  const DAYS = useMemo(() => buildDays(t), [t]);
  const MONTHS = useMemo(() => buildMonths(t), [t]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Get first day of month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  
  // Get starting day (Sunday = 0, Saturday = 6)
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Filter only Pending and Approved reservations
  const visibleReservations = reservations.filter(
    (r) => r.status === 'Pending' || r.status === 'Approved'
  );

  // Get reservations for a specific day
  const getReservationsForDay = (day: number): ReservationDto[] => {
    const date = new Date(currentYear, currentMonth, day);
    return visibleReservations.filter((r) => {
      const startDate = new Date(r.startTime);
      return (
        startDate.getFullYear() === date.getFullYear() &&
        startDate.getMonth() === date.getMonth() &&
        startDate.getDate() === date.getDate()
      );
    });
  };

  // Get space color
  const getSpaceColor = (spaceId: string): string => {
    const space = spaces.find((s) => s.id === spaceId);
    return space?.color || '#4F46E5';
  };

  // Check if it's today
  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

  // Navigate month
  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentYear, currentMonth + (direction === 'next' ? 1 : -1), 1);
    setCurrentDate(newDate);
  };

  // Change to specific month and year
  const handleMonthChange = (month: number) => {
    setCurrentDate(new Date(currentYear, month, 1));
  };

  const handleYearChange = (year: number) => {
    setCurrentDate(new Date(year, currentMonth, 1));
  };

  // Generate calendar days (including empty cells for alignment)
  const calendarDays: (number | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Generate year options (current year ± 2 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Card className="overflow-hidden">
      {/* Header with month/year selector */}
      <div className="flex items-center justify-between p-4 border-b border-line bg-surface-muted">
        <button
          onClick={() => changeMonth('prev')}
          className="p-2 hover:bg-control-hover rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3">
          <select
            value={currentMonth}
            onChange={(e) => handleMonthChange(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm font-semibold border border-line bg-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MONTHS.map((month, index) => (
              <option key={index} value={index}>
                {month}
              </option>
            ))}
          </select>
          
          <select
            value={currentYear}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm font-semibold border border-line bg-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => changeMonth('next')}
          className="p-2 hover:bg-control-hover rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-ink-subtle py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dayReservations = getReservationsForDay(day);
            const hasReservations = dayReservations.length > 0;

            return (
              <div
                key={day}
                className={`aspect-square border rounded-lg p-2 cursor-pointer transition-all hover:shadow-md ${
                  isToday(day)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-line hover:border-indigo-300'
                }`}
                onClick={() => onSelectDay(new Date(currentYear, currentMonth, day))}
              >
                <div className="flex flex-col h-full">
                  {/* Day number */}
                  <div
                    className={`text-sm font-semibold mb-1 ${
                      isToday(day) ? 'text-indigo-600' : 'text-ink'
                    }`}
                  >
                    {day}
                  </div>

                  {/* Reservation indicators */}
                  {hasReservations && (
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {dayReservations.slice(0, 3).map((reservation) => {
                        const color = getSpaceColor(reservation.spaceId);
                        const borderStyle = reservation.status === 'Pending' ? 'dashed' : 'solid';
                        
                        return (
                          <div
                            key={reservation.id}
                            className="text-xs px-1 py-0.5 rounded border truncate"
                            style={{
                              backgroundColor: color + '20',
                              borderColor: color,
                              borderStyle: borderStyle,
                              borderWidth: '1px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectReservation(reservation);
                            }}
                          >
                            {new Date(reservation.startTime).toLocaleTimeString('pt-PT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        );
                      })}
                      {dayReservations.length > 3 && (
                        <div className="text-xs text-ink-subtle font-medium">
                          {t('calendar.moreEvents', { count: dayReservations.length - 3 })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-line bg-surface-muted flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 border-2 border-ink-subtle border-dashed rounded"></div>
          <span className="text-ink-muted">{t('calendar.legend.pending')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 border-2 border-ink-subtle border-solid rounded"></div>
          <span className="text-ink-muted">{t('calendar.legend.approved')}</span>
        </div>
      </div>
    </Card>
  );
}
