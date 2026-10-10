import { useState } from 'react';
import { ArrowLeft, Printer, FileDown } from 'lucide-react';
import type { Child } from '@/types';

interface PrintGrilleProps {
  children: Child[];
  centreNom: string;
  onBack: () => void;
}

const SOIR_TIMES = ['16h30', '17h30', '18h00', '18h30'];
const SOIR_DAYS = ['Lundi', 'Mardi', 'Jeudi', 'Vendredi'];
const MERCREDI_TIMES = ['16h45', '17h30', '18h00', '18h30'];

function getSectionOrder(section: string): number {
  const order: Record<string, number> = { PS: 0, MS: 1, GS: 2, Elementaire: 3 };
  return order[section] ?? 99;
}

function groupByClasse(children: Child[]): { classe: string; teacher: string; section: string; children: Child[] }[] {
  const groups: Record<string, Child[]> = {};
  for (const child of children) {
    const key = child.classe || 'Sans classe';
    if (!groups[key]) groups[key] = [];
    groups[key].push(child);
  }
  return Object.entries(groups)
    .map(([classe, kids]) => ({
      classe,
      teacher: '',
      section: kids[0]?.section || 'PS',
      children: kids.sort((a, b) => a.lastName.localeCompare(b.lastName)),
    }))
    .sort((a, b) => getSectionOrder(a.section) - getSectionOrder(b.section) || a.classe.localeCompare(b.classe));
}

