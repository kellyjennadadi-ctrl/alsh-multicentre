import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Upload,
  Printer,
  Calendar,
  FileSpreadsheet,
  X,
  Check,
} from 'lucide-react';
import type { Child, Section } from '@/types';
import { getSectionLabel } from '@/utils/helpers';

interface PointageRow {
  id: string;
  centre_nom: string;
  enfant_nom: string;
  statut: string;
  creneau: string;
  date_pointage: string;
  updated_at: string;
}

interface GrilleMairieProps {
  children: Child[];
  pointages: PointageRow[];
  centreNom: string;
  onBack: () => void;
}

interface ImportedRow {
  code: string;
  nom: string;
  section: string;
  reservedDays: Set<string>;
}

function childFullName(c: { firstName: string; lastName: string }): string {
  return c.firstName + ' ' + c.lastName;
}

function getWeekdaysInMonth(year: number, month: number): { date: Date; day: number; dow: string; key: string }[] {
  const days: { date: Date; day: number; dow: string; key: string }[] = [];
  const dows = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow >= 1 && dow <= 5) {
      const dowStr = dows[dow - 1];
      const key = date.toISOString().slice(0, 10);
      days.push({ date, day: d, dow: dowStr, key });
    }
  }
  return days;
}

const monthLabels = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

// ── Tolerant header matching ──
// Maps various header spellings to a canonical column type
const HEADER_MAP: Record<string, string[]> = {
  nom: ['nom', 'name', 'noms', 'names'],
  prenom: ['prénom', 'prenom', 'prénoms', 'prenoms', 'firstname', 'first name', 'first_name'],
  code: ['code', 'identifiant', 'id', 'matricule'],
  section: ['section', 'sections'],
  classe: ['classe', 'classes', 'niveau', 'niveaux', 'level', 'grade'],
};

function findColByType(headerRow: unknown[], type: string): number {
  const patterns = HEADER_MAP[type] || [];
  for (let i = 0; i < headerRow.length; i++) {
    const val = String(headerRow[i] || '').toLowerCase().trim();
    for (const p of patterns) {
      if (val === p || val.includes(p)) return i;
    }
  }
  return -1;
}

// Detect CSV separator (comma or semicolon) from first line
function detectCsvSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

// Parse CSV text into 2D array with detected separator
function parseCsv(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple split — handles most common cases without full RFC 4180 quoting
    const cells = line.split(separator);
    rows.push(cells.map((c) => c.trim().replace(/^"|"$/g, '')));
  }
  return rows;
}

