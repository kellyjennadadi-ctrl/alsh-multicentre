import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Clock,
  LogOut,
  Building2,
  Check as CheckIcon,
  Heart,
  X,
  Plus,
  Send,
  MessageSquare,
  Phone,
  AlertTriangle,
  User,
  Shield,
  ArrowLeft,
  Utensils,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  getInitials,
  getAge,
  getSectionLabel,
  getAvatarColor,
  getMinutesUntil,
  getAgeGroup,
  getAgeGroupLabel,
} from '@/utils/helpers';
import type { Child, TimeSlot, Section, SchoolClass, AppMode, AgeGroup } from '@/types';

interface PointageTabProps {
  children: Child[];
  onTogglePresent: (childId: string, slot: TimeSlot) => void;
  onMarkDeparted: (childId: string, slot: TimeSlot) => void;
  onMarkDepartedWithTime: (childId: string, slot: TimeSlot, time: string) => void;
  classes: SchoolClass[];
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  initialSlot?: TimeSlot;
  onBack?: () => void;
}

interface TransmissionRow {
  id: string;
  centre_nom: string;
  enfant_nom: string;
  note: string;
  animateur_nom: string;
  date_note: string;
  created_at: string;
}

const periSlots: { key: TimeSlot; label: string }[] = [
  { key: 'matin', label: 'Matin' },
  { key: 'midi', label: 'Midi' },
  { key: 'soir', label: 'Soir' },
  { key: 'mercredi', label: 'Mercredi' },
];

const extraSlots: { key: TimeSlot; label: string }[] = [
  { key: 'mercredi', label: 'Journee ALSH' },
];

const sectionFilters: { key: Section | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'PS', label: 'PS' },
  { key: 'MS', label: 'MS' },
  { key: 'GS', label: 'GS' },
];

const ageGroupFilters: { key: AgeGroup | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'petits', label: 'Petits (3-4 ans)' },
  { key: 'moyens', label: 'Moyens (5-6 ans)' },
  { key: 'grands', label: 'Grands (7+ ans)' },
];

