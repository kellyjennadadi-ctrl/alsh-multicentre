import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateFR, isSameDay, getWeekDays } from '@/utils/helpers';

interface WeekRibbonProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

export function WeekRibbon({ selectedDate, onSelectDate }: WeekRibbonProps) {
  const days = getWeekDays(selectedDate);
  const today = new Date();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          const d = new Date(days[0]);
          d.setDate(d.getDate() - 7);
          onSelectDate(d);
        }}
        className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="flex-1 flex gap-1.5 justify-between overflow-x-auto scrollbar-hide">
        {days.map((day, i) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-2xl min-w-[58px] transition-all duration-200 ${
                isSelected
                  ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-300 scale-105'
                  : 'bg-white text-gray-600 hover:bg-blue-50 border border-gray-100'
              }`}
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  isSelected ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {dayLabels[i]}
              </span>
              <span className="text-lg font-bold mt-0.5">{day.getDate()}</span>
              {isToday && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-1" />
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => {
          const d = new Date(days[0]);
          d.setDate(d.getDate() + 7);
          onSelectDate(d);
        }}
        className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