export function GrilleMairie({ children, pointages, centreNom, onBack }: GrilleMairieProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [importedData, setImportedData] = useState<ImportedRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ count: number; fileName: string } | null>(null);
  const [toggledCells, setToggledCells] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const weekdays = useMemo(() => getWeekdaysInMonth(year, month), [year, month]);

  // Build grid rows: either imported or from children
  const gridRows = useMemo(() => {
    if (importedData) {
      return importedData.map((row) => ({
        code: row.code,
        nom: row.nom,
        section: row.section,
        reservedDays: row.reservedDays,
      }));
    }
    return children.map((child) => {
      const name = childFullName(child);
      const reserved = new Set<string>();
      // Mark all weekdays as reserved for existing children
      for (const wd of weekdays) {
        reserved.add(wd.key);
      }
      return {
        code: child.id,
        nom: name,
        section: child.section,
        reservedDays: reserved,
      };
    });
  }, [importedData, children, weekdays]);

  // Determine which cells are "present" (crossed)
  const isPresent = (rowCode: string, dateKey: string): boolean => {
    const cellId = rowCode + '|' + dateKey;
    if (toggledCells.has(cellId)) return true;
    // Check Supabase pointages
    const child = children.find((c) => c.id === rowCode || childFullName(c) === rowCode);
    if (child) {
      const name = childFullName(child);
      const pt = pointages.find((p) => p.enfant_nom === name && p.date_pointage === dateKey && p.statut === 'present');
      return !!pt;
    }
    return false;
  };

  const toggleCell = (rowCode: string, dateKey: string) => {
    const cellId = rowCode + '|' + dateKey;
    setToggledCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  };

  // Column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const wd of weekdays) {
      let count = 0;
      for (const row of gridRows) {
        if (row.reservedDays.has(wd.key) && isPresent(row.code, wd.key)) {
          count++;
        }
      }
      totals[wd.key] = count;
    }
    return totals;
  }, [weekdays, gridRows, toggledCells, pointages]);

  // Row totals
  const rowTotals = useMemo(() => {
    return gridRows.map((row) => {
      let count = 0;
      for (const wd of weekdays) {
        if (row.reservedDays.has(wd.key) && isPresent(row.code, wd.key)) count++;
      }
      return count;
    });
  }, [gridRows, weekdays, toggledCells, pointages]);

  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  // ── Process parsed 2D array into ImportedRow[] ──
  const processSheetData = (
    rawData: unknown[][],
  ): ImportedRow[] => {
    if (rawData.length < 2) {
      throw new Error('Fichier vide ou format incorrect.');
    }

    const headerRow = rawData[0] as unknown[];
    const dataRows = rawData.slice(1);

    // Find column indices using tolerant header mapping
    const codeIdx = findColByType(headerRow, 'code');
    const nomIdx = findColByType(headerRow, 'nom');
    const prenomIdx = findColByType(headerRow, 'prenom');
    const sectionIdx = findColByType(headerRow, 'section');
    const classeIdx = findColByType(headerRow, 'classe');

    // Need at least a name or prenom column
    if (nomIdx === -1 && prenomIdx === -1) {
      throw new Error('Colonne "Nom" introuvable. Verifiez l en-tete du fichier (colonnes acceptees: Nom, nom, name, Name, Prenom, prenom).');
    }

    // Date columns: any header that looks like a date (DD/MM or number)
    const usedIdx = new Set([codeIdx, nomIdx, prenomIdx, sectionIdx, classeIdx].filter((i) => i >= 0));
    const dateCols: { idx: number; dateKey: string; dayNum: number }[] = [];
    for (let i = 0; i < headerRow.length; i++) {
      if (usedIdx.has(i)) continue;
      const val = String(headerRow[i] || '').trim();
      // Try to parse as day number or date
      const dayMatch = val.match(/^(\d{1,2})$/);
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        if (dayNum >= 1 && dayNum <= 31) {
          const date = new Date(year, month, dayNum);
          if (date.getDay() >= 1 && date.getDay() <= 5) {
            dateCols.push({ idx: i, dateKey: date.toISOString().slice(0, 10), dayNum });
          }
        }
      }
      // Also try DD/MM format
      const dmyMatch = val.match(/^(\d{1,2})[\/](\d{1,2})/);
      if (dmyMatch) {
        const dayNum = parseInt(dmyMatch[1], 10);
        const monNum = parseInt(dmyMatch[2], 10) - 1;
        if (monNum === month) {
          const date = new Date(year, month, dayNum);
          if (date.getDay() >= 1 && date.getDay() <= 5) {
            dateCols.push({ idx: i, dateKey: date.toISOString().slice(0, 10), dayNum });
          }
        }
      }
    }

    const imported: ImportedRow[] = [];
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      // Build name from nom + prenom columns (whichever exist)
      const nomVal = nomIdx >= 0 ? String(row[nomIdx] || '').trim() : '';
      const prenomVal = prenomIdx >= 0 ? String(row[prenomIdx] || '').trim() : '';
      let nom = nomVal;
      if (prenomVal && nomVal) {
        nom = prenomVal + ' ' + nomVal;
      } else if (prenomVal && !nomVal) {
        nom = prenomVal;
      }
      if (!nom) continue;

      const code = codeIdx >= 0 ? String(row[codeIdx] || '').trim() : 'IMP-' + (imported.length + 1);
      // Use section or classe as the section label
      const section = sectionIdx >= 0 ? String(row[sectionIdx] || '').trim() : (classeIdx >= 0 ? String(row[classeIdx] || '').trim() : '');

      const reservedDays = new Set<string>();
      for (const dc of dateCols) {
        const val = String(row[dc.idx] || '').trim();
        // Any non-empty value means reserved (X, O, 1, etc.)
        if (val && val !== '' && val !== '0') {
          reservedDays.add(dc.dateKey);
        }
      }

      imported.push({ code, nom, section, reservedDays });
    }

    if (imported.length === 0) {
      throw new Error('Aucune ligne valide trouvee dans le fichier.');
    }

    return imported;
  };

  // Excel/CSV import — handles .xlsx, .xls, and .csv with auto-detected separator
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // CSV files: read as text, detect separator, parse manually
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = String(evt.target?.result || '');
          const separator = detectCsvSeparator(text);
          const parsed = parseCsv(text, separator);
          const imported = processSheetData(parsed);
          // Instant refresh — setImportedData triggers useMemo recalculation of gridRows
          setImportedData(imported);
          setImportSuccess({ count: imported.length, fileName });
          setToggledCells(new Set());
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier CSV.');
        }
      };
      reader.onerror = () => {
        setImportError('Impossible de lire le fichier CSV.');
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    // XLSX / XLS files: read as ArrayBuffer, use XLSX library
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        // XLSX.read handles both .xlsx and .xls formats
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];
        const imported = processSheetData(json);
        // Instant refresh — setImportedData triggers useMemo recalculation of gridRows
        setImportedData(imported);
        setImportSuccess({ count: imported.length, fileName });
        setToggledCells(new Set());
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier. Verifiez le format (xlsx, xls ou csv).');
      }
    };
    reader.onerror = () => {
      setImportError('Impossible de lire le fichier.');
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Print
  const printGrille = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generatePrintHTML());
    win.document.close();
    win.focus();
    win.print();
  };

  const generatePrintHTML = (): string => {
    const period = monthLabels[month] + ' ' + year;
    let headerCells = '';
    let bodyRows = '';
    let totalCells = '';

    for (const wd of weekdays) {
      headerCells += '<th><div class="dow">' + wd.dow + '</div><div class="daynum">' + wd.day + '</div></th>';
      totalCells += '<td class="total-col">' + (columnTotals[wd.key] || 0) + '</td>';
    }

    for (let i = 0; i < gridRows.length; i++) {
      const row = gridRows[i];
      let cells = '';
      for (const wd of weekdays) {
        const reserved = row.reservedDays.has(wd.key);
        const present = isPresent(row.code, wd.key);
        let symbol = '';
        if (present) symbol = '<span class="crossed">&#8853;</span>';
        else if (reserved) symbol = '<span class="circle">&#9711;</span>';
        cells += '<td class="' + (reserved ? 'reserved' : 'empty') + '">' + symbol + '</td>';
      }
      bodyRows += '<tr><td class="code">' + row.code + '</td><td class="nom">' + row.nom + '</td>' + cells + '<td class="row-total">' + rowTotals[i] + '</td><td class="obs"></td></tr>';
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche de pointage - ${centreNom} - ${period}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: 'Helvetica', sans-serif; margin: 0; color: #1f2937; }
      h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
      .meta { font-size: 10px; text-align: center; color: #6b7280; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; }
      th, td { border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; }
      th { background: #4f46e5; color: white; font-weight: 600; }
      th .dow { font-size: 8px; }
      th .daynum { font-size: 11px; font-weight: bold; }
      td.code { width: 50px; text-align: left; font-size: 8px; }
      td.nom { width: 140px; text-align: left; font-weight: 500; }
      td.reserved { background: #feffff; }
      td.empty { background: #f9fafb; }
      td.row-total { font-weight: bold; background: #f3f4f6; width: 35px; }
      td.obs { width: 100px; }
      td.total-col { font-weight: bold; background: #e0e7ff; }
      .total-row { background: #4f46e5; color: white; font-weight: bold; }
      .total-row td { border-color: #4f46e5; }
      .crossed { font-size: 14px; color: #4f46e5; font-weight: bold; }
      .circle { font-size: 14px; color: #9ca3af; }
    </style></head><body>
    <h1>Fiche de pointage - CL</h1>
    <div class="meta">Periode: ${period} | Centre: ${centreNom}</div>
    <table>
      <thead>
        <tr>
          <th>Code</th><th>Nom et prenom</th>
          ${headerCells}
          <th>Total</th><th>Observations</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr class="total-row">
          <td colspan="2" style="text-align:right">TOTAL PAGE</td>
          ${totalCells}
          <td>${grandTotal}</td><td></td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:10px;font-size:8px;color:#9ca3af;text-align:center">Genere le ${new Date().toLocaleString('fr-FR')} - Accueil Loisirs</div>
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
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
          >
            <Upload size={15} />
            Importer liste mairie
          </button>
          <button
            onClick={printGrille}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
          >
            <Printer size={15} />
            Imprimer / PDF
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleImport}
        className="hidden"
      />

      {/* Period selector */}
      <div className="px-4 pt-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-blue-500" />
          <select
            value={month}
            onChange={(e) => { setMonth(parseInt(e.target.value, 10)); setToggledCells(new Set()); }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none"
          >
            {monthLabels.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(parseInt(e.target.value, 10)); setToggledCells(new Set()); }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Import status */}
      {importError && (
        <div className="px-4 mt-3 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
          <X size={16} className="text-rose-500" />
          <p className="text-xs text-rose-600">{importError}</p>
        </div>
      )}
      {importSuccess && (
        <div className="px-4 mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <Check size={16} className="text-emerald-500" />
          <p className="text-xs text-emerald-700 font-semibold">
            ✓ Import réussi : <span className="font-bold">{importSuccess.count}</span> enfant{importSuccess.count > 1 ? 's' : ''} importé{importSuccess.count > 1 ? 's' : ''} depuis <span className="font-bold">{importSuccess.fileName}</span>. La grille a été mise à jour.
          </p>
        </div>
      )}

      {/* Grid header info */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-sm font-bold text-[#1E293B]">Fiche de pointage - CL</p>
          <p className="text-xs text-gray-400">Periode: {monthLabels[month]} {year} | Centre: {centreNom}</p>
        </div>
      </div>

      {/* Grid - horizontally scrollable */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#2563EB]">
                  <th className="sticky left-0 z-20 bg-[#2563EB] px-3 py-2 text-left text-[10px] font-bold text-white whitespace-nowrap min-w-[60px]">Code</th>
                  <th className="sticky left-[60px] z-20 bg-[#2563EB] px-3 py-2 text-left text-[10px] font-bold text-white whitespace-nowrap min-w-[120px]">Nom et prenom</th>
                  {weekdays.map((wd) => (
                    <th key={wd.key} className="px-1.5 py-2 text-center min-w-[32px]">
                      <div className="text-[9px] text-blue-200">{wd.dow}</div>
                      <div className="text-xs font-bold text-white">{wd.day}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-[10px] font-bold text-white min-w-[40px]">Total</th>
                  <th className="px-2 py-2 text-center text-[10px] font-bold text-white min-w-[80px]">Observ.</th>
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row, rowIdx) => (
                  <tr key={row.code + rowIdx} className={'border-b border-gray-50 ' + (rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                    <td className={'sticky left-0 z-10 px-3 py-2 text-[10px] text-gray-500 font-mono whitespace-nowrap ' + (rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                      {row.code}
                    </td>
                    <td className={'sticky left-[60px] z-10 px-3 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap ' + (rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                      {row.nom}
                      {row.section && <span className="ml-1.5 text-[9px] text-gray-400">({row.section})</span>}
                    </td>
                    {weekdays.map((wd) => {
                      const reserved = row.reservedDays.has(wd.key);
                      const present = isPresent(row.code, wd.key);
                      return (
                        <td key={wd.key} className="px-1 py-2 text-center min-w-[32px]">
                          {reserved ? (
                            <button
                              onClick={() => toggleCell(row.code, wd.key)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition"
                            >
                              {present ? (
                                <span className="text-[#2563EB] text-lg font-bold leading-none" style={{ textDecoration: 'none' }}>&#8853;</span>
                              ) : (
                                <span className="text-gray-300 text-lg leading-none">&#9711;</span>
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-100 text-xs">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-sm font-bold text-gray-700">{rowTotals[rowIdx]}</td>
                    <td className="px-2 py-2"></td>
                  </tr>
                ))}
                {gridRows.length === 0 && (
                  <tr>
                    <td colSpan={weekdays.length + 4} className="px-4 py-8 text-center text-sm text-gray-300">
                      <FileSpreadsheet size={28} className="mx-auto mb-2 text-gray-200" />
                      Aucun enfant. Importez une liste mairie ou ajoutez des enfants.
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Total page row */}
              {gridRows.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="sticky left-0 z-10 bg-blue-50 px-3 py-2.5 text-[10px] font-bold text-blue-700 whitespace-nowrap" colSpan={2}>
                      TOTAL PAGE
                    </td>
                    {weekdays.map((wd) => (
                      <td key={wd.key} className="px-1 py-2.5 text-center text-xs font-bold text-blue-700">
                        {columnTotals[wd.key] || 0}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center text-sm font-bold text-blue-700">{grandTotal}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 mt-3 flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="text-lg text-gray-300">&#9711;</span>
          <span>Inscrit (non pointe)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg text-[#2563EB]">&#8853;</span>
          <span>Present (pointe)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-200">-</span>
          <span>Non inscrit</span>
        </div>
      </div>
    </div>
  );
}
