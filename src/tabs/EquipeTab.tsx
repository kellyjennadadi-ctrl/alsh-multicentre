// NOTE : le fichier collé contenait EquipeTab, pas PointageTab. Ce composant est donc
// reconstruit à partir des types et conventions de EquipeTab (Child, SchoolClass, supabase, useAuth).
// Si vos champs Child diffèrent (nom, classe, présence), adaptez UNIQUEMENT les 3 helpers
// childName / childClassId / initialPresence ci-dessous.

import { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Moon,
  CalendarDays,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Users,
  Shield,
  Check,
  DoorOpen,
  School,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Child, SchoolClass } from '@/types';

interface EquipeTabProps {
  children: Child[];
  classes: SchoolClass[];
  onAddAbsence?: (animatorId: string, date: string, slot: 'Midi' | 'Soir' | 'Journée', reason: string) => void;
  onRenameClass?: (classId: string, newName: string) => void;
  onAddClass?: (name: string, level: SchoolClass['level']) => void;
  onDeleteClass?: (classId: string) => void;
  onTogglePresence?: (childId: string, slot: string, value: boolean | string | null) => void;
}

type Mode = 'midi' | 'soir' | 'mercredi';
type Sortie = '16h45' | '17h30' | '18h00' | '18h30';

const SORTIES: Sortie[] = ['16h45', '17h30', '18h00', '18h30'];

// Taux d'encadrement officiels : 1 animateur pour N enfants
const RATIOS: Record<Mode, number> = {
  midi: 14,
  soir: 10,
  mercredi: 8,
};

const MODE_META: Record<
  Mode,
  { label: string; subtitle: string; card: string; iconBox: string; title: string }
> = {
  midi: {
    label: 'Midi',
    subtitle: 'Pause méridienne · 1 pour 14',
    card: 'bg-orange-50 border-orange-200',
    iconBox: 'bg-orange-500',
    title: 'text-orange-800',
  },
  soir: {
    label: 'Soir',
    subtitle: 'Accueil du soir · 1 pour 10',
    card: 'bg-indigo-50 border-indigo-200',
    iconBox: 'bg-indigo-500',
    title: 'text-indigo-800',
  },
  mercredi: {
    label: 'Mercredi',
    subtitle: 'Journée du mercredi · 1 pour 8',
    card: 'bg-emerald-50 border-emerald-200',
    iconBox: 'bg-emerald-500',
    title: 'text-emerald-800',
  },
};

const SORTIE_STYLES: Record<Sortie, { row: string; btn: string; badge: string }> = {
  '16h45': {
    row: 'bg-amber-50 border-amber-300',
    btn: 'bg-amber-500 text-white',
    badge: 'bg-amber-100 text-amber-700',
  },
  '17h30': {
    row: 'bg-orange-50 border-orange-300',
    btn: 'bg-orange-500 text-white',
    badge: 'bg-orange-100 text-orange-700',
  },
  '18h00': {
    row: 'bg-rose-50 border-rose-300',
    btn: 'bg-rose-500 text-white',
    badge: 'bg-rose-100 text-rose-700',
  },
  '18h30': {
    row: 'bg-violet-50 border-violet-300',
    btn: 'bg-violet-500 text-white',
    badge: 'bg-violet-100 text-violet-700',
  },
};

/* ---------- Helpers d'adaptation au type Child ---------- */

function childName(c: Child): string {
  const a = c as any;
  const first = a.firstName ?? a.first_name ?? a.prenom ?? '';
  const last = a.lastName ?? a.last_name ?? a.nom ?? '';
  const full = (first + ' ' + last).trim();
  return full || a.name || 'Enfant';
}

function childClassId(c: Child): string | undefined {
  const a = c as any;
  return a.classId ?? a.class_id ?? a.classe_id ?? a.schoolClassId ?? undefined;
}

function initialPresence(c: Child, mode: 'midi' | 'soir'): boolean {
  const a = c as any;
  return !!a.present?.[mode];
}

/** Libellé de sous-classe au format "PS - Florence". */
function classLabel(cl: SchoolClass): string {
  const name = cl.name.trim();
  const level = String(cl.level);
  if (name.toUpperCase().startsWith(level.toUpperCase())) return name;
  return level + ' - ' + name;
}

/* ---------- Composant ---------- */

