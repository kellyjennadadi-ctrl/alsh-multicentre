import { CalendrierView } from '@/tabs/EspaceTab';

export function CalendrierTab() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Calendrier</h1>
        <p className="text-sm text-gray-400">Mes activités & événements du centre</p>
      </div>
      <CalendrierView />
    </div>
  );
}
