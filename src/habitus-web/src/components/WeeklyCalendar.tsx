import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { ReservationDto, SharedSpaceDto } from '../types';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import { Card } from './ui';

interface WeeklyCalendarProps {
  reservations: ReservationDto[];
  spaces: SharedSpaceDto[];
  currentWeekStart: Date;
  onWeekChange: (direction: 'prev' | 'next') => void;
  onSelectSlot: (date: Date, hour: number) => void;
  onSelectReservation: (reservation: ReservationDto) => void;
}

type HourZoom = 'commercial' | 'evening' | 'full';

const HOUR_RANGES: Record<HourZoom, { start: number; end: number }> = {
  commercial: { start: 8, end: 18 },
  evening: { start: 18, end: 24 },
  full: { start: 8, end: 24 },
};

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

interface ReservationWithLayout extends ReservationDto {
  column: number;
  totalColumns: number;
}

export default function WeeklyCalendar({
  reservations,
  spaces,
  currentWeekStart,
  onWeekChange,
  onSelectSlot,
  onSelectReservation,
}: WeeklyCalendarProps) {
  const { t } = useTranslation();
  const DAYS = useMemo(() => buildDays(t), [t]);
  const [hourZoom, setHourZoom] = useState<HourZoom>('full');

  const hourRange = HOUR_RANGES[hourZoom];
  const HOURS = Array.from(
    { length: hourRange.end - hourRange.start },
    (_, i) => i + hourRange.start
  );

  // Generate 7 days starting from currentWeekStart
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  // Filter only Pending and Approved reservations
  const visibleReservations = reservations.filter(
    (r) => r.status === 'Pending' || r.status === 'Approved'
  );

  // Get space color and name
  const getSpaceInfo = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId);
    return {
      color: space?.color || '#4F46E5',
      name: space?.name || t('calendar.unknownSpace'),
    };
  };

  // Check if two reservations overlap
  const overlaps = (r1: ReservationDto, r2: ReservationDto): boolean => {
    const start1 = new Date(r1.startTime).getTime();
    const end1 = new Date(r1.endTime).getTime();
    const start2 = new Date(r2.startTime).getTime();
    const end2 = new Date(r2.endTime).getTime();
    
    return start1 < end2 && start2 < end1;
  };

  // Calculate layout for overlapping reservations
  const calculateLayout = (dayReservations: ReservationDto[]): ReservationWithLayout[] => {
    if (dayReservations.length === 0) return [];
    
    // Sort by start time
    const sorted = [...dayReservations].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    const result: ReservationWithLayout[] = [];
    const columns: ReservationDto[][] = [];
    
    for (const reservation of sorted) {
      // Find a column where this reservation doesn't overlap with any existing reservation
      let placed = false;
      
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex];
        const hasOverlap = column.some(r => overlaps(r, reservation));
        
        if (!hasOverlap) {
          column.push(reservation);
          placed = true;
          break;
        }
      }
      
      // If no suitable column found, create a new one
      if (!placed) {
        columns.push([reservation]);
      }
    }
    
    // Now assign column positions
    const totalColumns = columns.length;
    
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const reservation of columns[colIndex]) {
        result.push({
          ...reservation,
          column: colIndex,
          totalColumns,
        });
      }
    }
    
    return result;
  };

  // Check if reservation is in this day
  const getReservationsForDay = (date: Date): ReservationWithLayout[] => {
    const dayReservations = visibleReservations.filter((r) => {
      const startDate = new Date(r.startTime);
      return (
        startDate.getFullYear() === date.getFullYear() &&
        startDate.getMonth() === date.getMonth() &&
        startDate.getDate() === date.getDate()
      );
    });
    
    return calculateLayout(dayReservations);
  };

  // Calculate position and height of reservation block
  const getBlockStyle = (reservation: ReservationWithLayout) => {
    const start = new Date(reservation.startTime);
    const end = new Date(reservation.endTime);
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    const totalHours = hourRange.end - hourRange.start;
    
    // Position relative to zoom range
    const top = ((startHour - hourRange.start) / totalHours) * 100;
    const height = ((endHour - startHour) / totalHours) * 100;
    
    const spaceInfo = getSpaceInfo(reservation.spaceId);
    const borderStyle = reservation.status === 'Pending' ? 'dashed' : 'solid';
    
    // Calculate horizontal position for overlapping events
    const columnWidth = 100 / reservation.totalColumns;
    const left = columnWidth * reservation.column;
    const width = columnWidth;
    
    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.max(5, height)}%`,
      left: `${left}%`,
      width: `${width}%`,
      backgroundColor: spaceInfo.color,
      borderColor: spaceInfo.color,
      borderStyle,
      spaceName: spaceInfo.name,
    };
  };

  const formatDateHeader = (date: Date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day}/${month}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  return (
    <Card className="overflow-hidden">
      {/* Header with navigation and zoom */}
      <div className="flex items-center justify-between p-4 border-b border-line bg-surface-muted">
        <button
          onClick={() => onWeekChange('prev')}
          className="p-2 hover:bg-control-hover rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <h3 className="font-semibold text-ink">
            {formatDateHeader(weekDays[0])} - {formatDateHeader(weekDays[6])}
          </h3>
          <p className="text-sm text-ink-subtle">
            {weekDays[0].toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Hour Zoom Selector */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-ink-subtle" />
          <select
            value={hourZoom}
            onChange={(e) => setHourZoom(e.target.value as HourZoom)}
            className="px-3 py-1.5 text-sm border border-line bg-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="commercial">{t('calendar.hourRange.commercial')}</option>
            <option value="evening">{t('calendar.hourRange.evening')}</option>
            <option value="full">{t('calendar.hourRange.full')}</option>
          </select>
        </div>
        
        <button
          onClick={() => onWeekChange('next')}
          className="p-2 hover:bg-control-hover rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Days header */}
          <div className="grid grid-cols-8 border-b border-line">
            <div className="p-2 text-xs font-medium text-ink-subtle text-center border-r border-line">
              {t('calendar.hourHeader')}
            </div>
            {weekDays.map((date, i) => (
              <div
                key={i}
                className={`p-2 text-center border-r border-line ${
                  isToday(date) ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="text-xs font-medium text-ink-subtle">{DAYS[date.getDay()]}</div>
                <div
                  className={`text-sm font-semibold ${
                    isToday(date) ? 'text-indigo-600' : 'text-ink'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-line h-16">
                <div className="p-2 text-xs text-ink-subtle text-center border-r border-line flex items-center justify-center">
                  {hour}:00
                </div>
                {weekDays.map((date, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`border-r border-line hover:bg-surface-hover cursor-pointer transition-colors relative ${
                      isToday(date) ? 'bg-indigo-50/30' : ''
                    }`}
                    onClick={() => onSelectSlot(date, hour)}
                  >
                    {/* Reservations for this hour will be absolutely positioned */}
                  </div>
                ))}
              </div>
            ))}

            {/* Reservation blocks - absolutely positioned with overlap handling */}
            {weekDays.map((date, dayIndex) => {
              const dayReservations = getReservationsForDay(date);
              return (
                <div
                  key={dayIndex}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    left: `${((dayIndex + 1) / 8) * 100}%`,
                    width: `${(1 / 8) * 100}%`,
                  }}
                >
                  {dayReservations.map((reservation) => {
                    const blockStyle = getBlockStyle(reservation);
                    return (
                      <div
                        key={reservation.id}
                        className="absolute rounded-lg border-2 p-1 overflow-hidden cursor-pointer pointer-events-auto shadow-sm hover:shadow-md transition-shadow"
                        style={{
                          top: blockStyle.top,
                          height: blockStyle.height,
                          left: blockStyle.left,
                          width: `calc(${blockStyle.width} - 4px)`,
                          backgroundColor: blockStyle.backgroundColor + '20',
                          borderColor: blockStyle.borderColor,
                          borderStyle: blockStyle.borderStyle,
                          minHeight: '2rem',
                        }}
                        onClick={() => onSelectReservation(reservation)}
                      >
                        <div className="text-xs font-medium truncate" style={{ color: blockStyle.borderColor }}>
                          {blockStyle.spaceName}
                        </div>
                        <div className="text-xs text-ink-muted truncate">
                          {new Date(reservation.startTime).toLocaleTimeString('pt-PT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' - '}
                          {new Date(reservation.endTime).toLocaleTimeString('pt-PT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
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
