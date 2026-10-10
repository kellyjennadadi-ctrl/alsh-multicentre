import { X } from 'lucide-react';
import { FilRougeView } from '@/tabs/EspaceTab';

export function ProjetTab() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Projet Pédagogique</h1>
        <p className="text-sm text-gray-400">Fil rouge annuel sur 5 périodes</p>
      </div>
      <FilRougeView />
    </div>
  );
}