export function EquipeTab({ children, classes, onTogglePresence }: EquipeTabProps) {
  const { activeCentre } = useAuth();

  const [mode, setMode] = useState<Mode | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [presentAnimators, setPresentAnimators] = useState(0);

  // Présences par créneau
  const [midi, setMidi] = useState<Record<string, boolean>>({});
  const [soir, setSoir] = useState<Record<string, boolean>>({});
  const [matin, setMatin] = useState<Record<string, boolean>>({});
  const [repas, setRepas] = useState<Record<string, boolean>>({});
  const [sortie, setSortie] = useState<Record<string, Sortie | null>>({});

  // Initialise Midi / Soir depuis les données enfants (sans écraser les saisies locales)
  useEffect(() => {
    setMidi((prev) => {
      const next = { ...prev };
      children.forEach((c) => {
        if (!(c.id in next)) next[c.id] = initialPresence(c, 'midi');
      });
      return next;
    });
    setSoir((prev) => {
      const next = { ...prev };
      children.forEach((c) => {
        if (!(c.id in next)) next[c.id] = initialPresence(c, 'soir');
      });
      return next;
    });
  }, [children]);

  // Animateurs présents (temps réel)
  useEffect(() => {
    if (!activeCentre) return;
    const centreNom = activeCentre.name;

    const load = async () => {
      const { data } = await supabase
        .from('animateurs')
        .select('id, present_today')
        .eq('centre_nom', centreNom);
      if (data) {
        setPresentAnimators(data.filter((a: { present_today: boolean }) => a.present_today).length);
      }
    };
    load();

    const channel = supabase
      .channel('pointage-animateurs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animateurs', filter: 'centre_nom=eq.' + centreNom },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCentre]);

  const classById = useMemo(() => {
    const map: Record<string, SchoolClass> = {};
    classes.forEach((cl) => {
      map[cl.id] = cl;
    });
    return map;
  }, [classes]);

  const visibleChildren = useMemo(() => {
    const list =
      classFilter === 'all' ? children : children.filter((c) => childClassId(c) === classFilter);
    return [...list].sort((a, b) => childName(a).localeCompare(childName(b), 'fr'));
  }, [children, classFilter]);

  /* ---------- Accesseurs ---------- */

  const isPresent = (m: Mode, id: string): boolean => {
    if (m === 'midi') return !!midi[id];
    if (m === 'soir') return !!soir[id];
    return !!matin[id] || !!repas[id];
  };

  const countPresent = (m: Mode): number => children.filter((c) => isPresent(m, c.id)).length;

  /* ---------- Actions ---------- */

  const toggleSimple = (m: 'midi' | 'soir', id: string) => {
    const setter = m === 'midi' ? setMidi : setSoir;
    const current = m === 'midi' ? !!midi[id] : !!soir[id];
    setter((prev) => ({ ...prev, [id]: !current }));
    onTogglePresence?.(id, m, !current);
  };

  const toggleMatin = (id: string) => {
    const value = !matin[id];
    setMatin((prev) => ({ ...prev, [id]: value }));
    onTogglePresence?.(id, 'mercredi_matin', value);
  };

  const toggleRepas = (id: string) => {
    const value = !repas[id];
    setRepas((prev) => ({ ...prev, [id]: value }));
    onTogglePresence?.(id, 'mercredi_repas', value);
  };

  const toggleSortie = (id: string, s: Sortie) => {
    const value = sortie[id] === s ? null : s;
    setSortie((prev) => ({ ...prev, [id]: value }));
    onTogglePresence?.(id, 'mercredi_sortie', value);
  };

  /* ---------- Jauge d'encadrement ---------- */

  const renderRatio = (m: Mode) => {
    const ratio = RATIOS[m];
    const kids = countPresent(m);
    const required = Math.ceil(kids / ratio);
    const ok = kids === 0 || presentAnimators >= required;
    const pct = Math.min((presentAnimators / Math.max(required, 1)) * 100, 100);

    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0]">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              ok ? 'bg-emerald-100' : 'bg-red-100'
            }`}
          >
            <Shield size={24} className={ok ? 'text-emerald-600' : 'text-red-600'} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">
              Taux réglementaire · {MODE_META[m].label}
            </p>
            <p className="text-sm font-bold text-[#1E293B]">
              1 animateur pour {ratio} enfants
            </p>
          </div>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
              ok ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            style={{ width: pct + '%' }}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">
              {presentAnimators} animateur{presentAnimators > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {kids} enfant{kids > 1 ? 's' : ''} · {required} requis
            </span>
            {ok ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                Conforme
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                Sous-effectif
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- Filtre sous-classes ---------- */

  const renderClassFilter = () => (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
      <button
        onClick={() => setClassFilter('all')}
        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
          classFilter === 'all'
            ? 'bg-[#2563EB] text-white'
            : 'bg-white text-gray-500 border border-[#E2E8F0]'
        }`}
      >
        Toutes
      </button>
      {classes.map((cl) => (
        <button
          key={cl.id}
          onClick={() => setClassFilter(cl.id)}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
            classFilter === cl.id
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-gray-500 border border-[#E2E8F0]'
          }`}
        >
          {classLabel(cl)}
        </button>
      ))}
    </div>
  );

  /* ---------- Lignes enfants ---------- */

  const renderClassTag = (c: Child) => {
    const cid = childClassId(c);
    const cl = cid ? classById[cid] : undefined;
    if (!cl) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
        <School size={10} />
        {classLabel(cl)}
      </span>
    );
  };

  const renderSimpleRow = (m: 'midi' | 'soir', c: Child) => {
    const present = isPresent(m, c.id);
    return (
      <div
        key={c.id}
        className={`w-full rounded-2xl p-3.5 shadow-sm border flex items-center justify-between transition ${
          present ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#E2E8F0]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              present ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {childName(c)[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1E293B] truncate">{childName(c)}</p>
            {renderClassTag(c)}
          </div>
        </div>
        <button
          onClick={() => toggleSimple(m, c.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition ${
            present ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {present && <Check size={14} />}
          {present ? 'Présent' : 'Absent'}
        </button>
      </div>
    );
  };

  const renderMercrediRow = (c: Child) => {
    const sel = sortie[c.id] ?? null;
    const present = isPresent('mercredi', c.id);
    const rowClass = sel
      ? SORTIE_STYLES[sel].row
      : present
      ? 'bg-emerald-50 border-emerald-200'
      : 'bg-white border-[#E2E8F0]';

    return (
      <div
        key={c.id}
        className={`w-full rounded-2xl p-3.5 shadow-sm border-2 transition space-y-3 ${rowClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                present ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {childName(c)[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1E293B] truncate">{childName(c)}</p>
              {renderClassTag(c)}
            </div>
          </div>
          {sel && (
            <span
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${SORTIE_STYLES[sel].badge}`}
            >
              <DoorOpen size={11} />
              Sortie {sel}
            </span>
          )}
        </div>

        {/* Présence */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => toggleMatin(c.id)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition ${
              matin[c.id] ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Sun size={14} />
            Présent Matin
          </button>
          <button
            onClick={() => toggleRepas(c.id)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition ${
              repas[c.id] ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Utensils size={14} />
            Repas
          </button>
        </div>

        {/* Sorties échelonnées */}
        <div className="grid grid-cols-4 gap-2">
          {SORTIES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSortie(c.id, s)}
              className={`py-2.5 rounded-xl text-xs font-bold active:scale-95 transition ${
                sel === s ? SORTIE_STYLES[s].btn : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  };

  /* ---------- Vue d'accueil : 3 cartes ---------- */

  const modeIcon = (m: Mode) => {
    if (m === 'midi') return <Sun size={20} className="text-white" />;
    if (m === 'soir') return <Moon size={20} className="text-white" />;
    return <CalendarDays size={20} className="text-white" />;
  };

  if (mode === null) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] pb-24">
        <div className="px-5 pt-4 pb-3">
          <h1 className="text-xl font-bold text-[#1E293B]">Pointage</h1>
          <p className="text-sm text-gray-400">Choisissez un créneau</p>
        </div>

        <div className="px-5 mt-2 space-y-3">
          {(['midi', 'soir', 'mercredi'] as Mode[]).map((m) => {
            const meta = MODE_META[m];
            const kids = countPresent(m);
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setClassFilter('all');
                }}
                className={`w-full flex items-center justify-between gap-3 py-4 px-4 rounded-2xl border-2 transition active:scale-[0.98] ${meta.card}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.iconBox}`}
                  >
                    {modeIcon(m)}
                  </div>
                  <div className="text-left">
                    <p className={`text-base font-bold ${meta.title}`}>{meta.label}</p>
                    <p className="text-xs text-gray-500">{meta.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-white text-gray-600 text-xs font-bold rounded-full">
                    {kids} présent{kids > 1 ? 's' : ''}
                  </span>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- Vue d'un créneau ---------- */

  const meta = MODE_META[mode];
  const sortieCounts: Record<Sortie, number> = {
    '16h45': 0,
    '17h30': 0,
    '18h00': 0,
    '18h30': 0,
  };
  if (mode === 'mercredi') {
    children.forEach((c) => {
      const s = sortie[c.id];
      if (s) sortieCounts[s] += 1;
    });
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode(null)}
            className="p-2.5 bg-white rounded-xl border border-[#E2E8F0] text-gray-500 active:scale-90 transition"
            aria-label="Retour"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#1E293B]">{meta.label}</h1>
            <p className="text-sm text-gray-400">{meta.subtitle}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.iconBox}`}
          >
            {modeIcon(mode)}
          </div>
        </div>
      </div>

      <div className="px-5 mt-2">{renderRatio(mode)}</div>

      {mode === 'mercredi' && (
        <div className="px-5 mt-3">
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-[#E2E8F0]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Sorties prévues
            </p>
            <div className="grid grid-cols-4 gap-2">
              {SORTIES.map((s) => (
                <div
                  key={s}
                  className={`rounded-xl py-2 text-center ${SORTIE_STYLES[s].badge}`}
                >
                  <p className="text-xs font-bold">{s}</p>
                  <p className="text-sm font-bold">{sortieCounts[s]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 mt-4">{renderClassFilter()}</div>

      <div className="px-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Enfants
          </p>
          <span className="text-xs text-gray-400">
            {visibleChildren.length} enfant{visibleChildren.length > 1 ? 's' : ''}
          </span>
        </div>

        {visibleChildren.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucun enfant dans cette classe</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleChildren.map((c) =>
              mode === 'mercredi' ? renderMercrediRow(c) : renderSimpleRow(mode, c)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
