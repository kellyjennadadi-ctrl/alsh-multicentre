import { useState } from 'react';
import { BookOpen, Calendar, MapPin } from 'lucide-react';
import type { AnimationSubTab } from '@/types';
import { ProjetTab } from '@/tabs/ProjetTab';
import { CalendrierTab } from '@/tabs/CalendrierTab';
import { SortieTab } from '@/tabs/SortieTab';

const subTabs: { key: AnimationSubTab; label: string; icon: typeof BookOpen }[] = [
  { key: 'projet', label: 'Projet pédagogique', icon: BookOpen },
  { key: 'calendrier', label: 'Agenda', icon: Calendar },
  { key: 'sorties', label: 'Sorties', icon: MapPin },
];

export function AnimationTab() {
  const [subTab, setSubTab] = useState<AnimationSubTab>('projet');

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Sub-tab selector */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-[#1E293B] mb-3">Animation</h1>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {subTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                subTab === key
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-200'
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="pt-2">
        {subTab === 'projet' && <ProjetTab />}
        {subTab === 'calendrier' && <CalendrierTab />}
        {subTab === 'sorties' && <SortieTab />}
      </div>
    </div>
  );
}
