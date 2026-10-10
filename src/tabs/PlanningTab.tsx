import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  CalendarDays,
  Users,
  HeartPulse,
  Stethoscope,
  Sun,
  Moon,
  Calendar,
  Building2,
  Check,
  ArrowLeft,
  Sunrise,
} from 'lucide-react';
import { WeekRibbon } from '@/components/WeekRibbon';
import { Modal } from '@/components/Modal';
import {
  getPresentCount,
  getPresentCountBySection,
  getPresentCountByAgeGroup,
  getPaiChildren,
  getSectionLabel,
  getAgeGroupLabel,
  getAgeGroup,
  formatDateLong,
  isSameDay,
} from '@/utils/helpers';
import { useAuth } from '@/lib/auth';
import type { Section, TabKey, TimeSlot, Child, AppMode, AgeGroup } from '@/types';

interface PlanningTabProps {
  onNavigate: (tab: TabKey) => void;
  children: Child[];
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onOpenPointage: (slot: TimeSlot) => void;
}

const sectionConfig: { key: Section; label: string; short: string; color: string; bg: string }[] = [
  { key: 'PS', label: 'Petite Section', short: 'PS', color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'MS', label: 'Moyenne Section', short: 'MS', color: 'text-sky-600', bg: 'bg-sky-50' },
  { key: 'GS', label: 'Grande Section', short: 'GS', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

const ageGroupConfig: { key: AgeGroup; label: string; short: string; color: string; bg: string }[] = [
  { key: 'petits', label: 'Petits (3-4 ans)', short: 'Petits', color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'moyens', label: 'Moyens (5-6 ans)', short: 'Moyens', color: 'text-sky-600', bg: 'bg-sky-50' },
  { key: 'grands', label: 'Grands (7+ ans)', short: 'Grands', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

const periSlots: { key: TimeSlot; label: string; icon: typeof Sun }[] = [
  { key: 'midi', label: 'Midi', icon: Sun },
  { key: 'soir', label: 'Soir', icon: Moon },
  { key: 'mercredi', label: 'Mercredi / Vacances', icon: Calendar },
];

const extraSlots: { key: TimeSlot; label: string; icon: typeof Sun }[] = [
  { key: 'mercredi', label: 'Journée ALSH', icon: Sun },
];


export function PlanningTab({ onNavigate, children, mode, onModeChange, onOpenPointage }: PlanningTabProps) {
  const { activeCentre, centres, clearActiveCentre } = useAuth();
  const centerName = activeCentre?.name || 'Accueil Loisirs';
  // Destinations de regroupement ALSH = les autres structures de la plateforme
  const alshCentres = centres.filter((c) => c.id !== activeCentre?.id).map((c) => c.name);
  const otherCentres = centres.filter((c) => c.id !== activeCentre?.id);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [centerDropdownOpen, setCenterDropdownOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('midi');
  const [showAlshModal, setShowAlshModal] = useState(false);
  const [alshCentre, setAlshCentre] = useState(alshCentres[0] || '');

  const isToday = isSameDay(selectedDate, new Date());
  const totalPresent = getPresentCount(children, activeSlot);
  const sectionCounts = getPresentCountBySection(children, activeSlot);
  const ageGroupCounts = getPresentCountByAgeGroup(children, activeSlot);
  const paiChildren = getPaiChildren(children, activeSlot);

  const slotConfig = mode === 'peri' ? periSlots : extraSlots;
  const activeSlotLabel = slotConfig.find((s) => s.key === activeSlot)?.label || '';

  const handleModeToggle = () => {
    if (mode === 'peri') {
      setShowAlshModal(true);
    } else {
      onModeChange('peri');
      setActiveSlot('midi');
    }
  };

  const handleAlshConfirm = () => {
    onModeChange('extra');
    setActiveSlot('mercredi');
    setShowAlshModal(false);
  };

  const handleSlotChange = (slot: TimeSlot) => {
    setActiveSlot(slot);
  };

  const tiles = mode === 'peri' ? sectionConfig : ageGroupConfig;
  const tileCounts = mode === 'peri' ? sectionCounts : ageGroupCounts;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="relative">
            <button
              onClick={() => setCenterDropdownOpen(!centerDropdownOpen)}
              className="flex items-center gap-2 text-gray-700"
            >
              <div>
                <p className="text-xs text-gray-400 font-medium">Centre actif</p>
                <p className="text-sm font-bold flex items-center gap-1">
                  {centerName}
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${centerDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </p>
              </div>
            </button>
            {centerDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-xl py-2 min-w-[240px] z-50 border border-gray-100">
                <div className="px-4 py-2 text-sm font-semibold text-[#2563EB] bg-blue-50 rounded-xl mx-2">
                  {centerName}
                </div>
                {otherCentres.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCenterDropdownOpen(false); clearActiveCentre(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    {c.name}
                  </button>
                ))}
                <button
                  onClick={() => { setCenterDropdownOpen(false); clearActiveCentre(); }}
                  className="w-full text-left px-4 py-2 text-sm text-[#2563EB] font-semibold hover:bg-gray-50"
                >
                  Changer de structure / ajouter…
                </button>
              </div>
            )}
          </div>
          <button
            className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
              mode === 'peri'
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#2563EB] text-white'
            }`}
            onClick={handleModeToggle}
          >
            {mode === 'peri' ? 'Mode Périscolaire' : 'Mode Extrascolaire'}
          </button>
        </div>

        {/* Week Ribbon */}
        <WeekRibbon selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </div>

      {/* Date label */}
      <div className="px-5 pt-5">
        <p className="text-sm font-semibold text-gray-500 flex items-center gap-1.5 capitalize">
          <CalendarDays size={16} className="text-blue-500" />
          {formatDateLong(selectedDate)}
        </p>
      </div>

      {/* Slot selector */}
      <div className="px-5 mt-3">
        <div className="flex gap-2">
          {slotConfig.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleSlotChange(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all ${
                activeSlot === key
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-200'
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              <Icon size={15} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Total present card */}
      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Users size={24} className="text-[#2563EB]" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Enfants présents aujourd'hui</p>
                <p className="text-3xl font-bold text-gray-900">{totalPresent}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Total inscrits</p>
              <p className="text-lg font-semibold text-gray-600">{children.length}</p>
            </div>
          </div>

          {/* Active slot indicator */}
          <div className="mb-4 -mt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
              <span className="text-xs font-semibold text-[#2563EB]">
                Effectif actif : {activeSlotLabel}
              </span>
            </div>
          </div>

          {/* Section/age-group tiles — direct pointage */}
          <div className="grid grid-cols-3 gap-3">
            {tiles.map(({ key, label, short, color, bg }) => (
              <button
                key={key}
                onClick={() => onOpenPointage(activeSlot)}
                className={`${bg} rounded-2xl p-3.5 text-left transition-all duration-200 active:scale-95 hover:shadow-md`}
              >
                <p className={`text-xs font-bold ${color}`}>{short}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {tileCounts[key as keyof typeof tileCounts]}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PAI Alert */}
      {paiChildren.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 animate-blink-alert">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-800">
                  {paiChildren.length} enfant{paiChildren.length > 1 ? 's' : ''} PAI présent{paiChildren.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {paiChildren.map((c) => `${c.firstName} (${c.pai!.allergy})`).join(', ')}
                </p>
              </div>
              <button
                onClick={() => onNavigate('sante')}
                className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl active:scale-95 transition"
              >
                Fiches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions rapides</p>
        <div className="grid grid-cols-3 gap-3">            <button
              onClick={() => onNavigate('sante')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex flex-col items-start gap-2 active:scale-95 transition hover:shadow-md">
        
            
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Fiche urgence</p>
                <p className="text-xs text-gray-400">PDF / Protocoles</p>
              </div>
            </button>

          <button
            onClick={() => onNavigate('sante')}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex flex-col items-start gap-2 active:scale-95 transition hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Stethoscope size={20} className="text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Déclarer un soin</p>
              <p className="text-xs text-gray-400">Bobologie du jour</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate('sante')}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex flex-col items-start gap-2 active:scale-95 transition hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <HeartPulse size={20} className="text-[#2563EB]" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Fiches PAI</p>
              <p className="text-xs text-gray-400">Protocoles d'urgence</p>
            </div>
          </button>
        </div>
      </div>

      {/* Today's overview */}
      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Aperçu de la journée
          </p>
          <div className="space-y-2.5">
            {children
              .filter((c) => c.present[activeSlot])
              .slice(0, 5)
              .map((child) => (
                <div key={child.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-[#2563EB]">
                    {child.firstName[0]}
                    {child.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {child.firstName} {child.lastName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {mode === 'peri'
                        ? getSectionLabel(child.section)
                        : getAgeGroupLabel(getAgeGroup(child.birthDate))}
                    </p>
                  </div>
                  {child.pai && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">
                      PAI
                    </span>
                  )}
                </div>
              ))}
            {children.filter((c) => c.present[activeSlot]).length > 5 && (
              <button
                onClick={() => onOpenPointage(activeSlot)}
                className="w-full text-center text-xs text-[#2563EB] font-semibold py-2"
              >
                Voir tous les enfants ({children.filter((c) => c.present[activeSlot]).length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ALSH Vacances config modal */}
      <Modal open={showAlshModal} onClose={() => setShowAlshModal(false)} title="Configuration ALSH Vacances">
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Building2 size={32} className="text-[#2563EB]" />
            </div>
            <p className="text-sm text-gray-500 text-center">
              Vous passez en mode Extrascolaire (vacances). Sélectionnez le centre de regroupement pour cette période.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Centre de regroupement</label>
            <div className="mt-2 space-y-2">
              {alshCentres.map((centre) => (
                <button
                  key={centre}
                  onClick={() => setAlshCentre(centre)}
                  className={`w-full flex items-center justify-between gap-3 py-3 px-4 rounded-2xl border-2 transition active:scale-[0.98] ${
                    alshCentre === centre
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      alshCentre === centre ? 'bg-[#2563EB]' : 'bg-gray-200'
                    }`}>
                      <Building2 size={18} className={alshCentre === centre ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <p className={`text-sm font-bold text-left ${
                      alshCentre === centre ? 'text-blue-800' : 'text-gray-500'
                    }`}>
                      {centre}
                    </p>
                  </div>
                  {alshCentre === centre && (
                    <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-3">
            <p className="text-xs text-blue-700">
              En mode Extrascolaire, le pointage se fait sur la journée complète (arrivée matin / départs soir).
              Les filtres par classes scolaires sont remplacés par les tranches d'âge du centre.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAlshModal(false)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-gray-500 font-bold rounded-2xl active:scale-95 transition"
            >
              <ArrowLeft size={18} />
              Annuler
            </button>
            <button
              onClick={handleAlshConfirm}
              className="flex-1 py-3.5 bg-gradient-to-r bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-blue-200"
            >
              Activer le mode ALSH
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