const CARE_TYPES = ['Pansement', 'Arnica', 'Bosse', 'Desinfection', 'Paracetamol', 'Autre'];

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function PointageTab({ children, onTogglePresent, onMarkDeparted, onMarkDepartedWithTime, classes, mode, onModeChange, initialSlot, onBack }: PointageTabProps) {
  const { activeCentre, centres, profile } = useAuth();
  const [activeSlot, setActiveSlot] = useState<TimeSlot>(initialSlot || 'midi');
  const [sectionFilter, setSectionFilter] = useState<Section | 'all'>('all');
  const [psSubClass, setPsSubClass] = useState<string>('all');
  const [ageGroupFilter, setAgeGroupFilter] = useState<AgeGroup | 'all'>('all');
  const [showAlshModal, setShowAlshModal] = useState(false);
  const [alshCentre, setAlshCentre] = useState('');

  // PAI emergency drawer
  const [paiChild, setPaiChild] = useState<Child | null>(null);

  // Quick care form
  const [showCareForm, setShowCareForm] = useState(false);
  const [careChild, setCareChild] = useState<Child | null>(null);
  const [careType, setCareType] = useState('Pansement');
  const [careNote, setCareNote] = useState('');

  // Transmissions
  const [showTransmissions, setShowTransmissions] = useState(false);
  const [transmissionChild, setTransmissionChild] = useState<Child | null>(null);
  const [transmissionNote, setTransmissionNote] = useState('');
  const [transmissions, setTransmissions] = useState<TransmissionRow[]>([]);

  // Per-card quick memo
  const [cardMemos, setCardMemos] = useState<Record<string, string>>({});

  // Track which children have been "rendu aux maîtresses" (midi group validation)
  const [renduMaitresses, setRenduMaitresses] = useState<Set<string>>(new Set());

  // Departure time slots config per slot
  const soirDepartureTimes = ['16h30', '17h30', '18h00', '18h30'];
  const mercrediDepartureTimes = ['16h45', '17h30', '18h00', '18h30'];

  // Destinations de regroupement ALSH = les autres structures de la plateforme
  const alshCentres = centres.filter((c) => c.id !== activeCentre?.id).map((c) => c.name);

  const slotConfig = mode === 'peri' ? periSlots : extraSlots;
  const isMercredi = activeSlot === 'mercredi';
  const showDeparture = activeSlot === 'soir' || activeSlot === 'mercredi';
  const showClassOnCard = (activeSlot === 'midi' || activeSlot === 'soir') && mode === 'peri';
  const isMidi = activeSlot === 'midi';
  const isSoir = activeSlot === 'soir';
  const isMercrediSlot = activeSlot === 'mercredi';

  // For midi: no "Parti" status. For soir/mercredi: show departure buttons.
  const departureTimes = isSoir ? soirDepartureTimes : isMercrediSlot ? mercrediDepartureTimes : [];

  // Load animator count from DB
  const [dbAnimatorCount, setDbAnimatorCount] = useState(0);
  useEffect(() => {
    if (!activeCentre) return;
    const loadCount = async () => {
      const { data } = await supabase
        .from('animateurs')
        .select('id, present_today')
        .eq('centre_nom', activeCentre.name)
        .eq('present_today', true);
      setDbAnimatorCount(data?.length || 0);
    };
    loadCount();
    const ch = supabase
      .channel('pointage-animator-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animateurs', filter: 'centre_nom=eq.' + activeCentre.name }, () => loadCount())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCentre]);

  const filteredChildren = children.filter((c) => {
    if (mode === 'extra') {
      return ageGroupFilter === 'all' || getAgeGroup(c.birthDate) === ageGroupFilter;
    }
    if (sectionFilter !== 'all' && c.section !== sectionFilter) return false;
    if (sectionFilter !== 'all' && psSubClass !== 'all') {
      const selectedClass = classes.find((cl) => cl.id === psSubClass);
      if (selectedClass && c.classe !== selectedClass.name) return false;
    }
    return true;
  });

  const presentChildren = filteredChildren.filter((c) => c.present[activeSlot]);
  const absentChildren = filteredChildren.filter((c) => !c.present[activeSlot]);
  const partiCount = filteredChildren.filter((c) => !c.present[activeSlot] && showDeparture && c.departureTime).length;

  // Regulatory ratios per slot — computed after presentChildren is available
  const presentAnimatorsCountFinal = dbAnimatorCount;
  const slotRatios: Record<TimeSlot, number> = { matin: 10, midi: 14, soir: 10, mercredi: 8 };
  const slotRatioLabels: Record<TimeSlot, string> = { matin: 'Matin', midi: 'Midi', soir: 'Soir', mercredi: 'Mercredi' };
  const legalRatio = slotRatios[activeSlot] || 14;
  const slotRatioLabel = slotRatioLabels[activeSlot] || 'Midi';
  const requiredAnimatorsFinal = Math.ceil(presentChildren.length / legalRatio) || 0;
  const ratioStatusFinal = presentChildren.length === 0 || presentAnimatorsCountFinal >= requiredAnimatorsFinal ? 'ok' : 'warning';

  // Load + subscribe to transmissions
  useEffect(() => {
    if (!activeCentre) return;
    const centreNom = activeCentre.name;
    const today = getToday();

    const loadTransmissions = async () => {
      const { data } = await supabase
        .from('transmissions')
        .select('*')
        .eq('centre_nom', centreNom)
        .eq('date_note', today)
        .order('created_at', { ascending: false });
      if (data) setTransmissions(data as TransmissionRow[]);
    };

    loadTransmissions();

    const channel = supabase
      .channel('transmissions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transmissions', filter: 'centre_nom=eq.' + centreNom },
        (payload) => {
          const row = payload.new as TransmissionRow;
          if (!row || row.date_note !== today) return;
          setTransmissions((prev) => {
            if (prev.some((t) => t.id === row.id)) return prev;
            return [row, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCentre]);

  const handleSlotChange = (slot: TimeSlot) => {
    setActiveSlot(slot);
    if (slot === 'mercredi') setSectionFilter('all');
  };

  const handleModeToggle = () => {
    if (mode === 'peri') {
      setShowAlshModal(true);
    } else {
      onModeChange('peri');
      setActiveSlot('midi');
      setAgeGroupFilter('all');
    }
  };

  const handleAlshConfirm = () => {
    onModeChange('extra');
    setActiveSlot('mercredi');
    setSectionFilter('all');
    setPsSubClass('all');
    setAgeGroupFilter('all');
    setShowAlshModal(false);
  };

  const submitCare = () => {
    if (!careChild) return;
    // For now, just close -- the Sante tab has the full care record system
    setShowCareForm(false);
    setCareChild(null);
    setCareType('Pansement');
    setCareNote('');
  };

  const submitTransmission = async () => {
    if (!transmissionChild || !transmissionNote.trim() || !activeCentre) return;
    const animatorName = profile?.full_name || 'Animateur';
    await supabase.from('transmissions').insert({
      centre_nom: activeCentre.name,
      enfant_nom: transmissionChild.firstName + ' ' + transmissionChild.lastName,
      note: transmissionNote.trim(),
      animateur_nom: animatorName,
      date_note: getToday(),
    });
    setTransmissionNote('');
    setTransmissionChild(null);
  };

  const submitCardMemo = async (child: Child) => {
    const memo = (cardMemos[child.id] || '').trim();
    if (!memo || !activeCentre) return;
    const animatorName = profile?.full_name || 'Animateur';
    await supabase.from('transmissions').insert({
      centre_nom: activeCentre.name,
      enfant_nom: child.firstName + ' ' + child.lastName,
      note: memo,
      animateur_nom: animatorName,
      date_note: getToday(),
    });
    setCardMemos((prev) => ({ ...prev, [child.id]: '' }));
  };

  const handleRenduMaitresses = (classeName?: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const targets = presentChildren.filter((c) => !classeName || c.classe === classeName);
    for (const child of targets) {
      onMarkDepartedWithTime(child.id, activeSlot, timeStr);
      setRenduMaitresses((prev) => new Set(prev).add(child.id));
    }
  };

  const handleQuickDeparture = (child: Child, time: string) => {
    onMarkDepartedWithTime(child.id, activeSlot, time);
  };

  // Group present children by classe for midi group validation
  const presentByClasse: Record<string, Child[]> = {};
  if (isMidi) {
    for (const child of presentChildren) {
      const key = child.classe || 'Sans classe';
      if (!presentByClasse[key]) presentByClasse[key] = [];
      presentByClasse[key].push(child);
    }
  }

  const renderChildCard = (child: Child) => {
    const isPresent = child.present[activeSlot];
    const avatarColor = getAvatarColor(child.firstName + child.lastName);
    const minsUntil = showDeparture && child.departureTime && isPresent
      ? getMinutesUntil(child.departureTime)
      : null;
    const isDepartureSoon = minsUntil !== null && minsUntil >= 0 && minsUntil <= 10;
    const childTransmissions = transmissions.filter((t) => t.enfant_nom === child.firstName + ' ' + child.lastName);

    return (
      <div
        key={child.id}
        className={'bg-white rounded-2xl p-4 shadow-sm border transition-all duration-300 ' + (isPresent ? 'border-gray-50' : 'border-gray-50 opacity-60')}
      >
        <div className="flex items-center gap-3">
          <div className={'w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ' + avatarColor}>
            {getInitials(child.firstName, child.lastName)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 truncate">
                {child.firstName} {child.lastName}
              </p>
              {child.pai && (
                <button
                  onClick={() => setPaiChild(child)}
                  className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full flex items-center gap-1 active:scale-90 transition"
                >
                  <Heart size={10} className="text-orange-500" />
                  PAI - {child.pai.allergy}
                </button>
              )}
              {child.regime && !/^(standard|normal|aucun|sans)$/i.test(child.regime.trim()) && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <Utensils size={10} />
                  {child.regime}
                </span>
              )}
              {childTransmissions.length > 0 && (
                <button
                  onClick={() => { setTransmissionChild(child); setShowTransmissions(true); }}
                  className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full flex items-center gap-1 active:scale-90 transition"
                >
                  <MessageSquare size={10} />
                  {childTransmissions.length} note(s)
                </button>
              )}
            </div>
            {showClassOnCard ? (
              <p className="text-xs text-gray-400 mt-0.5">{child.classe} - {getAge(child.birthDate)} ans</p>
            ) : mode === 'extra' ? (
              <p className="text-xs text-gray-400 mt-0.5">{getAge(child.birthDate)} ans - {getAgeGroupLabel(getAgeGroup(child.birthDate))}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">{getAge(child.birthDate)} ans - {getSectionLabel(child.section)}</p>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { setCareChild(child); setShowCareForm(true); }}
              className="p-2 rounded-xl bg-rose-50 text-rose-500 active:scale-90 transition"
              title="Consigner un soin"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => onTogglePresent(child.id, activeSlot)}
              className={'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ' + (isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400')}
            >
              {isPresent ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  {isMidi ? 'Présent cantine' : mode === 'extra' ? 'Arrivé' : 'Présent'}
                </>
              ) : (
                'Absent'
              )}
            </button>
          </div>
        </div>

        {/* SOIR: Quick departure buttons */}
        {isSoir && isPresent && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1"><Clock size={13} /> Départ :</span>
              {departureTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => handleQuickDeparture(child, time)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg active:scale-95 transition hover:bg-blue-100"
                >
                  {time}
                </button>
              ))}
            </div>
            {child.pickupBy && (
              <p className="text-xs text-gray-400 mt-2">Retrait par : {child.pickupBy}</p>
            )}
          </div>
        )}

        {/* MERCREDI: Morning/Repas + afternoon departure buttons */}
        {isMercrediSlot && isPresent && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-semibold text-gray-400">Accueil :</span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg">Présent Matin</span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg">Repas</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1"><Clock size={13} /> Départ :</span>
              {departureTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => handleQuickDeparture(child, time)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg active:scale-95 transition hover:bg-blue-100"
                >
                  {time}
                </button>
              ))}
            </div>
            {child.pickupBy && (
              <p className="text-xs text-gray-400 mt-2">Retrait par : {child.pickupBy}</p>
            )}
          </div>
        )}

        {/* Legacy departure block (extra mode) */}
        {showDeparture && isPresent && child.departureTime && mode === 'extra' && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock size={15} className={isDepartureSoon ? 'text-orange-500' : 'text-gray-400'} />
                <span className="text-xs text-gray-500">
                  Depart prevu: <span className="font-semibold text-gray-700">{child.departureTime}</span>
                </span>
              </div>
              <button
                onClick={() => onMarkDeparted(child.id, activeSlot)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#2563EB] text-white text-xs font-bold rounded-lg active:scale-95 transition"
              >
                <LogOut size={13} />
                Parti
              </button>
            </div>
            {isDepartureSoon && (
              <div className="mt-2 flex items-center gap-1.5 text-orange-600 animate-pulse-ring rounded-lg px-2 py-1 bg-orange-50">
                <Clock size={14} />
                <span className="text-xs font-bold">Depart dans {minsUntil} min - preparer le depart</span>
              </div>
            )}
          </div>
        )}

        {/* Quick memo field */}
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
          <MessageSquare size={14} className="text-amber-400 flex-shrink-0" />
          <input
            value={cardMemos[child.id] || ''}
            onChange={(e) => setCardMemos((prev) => ({ ...prev, [child.id]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCardMemo(child);
            }}
            placeholder="Note rapide (depart avec mamie, incident, sieste...)"
            className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-700 outline-none focus:ring-1 ring-amber-200"
          />
          <button
            onClick={() => submitCardMemo(child)}
            disabled={!(cardMemos[child.id] || '').trim()}
            className="p-1.5 bg-amber-500 text-white rounded-lg active:scale-90 transition disabled:opacity-30 flex-shrink-0"
          >
            <Send size={13} />
          </button>
        </div>
        {childTransmissions.length > 0 && (
          <div className="mt-2 space-y-1">
            {childTransmissions.slice(0, 2).map((t) => (
              <div key={t.id} className="flex items-start gap-1.5 text-xs text-gray-500">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <span className="truncate">{t.note}</span>
                <span className="text-gray-300 flex-shrink-0 ml-auto">{new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-40">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:scale-95 transition"
              >
                <ArrowLeft size={18} className="text-gray-700" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pointage</h1>
              <p className="text-sm text-gray-400">
                {presentChildren.length} présents / {filteredChildren.length} enfants
              </p>
            </div>
          </div>
          <button
            className={'px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ' + (mode === 'peri' ? 'bg-[#2563EB] text-white' : 'bg-[#2563EB] text-white')}
            onClick={handleModeToggle}
          >
            {mode === 'peri' ? 'Periscolaire' : 'Extrascolaire'}
          </button>
        </div>

        {/* Time slot tabs */}
        <div className="flex gap-2">
          {slotConfig.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSlotChange(key)}
              className={'flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ' + (activeSlot === key ? 'bg-[#2563EB] text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Regulatory ratio banner */}
      <div className="px-5 mt-3">
        <div className={`rounded-2xl p-3.5 border ${ratioStatusFinal === 'ok' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2">
            <Shield size={16} className={ratioStatusFinal === 'ok' ? 'text-emerald-600' : 'text-red-600'} />
            <p className="text-xs font-bold text-gray-700">
              Taux réglementaire : 1 pour {legalRatio} ({slotRatioLabel})
            </p>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-500">
              {presentAnimatorsCountFinal} anim. · {presentChildren.length} enfants · {requiredAnimatorsFinal} requis
            </p>
            {ratioStatusFinal === 'ok' ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">Conforme</span>
            ) : (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                Sous-effectif : manque {requiredAnimatorsFinal - presentAnimatorsCountFinal}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      {mode === 'peri' && (
        <div className="px-5 pt-4 space-y-2">
          {/* Line 2: Section filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {sectionFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setSectionFilter(key as Section | 'all'); setPsSubClass('all'); }}
                className={'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ' + (sectionFilter === key ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Line 3: Dynamic sub-class filters for the selected level */}
          {(() => {
            const levelClasses = classes.filter((cl) => cl.level === sectionFilter);
            if (levelClasses.length === 0) return null;
            return (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setPsSubClass('all')}
                  className={'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ' + (psSubClass === 'all' ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
                >
                  Toutes
                </button>
                {levelClasses.map((cl) => (
                  <button
                    key={cl.id}
                    onClick={() => setPsSubClass(cl.id)}
                    className={'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ' + (psSubClass === cl.id ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
                  >
                    {cl.name}{cl.teacherName ? ' · ' + cl.teacherName : ''}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {mode === 'extra' && (
        <div className="px-5 pt-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {ageGroupFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setAgeGroupFilter(key as AgeGroup | 'all')}
                className={'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ' + (ageGroupFilter === key ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions row */}
      <div className="px-5 mt-4 flex gap-2">
        <button
          onClick={() => { setCareChild(null); setShowCareForm(true); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 active:scale-95 transition"
        >
          <Plus size={14} />
          Consigner un soin
        </button>
        <button
          onClick={() => { setTransmissionChild(null); setShowTransmissions(true); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-xl border border-amber-200 active:scale-95 transition"
        >
          <MessageSquare size={14} />
          Transmissions ({transmissions.length})
        </button>
      </div>

      {/* Present block */}
      <div className="px-5 mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
            {isMidi ? 'Présents cantine' : mode === 'extra' ? 'Arrivés' : 'Présents'} ({presentChildren.length})
          </p>
        </div>

        {/* MIDI: "Rendu aux maîtresses" group validation buttons by class */}
        {isMidi && presentChildren.length > 0 && Object.keys(presentByClasse).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">
            <p className="text-xs font-bold text-amber-700 uppercase">Rendu aux maîtresses</p>
            <p className="text-xs text-amber-600">Valide la fin de pause et horodate par classe</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(presentByClasse).map(([classe, kids]) => (
                <button
                  key={classe}
                  onClick={() => handleRenduMaitresses(classe)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl active:scale-95 transition shadow-sm"
                >
                  <Check size={14} />
                  {classe} ({kids.length})
                </button>
              ))}
              <button
                onClick={() => handleRenduMaitresses()}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] text-white text-xs font-bold rounded-xl active:scale-95 transition shadow-sm"
              >
                <Check size={14} />
                Toutes les classes
              </button>
            </div>
          </div>
        )}

        {presentChildren.map(renderChildCard)}
        {presentChildren.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Aucun enfant présent</p>
          </div>
        )}
      </div>

      {/* Absent separator */}
      {absentChildren.length > 0 && (
        <div className="px-5 mt-5">
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-3 py-1 bg-gray-200 text-gray-500 text-xs font-bold rounded-full">
              Absents ({absentChildren.length})
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>
      )}

      {/* Absent block */}
      <div className="px-5 mt-3 space-y-3">
        {absentChildren.map(renderChildCard)}
      </div>

      {/* Fixed counter bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30">
        <div className="max-w-lg mx-auto px-5">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 flex items-center justify-around">
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-gray-900">{filteredChildren.length}</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Inscrits</p>
            </div>
            <div className="w-px h-10 bg-gray-100" />
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-emerald-600">{presentChildren.length}</p>
              <p className="text-[10px] font-semibold text-emerald-500 uppercase">Presents</p>
            </div>
            <div className="w-px h-10 bg-gray-100" />
            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-[#2563EB]">{showDeparture ? partiCount : 0}</p>
              <p className="text-[10px] font-semibold text-blue-500 uppercase">Partis</p>
            </div>
          </div>
        </div>
      </div>

      {/* PAI emergency drawer */}
      <Modal open={!!paiChild} onClose={() => setPaiChild(null)} title={paiChild ? 'Fiche urgence - ' + paiChild.firstName + ' ' + paiChild.lastName : ''}>
        {paiChild?.pai && (
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center">
                <Heart size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-600 uppercase">Allergie</p>
                <p className="text-sm font-bold text-orange-800">{paiChild.pai.allergy}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Protocole de soin</p>
              <p className="text-sm text-gray-700 leading-relaxed">{paiChild.pai.protocol}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Contact d urgence</p>
              <p className="text-sm font-bold text-gray-900">{paiChild.pai.emergencyContact}</p>
              <a href={'tel:' + paiChild.pai.emergencyPhone.replace(/\s/g, '')} className="flex items-center gap-2 mt-2 text-[#2563EB] font-semibold text-sm">
                <Phone size={16} />
                {paiChild.pai.emergencyPhone}
              </a>
            </div>
            <a href="tel:15" className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-500 text-white font-bold rounded-2xl active:scale-95 transition">
              <Phone size={18} />
              Appeler le SAMU - 15
            </a>
          </div>
        )}
      </Modal>

      {/* Quick care form */}
      <Modal open={showCareForm} onClose={() => setShowCareForm(false)} title="Consigner un soin">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Enfant</label>
            {careChild ? (
              <div className="mt-1 flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-xl">
                <div className={'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ' + getAvatarColor(careChild.firstName + careChild.lastName)}>
                  {getInitials(careChild.firstName, careChild.lastName)}
                </div>
                <p className="text-sm font-bold text-gray-900">{careChild.firstName} {careChild.lastName}</p>
              </div>
            ) : (
              <select
                onChange={(e) => {
                  const c = children.find((ch) => ch.id === e.target.value);
                  if (c) setCareChild(c);
                }}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-rose-200"
              >
                <option value="">Selectionner un enfant</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Type de soin</label>
            <div className="flex gap-2 flex-wrap mt-2">
              {CARE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCareType(t)}
                  className={'px-3 py-2 rounded-xl text-xs font-bold transition ' + (careType === t ? 'bg-rose-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Note (optionnel)</label>
            <input
              value={careNote}
              onChange={(e) => setCareNote(e.target.value)}
              placeholder="Ex: genou gauche, petit saignement"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-rose-200"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock size={14} />
            Heure auto: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <User size={14} />
            Animateur: {profile?.full_name || 'Non precise'}
          </div>
          <button
            onClick={submitCare}
            disabled={!careChild}
            className="w-full py-3.5 bg-rose-500 text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-md shadow-rose-200"
          >
            Enregistrer le soin
          </button>
        </div>
      </Modal>

      {/* Transmissions modal */}
      <Modal open={showTransmissions} onClose={() => setShowTransmissions(false)} title="Cahier de transmissions">
        <div className="space-y-4">
          {/* New note form */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Enfant concerne</label>
              {transmissionChild ? (
                <div className="mt-1 flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-bold text-gray-900">{transmissionChild.firstName} {transmissionChild.lastName}</p>
                  <button onClick={() => setTransmissionChild(null)} className="ml-auto p-1 text-gray-400">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <select
                  onChange={(e) => {
                    const c = children.find((ch) => ch.id === e.target.value);
                    if (c) setTransmissionChild(c);
                  }}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-amber-200"
                  value={(transmissionChild as Child | null)?.id || ''}
                >
                  <option value="">Tous les enfants</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Note rapide</label>
              <div className="flex gap-2 mt-1">
                <input
                  value={transmissionNote}
                  onChange={(e) => setTransmissionNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitTransmission()}
                  placeholder="Ex: A pleure a la sieste, pris par la grand-mere..."
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-amber-200"
                />
                <button
                  onClick={submitTransmission}
                  disabled={!transmissionNote.trim() || !transmissionChild}
                  className="p-3 bg-amber-500 text-white rounded-xl active:scale-90 transition disabled:opacity-40 flex-shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="pt-2 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Historique du jour</p>
            {transmissions.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-4">Aucune transmission pour le moment</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {transmissions.map((t) => (
                  <div key={t.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-700">{t.enfant_nom}</span>
                      <span className="text-[10px] text-gray-400">{t.animateur_nom}</span>
                    </div>
                    <p className="text-sm text-gray-600">{t.note}</p>
                    <p className="text-[10px] text-gray-300 mt-1">
                      {new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ALSH config modal */}
      {showAlshModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setShowAlshModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-[slideUp_0.3s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-bold text-gray-900">Configuration ALSH Vacances</h2>
              <button onClick={() => setShowAlshModal(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Building2 size={32} className="text-[#2563EB]" />
                </div>
                <p className="text-sm text-gray-500 text-center">Selectionnez le centre de regroupement pour la periode de vacances.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Centre de regroupement</label>
                <div className="mt-2 space-y-2">
                  {alshCentres.map((centre) => (
                    <button
                      key={centre}
                      onClick={() => setAlshCentre(centre)}
                      className={'w-full flex items-center justify-between gap-3 py-3 px-4 rounded-2xl border-2 transition active:scale-[0.98] ' + (alshCentre === centre ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-100')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + (alshCentre === centre ? 'bg-[#2563EB]' : 'bg-gray-200')}>
                          <Building2 size={18} className={alshCentre === centre ? 'text-white' : 'text-gray-400'} />
                        </div>
                        <p className={'text-sm font-bold text-left ' + (alshCentre === centre ? 'text-blue-800' : 'text-gray-500')}>{centre}</p>
                      </div>
                      {alshCentre === centre && (
                        <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                          <CheckIcon size={14} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 rounded-2xl p-3">
                <p className="text-xs text-blue-700">En mode Extrascolaire, le pointage se fait sur la journee complete. Les filtres par classes sont remplaces par les tranches d age du centre.</p>
              </div>
              <button onClick={handleAlshConfirm} className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-blue-200">
                Activer le mode ALSH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
