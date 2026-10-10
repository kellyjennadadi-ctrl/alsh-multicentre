import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Printer,
  Heart,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  FileDown,
  Clock,
  Utensils,
  Moon,
  Sun,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Child, TimeSlot, Section } from '@/types';
import { getSectionLabel, getAvatarColor, getInitials } from '@/utils/helpers';

type EffectifMode = 'peri' | 'mercredi' | 'vacances';
type SlotFilter = 'matin' | 'midi' | 'soir';

interface PointageRow {
  id: string;
  centre_nom: string;
  enfant_nom: string;
  statut: string;
  creneau: string;
  date_pointage: string;
  updated_at: string;
}

interface EffectifsPageProps {
  children: Child[];
  pointages: PointageRow[];
  activeSlot: TimeSlot;
  centreNom: string;
  onBack: () => void;
}

// All 8 levels in order
const ALL_LEVELS = ['PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;
type Level = typeof ALL_LEVELS[number];

// Map sections to levels — maternelle children use PS/MS/GS, élémentaire children use their classe
function childLevel(child: Child): Level {
  const section = child.section.toUpperCase();
  if (ALL_LEVELS.includes(section as Level)) return section as Level;
  // Try to extract from classe name
  const classeUpper = child.classe.toUpperCase();
  for (const lvl of ALL_LEVELS) {
    if (classeUpper.includes(lvl)) return lvl;
  }
  // Fallback: PS/MS/GS are the only sections in the type
  return section as Level;
}

function childFullName(c: { firstName: string; lastName: string }): string {
  return c.firstName + ' ' + c.lastName;
}

const SLOT_LABELS: Record<SlotFilter, string> = {
  matin: 'Matin',
  midi: 'Midi (cantine)',
  soir: 'Soir',
};

const SLOT_ICONS: Record<SlotFilter, typeof Sun> = {
  matin: Sun,
  midi: Utensils,
  soir: Moon,
};

export function EffectifsPage({ children, pointages, activeSlot, centreNom, onBack }: EffectifsPageProps) {
  const [mode, setMode] = useState<EffectifMode>(activeSlot === 'mercredi' ? 'mercredi' : 'peri');
  const [periSlot, setPeriSlot] = useState<'midi' | 'soir'>(activeSlot === 'soir' ? 'soir' : 'midi');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('midi');
  const [history, setHistory] = useState<{ date: string; total: number; matin: number; midi: number; soir: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load historical data
  useEffect(() => {
    const loadHistory = async () => {
      const dates: string[] = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      const { data } = await supabase
        .from('pointages')
        .select('date_pointage, creneau, statut, enfant_nom')
        .eq('centre_nom', centreNom)
        .in('date_pointage', dates)
        .eq('statut', 'present');

      const byDate: Record<string, { total: number; matin: number; midi: number; soir: number }> = {};
      for (const row of (data || []) as { date_pointage: string; creneau: string }[]) {
        const d = row.date_pointage;
        if (!byDate[d]) byDate[d] = { total: 0, matin: 0, midi: 0, soir: 0 };
        const c = row.creneau;
        if (c === 'matin') byDate[d].matin++;
        else if (c === 'midi') byDate[d].midi++;
        else if (c === 'soir') byDate[d].soir++;
        byDate[d].total++;
      }
      const hist = dates
        .map((d) => ({ date: d, ...(byDate[d] || { total: 0, matin: 0, midi: 0, soir: 0 }) }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setHistory(hist);
    };
    loadHistory();
  }, [centreNom]);

  // Determine which pointages are "present" based on mode and slot filter
  const creneauFilter = mode === 'mercredi' ? 'journee' : slotFilter;
  const presentNames = useMemo(
    () => pointages.filter((p) => p.creneau === creneauFilter && p.statut === 'present').map((p) => p.enfant_nom),
    [pointages, creneauFilter]
  );

  const presentChildren = children.filter((c) => presentNames.includes(childFullName(c)));

  // Group by level
  const byLevel = (level: Level): Child[] =>
    presentChildren.filter((c) => childLevel(c) === level).sort((a, b) => a.classe.localeCompare(b.classe) || a.lastName.localeCompare(b.lastName));

  // Group by classe within a level
  const levelGroups = (level: Level): { key: string; children: Child[] }[] => {
    const levelChildren = byLevel(level);
    const groups: Record<string, Child[]> = {};
    for (const c of levelChildren) {
      const k = c.classe;
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    }
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, kids]) => ({ key, children: kids }));
  };

  // Counts per level
  const levelCounts = ALL_LEVELS.map((lvl) => ({ level: lvl, count: byLevel(lvl).length }));
  const totalPresent = presentChildren.length;
  const totalInscrits = children.length;

  // Counts per slot (for the presence distribution card)
  const slotCounts = {
    matin: pointages.filter((p) => p.creneau === 'matin' && p.statut === 'present').length,
    midi: pointages.filter((p) => p.creneau === 'midi' && p.statut === 'present').length,
    soir: pointages.filter((p) => p.creneau === 'soir' && p.statut === 'present').length,
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CSV export
  const exportCSV = () => {
    const headers = ['Niveau', 'Classe', 'Effectif'];
    const rows: string[][] = [];
    for (const { level, count } of levelCounts) {
      const groups = levelGroups(level);
      for (const g of groups) {
        rows.push([level, g.key, String(g.children.length)]);
      }
      rows.push([level, 'TOTAL ' + level, String(count)]);
    }
    rows.push(['', 'TOTAL GENERAL', String(totalPresent)]);
    rows.push([]);
    rows.push(['Présences par créneau', '', '']);
    rows.push(['Matin', '', String(slotCounts.matin)]);
    rows.push(['Midi (cantine)', '', String(slotCounts.midi)]);
    rows.push(['Soir', '', String(slotCounts.soir)]);

    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'effectifs_' + centreNom.replace(/\s/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const printEffectifs = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generatePrintHTML());
    win.document.close();
    win.focus();
    win.print();
  };

  const generatePrintHTML = (): string => {
    const modeLabel = mode === 'peri' ? 'Périscolaire ' + periSlot : mode === 'mercredi' ? 'Mercredi' : 'Vacances';

    let body = '';

    // Per-level tables
    for (const { level, count } of levelCounts) {
      if (count === 0) continue;
      const groups = levelGroups(level);
      body += '<div class="section-block"><h3>' + level + ' <span class="count">(' + count + ')</span></h3>';
      body += '<table><thead><tr><th>Classe</th><th style="text-align:right">Nombre</th></tr></thead><tbody>';
      for (const g of groups) {
        body += '<tr><td>' + g.key + '</td><td style="text-align:right">' + g.children.length + '</td></tr>';
      }
      body += '<tr class="total-row"><td>TOTAL ' + level + '</td><td style="text-align:right">' + count + '</td></tr>';
      body += '</tbody></table></div>';
    }

    // Synthesis
    body += '<div class="synthese"><h3>Récapitulatif</h3><table><tbody>';
    for (const { level, count } of levelCounts) {
      body += '<tr><td>' + level + '</td><td style="text-align:right">' + count + '</td></tr>';
    }
    body += '<tr class="total-row"><td>TOTAL GÉNÉRAL</td><td style="text-align:right">' + totalPresent + '</td></tr>';
    body += '</tbody></table>';

    body += '<h3 style="margin-top:16px">Présences par créneau</h3><table><tbody>';
    body += '<tr><td>Matin</td><td style="text-align:right">' + slotCounts.matin + '</td></tr>';
    body += '<tr><td>Midi (cantine)</td><td style="text-align:right">' + slotCounts.midi + '</td></tr>';
    body += '<tr><td>Soir</td><td style="text-align:right">' + slotCounts.soir + '</td></tr>';
    body += '</tbody></table></div>';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tableau des Effectifs - ${centreNom}</title>
    <style>
      body { font-family: 'Helvetica', sans-serif; margin: 20px; color: #1f2937; }
      h1 { font-size: 16px; color: #2563EB; margin-bottom: 2px; }
      .meta { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
      .section-block { margin-bottom: 20px; }
      .section-block h3 { font-size: 13px; color: #374151; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #2563EB; }
      .count { color: #6b7280; font-weight: normal; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-weight: 600; border: 1px solid #d1d5db; }
      td { padding: 5px 8px; border: 1px solid #d1d5db; }
      .total-row { font-weight: bold; background: #dbeafe; }
      .synthese { margin-top: 24px; border: 2px solid #2563EB; border-radius: 8px; padding: 12px; }
      .synthese h3 { font-size: 13px; color: #2563EB; margin-bottom: 8px; }
      .synthese table { border: none; }
      .synthese td { border: 1px solid #e5e7eb; }
      .synthese .total-row { background: #2563EB; color: white; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>Tableau des Effectifs</h1>
    <div class="meta">Centre: ${centreNom} | Date: ${new Date().toLocaleDateString('fr-FR')} | Mode: ${modeLabel}</div>
    ${body}
    <div style="margin-top:20px;font-size:9px;color:#9ca3af">Généré le ${new Date().toLocaleString('fr-FR')} - Accueil Loisirs</div>
    </body></html>`;
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-8">
      {/* Header */}
      <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
            <ArrowLeft size={20} />
            <span className="text-sm font-bold">Retour Direction</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
          >
            <FileDown size={15} />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={printEffectifs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Mode selector */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-3">
          {([
            { key: 'peri', label: 'Périscolaire' },
            { key: 'mercredi', label: 'Mercredi' },
            { key: 'vacances', label: 'Vacances' },
          ] as { key: EffectifMode; label: string }[]).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + (mode === m.key ? 'bg-[#2563EB] text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100')}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Slot filter (matin / midi / soir) for peri mode */}
        {mode !== 'mercredi' && (
          <div className="flex gap-2 mb-2">
            {(['matin', 'midi', 'soir'] as SlotFilter[]).map((s) => {
              const SlotIcon = SLOT_ICONS[s];
              return (
                <button
                  key={s}
                  onClick={() => setSlotFilter(s)}
                  className={'flex-1 py-2 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ' + (slotFilter === s ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
                >
                  <SlotIcon size={14} />
                  {SLOT_LABELS[s]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Date info */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Calendar size={13} />
          <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} - {centreNom}</span>
        </div>
      </div>

      {/* Presence distribution card */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-sm font-bold text-blue-700">Présences par créneau (aujourd'hui)</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {(['matin', 'midi', 'soir'] as SlotFilter[]).map((s) => {
              const SlotIcon = SLOT_ICONS[s];
              const count = slotCounts[s];
              return (
                <div key={s} className="p-4 text-center">
                  <SlotIcon size={18} className="mx-auto mb-1.5 text-gray-400" />
                  <p className="text-2xl font-extrabold text-[#1E293B]">{count}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">{SLOT_LABELS[s]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* History toggle */}
      <div className="px-4 mt-3">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <span className="text-sm font-bold text-[#1E293B]">Historique (7 derniers jours)</span>
          </div>
          {showHistory ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        </button>
        {showHistory && (
          <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase px-4 py-2">Date</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase px-2 py-2">Matin</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase px-2 py-2">Midi</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase px-2 py-2">Soir</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.date} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-700">
                      {new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-600">{h.matin}</td>
                    <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-600">{h.midi}</td>
                    <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-600">{h.soir}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-[#2563EB]">{h.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Content: per-level tables */}
      <div className="px-4 mt-3 space-y-4">
        {ALL_LEVELS.map((level) => {
          const groups = levelGroups(level);
          const levelTotal = byLevel(level).length;
          if (levelTotal === 0) return null;

          return (
            <div key={level} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Level header */}
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700">{level}</span>
                <span className="text-xs font-bold text-blue-400">{levelTotal} enfant{levelTotal > 1 ? 's' : ''}</span>
              </div>

              {/* Table */}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase px-4 py-2">Classe</th>
                    <th className="text-right text-[10px] font-bold text-gray-400 uppercase px-4 py-2">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const rowId = level + '-' + g.key;
                    const expanded = expandedRows.has(rowId);
                    return (
                      <>
                        <tr
                          key={rowId}
                          onClick={() => toggleRow(rowId)}
                          className="border-b border-gray-50 cursor-pointer active:bg-gray-50 transition"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                              <span className="text-sm font-semibold text-gray-700">{g.key}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-bold text-[#1E293B]">{g.children.length}</span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={2} className="px-4 py-2">
                              <div className="space-y-1.5">
                                {g.children.map((child) => (
                                  <div key={child.id} className="flex items-center gap-2.5 py-1">
                                    <div className={'w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ' + getAvatarColor(child.firstName + child.lastName)}>
                                      {getInitials(child.firstName, child.lastName)}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 flex-1">{child.lastName} {child.firstName}</span>
                                    {child.pai && (
                                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded-full flex items-center gap-0.5">
                                        <Heart size={8} className="text-orange-500" />
                                        {child.pai.allergy}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {/* Total row */}
                  <tr className="bg-blue-50/60 border-t-2 border-blue-100">
                    <td className="px-4 py-2.5 text-sm font-bold text-blue-700">TOTAL {level}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-blue-700">{levelTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Synthesis table */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#2563EB] flex items-center gap-2">
            <Users size={16} className="text-white" />
            <span className="text-sm font-bold text-white">
              Récapitulatif {mode === 'mercredi' ? '- Mercredi' : mode === 'vacances' ? '- Vacances' : '- ' + SLOT_LABELS[slotFilter]}
            </span>
          </div>
          <table className="w-full">
            <tbody>
              {levelCounts.map(({ level, count }) => (
                <tr key={level} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">{level}</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-[#1E293B]">{count}</td>
                </tr>
              ))}
              <tr className="bg-[#2563EB]">
                <td className="px-4 py-3.5 text-sm font-bold text-white uppercase tracking-wide">Total Général</td>
                <td className="px-4 py-3.5 text-right text-2xl font-bold text-white">{totalPresent}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-medium text-gray-400">Inscrits total</td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-500">{totalInscrits}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {presentChildren.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Users size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun enfant présent pour ce créneau</p>
          </div>
        )}
      </div>
    </div>
  );
}