export function PrintGrilleSoir({ children, centreNom, onBack }: PrintGrilleProps) {
  const [selectedDay, setSelectedDay] = useState(0);
  const groups = groupByClasse(children.filter((c) => c.inscritSoir !== false));

  const generateHTML = (): string => {
    const totalEnfants = groups.reduce((sum, g) => sum + g.children.length, 0);
    const dayCols = SOIR_DAYS.map((day) => {
      const times = SOIR_TIMES.map((t) => `<th class="time-col">${t}</th>`).join('');
      return `<th colspan="4" class="day-header">${day}</th>` + times;
    }).join('');

    let bodyRows = '';
    let total = 0;
    for (const group of groups) {
      const groupHeader = `<tr class="group-header"><td colspan="${1 + SOIR_DAYS.length * SOIR_TIMES.length + 1}">${group.classe}${group.teacher ? ' — ' + group.teacher : ''}</td></tr>`;
      let groupRows = '';
      for (const child of group.children) {
        total++;
        const infoCell = child.pai ? `<span class="pai">PAI: ${child.pai.allergy}</span>${child.pickupBy ? '<br><span class="pickup">Retrait: ' + child.pickupBy + '</span>' : ''}` : (child.pickupBy ? `<span class="pickup">Retrait: ${child.pickupBy}</span>` : '');
        const dayCells = SOIR_DAYS.map(() => {
          const timeCells = SOIR_TIMES.map(() => '<td class="time-cell"></td>').join('');
          return timeCells;
        }).join('');
        groupRows += `<tr><td class="name-cell">${child.lastName.toUpperCase()} ${child.firstName}</td>${dayCells}<td class="info-cell">${infoCell}</td></tr>`;
      }
      bodyRows += groupHeader + groupRows;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Grille Soir — ${centreNom}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: 'Helvetica', sans-serif; margin: 0; color: #1E293B; font-size: 9px; }
      h1 { font-size: 14px; color: #2563EB; margin: 0 0 4px; }
      .meta { font-size: 10px; color: #6b7280; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th { background: #2563EB; color: white; padding: 4px 3px; text-align: center; font-weight: 600; font-size: 8px; border: 1px solid #1e40af; }
      th.day-header { background: #1e40af; }
      th.time-col { background: #3b82f6; font-size: 7px; }
      td { padding: 4px 3px; border: 1px solid #cbd5e1; vertical-align: middle; }
      td.name-cell { font-weight: 600; font-size: 9px; width: 18%; }
      td.time-cell { width: 6%; text-align: center; }
      td.info-cell { width: 10%; font-size: 8px; color: #6b7280; }
      tr.group-header td { background: #e0e7ff; font-weight: 700; font-size: 10px; padding: 5px; color: #1e40af; }
      .pai { color: #e65100; font-weight: 700; }
      .pickup { color: #2563EB; }
      .footer { margin-top: 10px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
    </style></head><body>
    <h1>Feuille d'émargement — Périscolaire Soir</h1>
    <div class="meta">Centre: ${centreNom} | Semaine du ${new Date().toLocaleDateString('fr-FR')} | ${totalEnfants} enfant(s) inscrit(s)</div>
    <table>
      <thead>
        <tr>
          <th rowspan="2">Nom & Prénom</th>
          ${dayCols}
          <th rowspan="2">INFOS</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="footer"><span>Généré le ${new Date().toLocaleString('fr-FR')}</span><span>Accueil Loisirs — ${centreNom}</span></div>
    </body></html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generateHTML());
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-8">
      <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">Retour Direction</span>
        </button>
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold active:scale-95 transition">
          <Printer size={16} />
          Imprimer
        </button>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-xl font-bold text-[#1E293B]">Grille émargement — Soir</h1>
        <p className="text-sm text-gray-400">Format A4 paysage, regroupé par classe</p>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm text-blue-800 font-semibold">Aperçu de la grille</p>
          <p className="text-xs text-blue-600 mt-1">
            {groups.length} classe(s) · {groups.reduce((s, g) => s + g.children.length, 0)} enfant(s) inscrit(s)
          </p>
          <p className="text-xs text-blue-500 mt-2">
            Colonnes: Nom & Prénom · {SOIR_DAYS.join(' (')} ({SOIR_TIMES.join(', ')}){') · INFOS (PAI, personnes autorisées)'}
          </p>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        {groups.map((group) => (
          <div key={group.classe} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]">
            <p className="text-sm font-bold text-[#1E293B] mb-2">{group.classe}</p>
            <div className="space-y-1">
              {group.children.map((child) => (
                <div key={child.id} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-700">{child.lastName} {child.firstName}</span>
                  {child.pai && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded">PAI: {child.pai.allergy}</span>}
                  {child.pickupBy && <span className="text-blue-500">Retrait: {child.pickupBy}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Aucun enfant inscrit au soir</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintGrilleMercredi({ children, centreNom, onBack }: PrintGrilleProps) {
  const groups = groupByClasse(children.filter((c) => c.inscritMercredi !== false));

  const generateHTML = (): string => {
    const timeCols = ['Matin', 'Repas', ...MERCREDI_TIMES].map((t) => `<th class="time-col">${t}</th>`).join('');
    let bodyRows = '';
    let total = 0;

    for (const group of groups) {
      const groupHeader = `<tr class="group-header"><td colspan="${2 + 2 + MERCREDI_TIMES.length}">${group.section} — ${group.classe}</td></tr>`;
      let groupRows = '';
      for (const child of group.children) {
        total++;
        const infoCell = child.pai ? `<span class="pai">PAI: ${child.pai.allergy}</span>${child.pickupBy ? '<br><span class="pickup">Retrait: ' + child.pickupBy + '</span>' : ''}` : (child.pickupBy ? `<span class="pickup">Retrait: ${child.pickupBy}</span>` : '');
        groupRows += `<tr><td class="name-cell">${child.lastName.toUpperCase()} ${child.firstName}</td><td class="time-cell"></td><td class="time-cell"></td>${MERCREDI_TIMES.map(() => '<td class="time-cell"></td>').join('')}<td class="info-cell">${infoCell}</td></tr>`;
      }
      bodyRows += groupHeader + groupRows;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Grille Mercredi — ${centreNom}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      body { font-family: 'Helvetica', sans-serif; margin: 0; color: #1E293B; font-size: 10px; }
      h1 { font-size: 14px; color: #2563EB; margin: 0 0 4px; }
      .meta { font-size: 10px; color: #6b7280; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th { background: #2563EB; color: white; padding: 5px 4px; text-align: center; font-weight: 600; font-size: 9px; border: 1px solid #1e40af; }
      th.time-col { background: #3b82f6; }
      td { padding: 5px 4px; border: 1px solid #cbd5e1; vertical-align: middle; }
      td.name-cell { font-weight: 600; width: 25%; }
      td.time-cell { width: 10%; text-align: center; }
      td.info-cell { width: 15%; font-size: 8px; color: #6b7280; }
      tr.group-header td { background: #e0e7ff; font-weight: 700; font-size: 11px; padding: 6px; color: #1e40af; }
      .pai { color: #e65100; font-weight: 700; }
      .pickup { color: #2563EB; }
      .footer { margin-top: 10px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
    </style></head><body>
    <h1>Feuille d'émargement — Mercredi (Centre de loisirs)</h1>
    <div class="meta">Centre: ${centreNom} | ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | ${total} enfant(s)</div>
    <table>
      <thead>
        <tr><th>Nom & Prénom</th>${timeCols}<th>INFOS</th></tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="footer"><span>Généré le ${new Date().toLocaleString('fr-FR')}</span><span>Accueil Loisirs — ${centreNom}</span></div>
    </body></html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generateHTML());
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-8">
      <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">Retour Direction</span>
        </button>
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold active:scale-95 transition">
          <Printer size={16} />
          Imprimer
        </button>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-xl font-bold text-[#1E293B]">Grille émargement — Mercredi</h1>
        <p className="text-sm text-gray-400">Format A4 journalier, regroupé par section</p>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm text-blue-800 font-semibold">Aperçu de la grille</p>
          <p className="text-xs text-blue-600 mt-1">
            {groups.length} classe(s) · {groups.reduce((s, g) => s + g.children.length, 0)} enfant(s) inscrit(s)
          </p>
          <p className="text-xs text-blue-500 mt-2">
            Colonnes: Nom & Prénom · Matin · Repas · {MERCREDI_TIMES.join(' · ')} · INFOS
          </p>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        {groups.map((group) => (
          <div key={group.classe} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]">
            <p className="text-sm font-bold text-[#1E293B] mb-2">{group.section} — {group.classe}</p>
            <div className="space-y-1">
              {group.children.map((child) => (
                <div key={child.id} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-700">{child.lastName} {child.firstName}</span>
                  {child.pai && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded">PAI: {child.pai.allergy}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Aucun enfant inscrit le mercredi</p>
          </div>
        )}
      </div>
    </div>
  );
}
