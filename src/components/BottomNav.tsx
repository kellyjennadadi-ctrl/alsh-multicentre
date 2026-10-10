import { Calendar, Sparkles, HeartPulse, Shield } from 'lucide-react';
import type { TabKey } from '@/types';

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const tabs: { key: TabKey; label: string; icon: typeof Calendar }[] = [
  { key: 'aujourdhui', label: "Aujourd'hui", icon: Calendar },
  { key: 'animation', label: 'Animation', icon: Sparkles },
  { key: 'sante', label: 'Santé', icon: HeartPulse },
  { key: 'espacepro', label: 'Espace Pro', icon: Shield },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex flex-col items-center justify-center py-2.5 gap-1 transition-all duration-200 ${
                active ? 'text-[#2563EB]' : 'text-gray-400'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  active ? 'bg-blue-100 scale-110' : 'bg-transparent'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  active ? 'text-[#2563EB]' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
