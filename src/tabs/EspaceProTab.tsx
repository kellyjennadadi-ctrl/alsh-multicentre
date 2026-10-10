import { useState } from 'react';
import { Shield, Wrench, UserCircle, Lock, Building2 } from 'lucide-react';
import type { EspaceProSubTab, Child } from '@/types';
import { DirectionTab } from '@/tabs/DirectionTab';
import { OutilsTab } from '@/tabs/OutilsTab';
import { CompteTab } from '@/tabs/CompteTab';
import { PinLockScreen } from '@/components/PinLockScreen';

const subTabs: { key: EspaceProSubTab; label: string; icon: typeof Shield }[] = [
  { key: 'direction', label: 'Direction', icon: Building2 },
  { key: 'outils', label: 'Exports / Outils', icon: Wrench },
  { key: 'compte', label: 'Compte', icon: UserCircle },
];

interface EspaceProTabProps {
  children: Child[];
  onChildrenChange: (children: Child[]) => void;
  centrePin: string;
}

export function EspaceProTab({ children, onChildrenChange, centrePin }: EspaceProTabProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [subTab, setSubTab] = useState<EspaceProSubTab>('direction');

  if (!unlocked) {
    return (
      <PinLockScreen
        expectedPin={centrePin}
        onUnlock={() => setUnlocked(true)}
        onBack={() => { /* stay on tab; bottom nav handles switching */ }}
      />
    );
  }

  if (subTab === 'direction') {
    return (
      <div className="relative">
        <div className="absolute top-3 right-3 z-50 flex gap-2">
          <SubTabButtons subTab={subTab} setSubTab={setSubTab} />
          <button
            onClick={() => setUnlocked(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] text-white text-xs font-bold rounded-xl active:scale-95 transition shadow-lg"
          >
            <Lock size={14} />
            Verrouiller
          </button>
        </div>
        <DirectionTab
          children={children}
          onExit={() => setSubTab('outils')}
          onChildrenChange={onChildrenChange}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#0F172A] flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1E293B]">Espace Pro</h1>
              <p className="text-xs text-gray-400">Réservé à la direction</p>
            </div>
          </div>
          <button
            onClick={() => setUnlocked(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] text-white text-xs font-bold rounded-xl active:scale-95 transition shadow-lg"
          >
            <Lock size={14} />
            Verrouiller
          </button>
        </div>

        {/* Sub-tab selector */}
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
        {subTab === 'outils' && <OutilsTab />}
        {subTab === 'compte' && <CompteTab />}
      </div>
    </div>
  );
}

function SubTabButtons({ subTab, setSubTab }: { subTab: EspaceProSubTab; setSubTab: (t: EspaceProSubTab) => void }) {
  return (
    <div className="flex gap-1.5">
      {subTabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setSubTab(key)}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === key
              ? 'bg-white text-[#2563EB] shadow-md'
              : 'bg-white/10 text-white/60'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
