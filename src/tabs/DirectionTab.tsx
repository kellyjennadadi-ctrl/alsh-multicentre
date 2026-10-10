import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Lock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Users,
  CheckCircle,
  XCircle,
  LogOut,
  FileDown,
  Printer,
  Plus,
  Trash2,
  Pencil,
  X,
  Heart,
  Download,
  Calendar,
  Clock,
  Copy,
  Check,
  Utensils,
  ChevronDown,
  Mail,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getInitials, getAge, getAvatarColor, getSectionLabel } from '@/utils/helpers';
import type { Child, TimeSlot, Section } from '@/types';
import { EffectifsPage } from '@/tabs/EffectifsPage';
import { GrilleMairie } from '@/tabs/GrilleMairie';
import { RenfortsPage } from '@/tabs/RenfortsPage';
import { EquipeDirectionPage } from '@/tabs/EquipeDirectionPage';
import { ClassesManagementPage } from '@/tabs/ClassesManagementPage';
import { PrintGrilleSoir, PrintGrilleMercredi } from '@/tabs/PrintGrilles';
import { PhoneCall, UserCheck, FileSpreadsheet, Calendar as CalIcon, Upload, School } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PointageRow {
  id: string;
  centre_nom: string;
  enfant_nom: string;
  statut: string;
  creneau: string;
  date_pointage: string;
  updated_at: string;
}

interface ClotureRow {
  id: string;
  centre_nom: string;
  date_cloture: string;
  creneau: string;
  responsable_nom: string;
  cloture_at: string;
}

interface EnfantRow {
  id: string;
  centre_nom: string;
  first_name: string;
  last_name: string;
  section: string;
  classe: string;
  birth_date: string;
  regime_alimentaire: string | null;
  pai_allergie: string | null;
  pai_protocole: string | null;
  pai_contact_urgence: string | null;
  pai_telephone_urgence: string | null;
  departure_time: string | null;
  pickup_by: string | null;
}

interface DirectionTabProps {
  children: Child[];
  onExit: () => void;
  onChildrenChange: (children: Child[]) => void;
}

const DEFAULT_PIN = '2026';

const slotLabels: Record<TimeSlot, string> = {
  matin: 'Matin',
  midi: 'Midi',
  soir: 'Soir',
  mercredi: 'Journee',
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function childFullName(c: { firstName: string; lastName: string }): string {
  return c.firstName + ' ' + c.lastName;
}

export function DirectionTab({ children, onExit, onChildrenChange }: DirectionTabProps) {
  const { activeCentre, profile } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [loginMode, setLoginMode] = useState<'choice' | 'directeur' | 'adjoint'>('choice');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [accessRole, setAccessRole] = useState<'directeur' | 'adjoint'>('adjoint');
  const [activeView, setActiveView] = useState<'dashboard' | 'enfants' | 'grilles'>('dashboard');
  const [showRenforts, setShowRenforts] = useState(false);
  const [showEquipe, setShowEquipe] = useState(false);
  const [showCalendrier, setShowCalendrier] = useState(false);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('midi');
  const [pointages, setPointages] = useState<PointageRow[]>([]);
  const [clotures, setClotures] = useState<ClotureRow[]>([]);
  const [closing, setClosing] = useState(false);
  const [careCount, setCareCount] = useState(0);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [enfantRows, setEnfantRows] = useState<EnfantRow[]>([]);
  const [selectedStat, setSelectedStat] = useState<'inscrits' | 'presents' | 'absents' | 'partis' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showEffectifs, setShowEffectifs] = useState(false);
  const [showGrille, setShowGrille] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileInputRefState, setFileInputRefState] = useState<HTMLInputElement | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClasses, setShowClasses] = useState(false);
  const [showGrilleSoir, setShowGrilleSoir] = useState(false);
  const [showGrilleMercredi, setShowGrilleMercredi] = useState(false);
  const [importSlot, setImportSlot] = useState<'midi' | 'soir' | 'mercredi'>('soir');
  const [centrePin, setCentrePin] = useState(activeCentre?.pin_code || DEFAULT_PIN);
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);
  const [changingPin, setChangingPin] = useState(false);

  const centreNom = activeCentre?.name || '';
  const today = getToday();

  // Ratio gauge data — per-slot regulatory ratios
  const slotRatios: Record<TimeSlot, number> = {
    matin: 10,
    midi: 14,
    soir: 10,
    mercredi: 8,
  };
  const slotRatioLabels: Record<TimeSlot, string> = {
    matin: 'Matin',
    midi: 'Midi',
    soir: 'Soir',
    mercredi: 'Mercredi',
  };
  const legalRatio = slotRatios[activeSlot] || 14;
  const presentChildrenCount = children.filter((c) => c.present[activeSlot]).length;
  const [animatorCount, setAnimatorCount] = useState(0);

  useEffect(() => {
    if (!unlocked || !centreNom) return;
    const loadCount = async () => {
      const { data } = await supabase
        .from('animateurs')
        .select('id, present_today, role')
        .eq('centre_nom', centreNom)
        .neq('role', 'Renfort');
      setAnimatorCount((data as { present_today: boolean }[] | null)?.filter((a) => a.present_today).length || 0);
    };
    loadCount();

    const channel = supabase
      .channel('direction-animateurs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animateurs', filter: 'centre_nom=eq.' + centreNom },
        () => { loadCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unlocked, centreNom]);

  const requiredAnimators = Math.ceil(presentChildrenCount / legalRatio) || 0;
  const ratioStatus = presentChildrenCount === 0 || animatorCount >= requiredAnimators ? 'ok' : 'warning';

  // Auto-unlock if user is directeur or adjoint
  useEffect(() => {
    if (profile?.role === 'directeur') {
      setUnlocked(true);
      setAccessRole('directeur');
    } else if (profile?.role === 'adjoint') {
      setUnlocked(true);
      setAccessRole('adjoint');
    }
  }, [profile]);

  // Load centre PIN from DB
  useEffect(() => {
    if (!activeCentre) return;
    const loadPin = async () => {
      const { data } = await supabase
        .from('centre_config')
        .select('adjoint_pin')
        .eq('centre_nom', centreNom)
        .maybeSingle();
      if (data?.adjoint_pin) setCentrePin(data.adjoint_pin);
    };
    loadPin();
  }, [activeCentre, centreNom]);

  // Load pointages, clotures, care count for today + realtime subscriptions
  useEffect(() => {
    if (!unlocked || !activeCentre) return;

    const loadData = async () => {
      const [ptRes, clRes] = await Promise.all([
        supabase.from('pointages').select('*').eq('centre_nom', centreNom).eq('date_pointage', today),
        supabase.from('clotures').select('*').eq('centre_nom', centreNom).eq('date_cloture', today),
      ]);
      if (ptRes.data) setPointages(ptRes.data as PointageRow[]);
      if (clRes.data) setClotures(clRes.data as ClotureRow[]);
    };

    loadData();

    const ptChannel = supabase
      .channel('direction-pointages-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pointages', filter: 'centre_nom=eq.' + centreNom },
        () => { loadData(); }
      )
      .subscribe();

    const clChannel = supabase
      .channel('direction-clotures-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clotures', filter: 'centre_nom=eq.' + centreNom },
        () => { loadData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ptChannel);
      supabase.removeChannel(clChannel);
    };
  }, [unlocked, activeCentre, centreNom, today]);

  // Load enfants from DB
  useEffect(() => {
    if (!unlocked || !activeCentre) return;
    const loadEnfants = async () => {
      const { data } = await supabase.from('enfants').select('*').eq('centre_nom', centreNom).order('last_name');
      if (data) setEnfantRows(data as EnfantRow[]);
    };
    loadEnfants();
  }, [unlocked, activeCentre, centreNom]);

  // Compute stats from pointages for the active slot
  const slotPointages = pointages.filter((p) => p.creneau === (activeSlot === 'mercredi' ? 'journee' : activeSlot));
  const presentNames = slotPointages.filter((p) => p.statut === 'present').map((p) => p.enfant_nom);
  const absentNames = slotPointages.filter((p) => p.statut === 'absent').map((p) => p.enfant_nom);
  const partiNames = slotPointages.filter((p) => p.statut === 'parti').map((p) => p.enfant_nom);
  const totalInscrits = children.length;
  const presentCount = presentNames.length;
  const absentCount = absentNames.length;
  const partiCount = partiNames.length;

  // Group children by section for the detail table
  const sectionOrder: Record<string, number> = { PS: 0, MS: 1, GS: 2, Elementaire: 3 };

  const getChildrenForStat = (): Child[] => {
    if (selectedStat === 'inscrits') return [...children];
    if (selectedStat === 'presents') return children.filter((c) => presentNames.includes(childFullName(c)));
    if (selectedStat === 'absents') return children.filter((c) => absentNames.includes(childFullName(c)));
    if (selectedStat === 'partis') return children.filter((c) => partiNames.includes(childFullName(c)));
    return [];
  };

  const groupedChildren = (() => {
    const list = getChildrenForStat();
    const groups: Record<string, Child[]> = {};
    for (const child of list) {
      const key = child.section;
      if (!groups[key]) groups[key] = [];
      groups[key].push(child);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.classe.localeCompare(b.classe) || a.lastName.localeCompare(b.lastName));
    }
    return Object.entries(groups).sort((a, b) => (sectionOrder[a[0]] ?? 99) - (sectionOrder[b[0]] ?? 99));
  })();

  // Cantine / repas data for Midi slot
  const presentAtMidi = children.filter((c) => presentNames.includes(childFullName(c)));
  const getRegime = (child: Child): string => {
    const dbRow = enfantRows.find((e) => e.first_name === child.firstName && e.last_name === child.lastName);
    const regime = dbRow?.regime_alimentaire;
    if (regime) return regime;
    if (child.pai) return 'PAI alimentaire';
    return 'Standard';
  };
  const regimeCounts: Record<string, number> = {};
  for (const child of presentAtMidi) {
    const r = getRegime(child);
    regimeCounts[r] = (regimeCounts[r] || 0) + 1;
  }
  const totalRepas = presentAtMidi.length;

  // Cantine - Total du jour (non-nominative count by class)
  const cantineByClasse: Record<string, number> = {};
  for (const child of presentAtMidi) {
    const key = child.classe;
    cantineByClasse[key] = (cantineByClasse[key] || 0) + 1;
  }
  const cantineTotal = presentAtMidi.length;
  const sortedClasses = Object.entries(cantineByClasse).sort((a, b) => a[0].localeCompare(b[0]));

  // All present children for the day (across all slots) - for evacuation list
  const allPresentNamesToday = new Set(pointages.filter((p) => p.statut === 'present').map((p) => p.enfant_nom));
  const presentChildrenToday = children.filter((c) => allPresentNamesToday.has(childFullName(c)));

  const generateCuisineRecap = (): string => {
    const lines: string[] = [];
    lines.push('RECAPITULATIF CANTINE - ' + centreNom);
    lines.push('Date: ' + new Date().toLocaleDateString('fr-FR'));
    lines.push('Creneau: Midi');
    lines.push('Total repas: ' + totalRepas);
    lines.push('');
    lines.push('Repartition des regimes:');
    for (const [regime, count] of Object.entries(regimeCounts).sort()) {
      lines.push('  - ' + regime + ': ' + count);
    }
    if (presentAtMidi.some((c) => c.pai)) {
      lines.push('');
      lines.push('PAI alimentaires:');
      for (const c of presentAtMidi.filter((c) => c.pai)) {
        lines.push('  - ' + c.firstName + ' ' + c.lastName + ': ' + (c.pai?.allergy || ''));
      }
    }
    return lines.join('\n');
  };

  const copyCuisineRecap = () => {
    const text = generateCuisineRecap();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const slotClotured = clotures.some((c) => c.creneau === (activeSlot === 'mercredi' ? 'journee' : activeSlot));
  const clotureInfo = clotures.find((c) => c.creneau === (activeSlot === 'mercredi' ? 'journee' : activeSlot));

  // ---- Dual access login handlers ----
  // L'accès Direction exige un vrai compte (e-mail + mot de passe) dont le rôle est
  // « directeur » ou « adjoint ». Plus aucun e-mail ni mot de passe n'est écrit dans le code.
  const handleDirecteurLogin = async () => {
    setAuthLoading(true);
    setPinError(null);
    const enteredEmail = email.trim().toLowerCase();
    if (!enteredEmail || !password) {
      setPinError('Saisissez votre e-mail et votre mot de passe.');
      setAuthLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: enteredEmail, password });
      if (error || !data.user) {
        setPinError('Identifiants incorrects.');
      } else {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        const role = (prof as { role?: string } | null)?.role;
        if (role === 'directeur' || role === 'adjoint') {
          setAccessRole(role);
          setUnlocked(true);
        } else {
          setPinError("Ce compte n'a pas les droits Direction.");
        }
      }
    } catch {
      setPinError('Connexion impossible. Vérifiez votre réseau.');
    }
    setAuthLoading(false);
  };

  const handleAdjointUnlock = () => {
    if (pinInput === centrePin) {
      setAccessRole('adjoint');
      setUnlocked(true);
      setPinError(null);
    } else {
      setPinError('Code PIN adjoint incorrect.');
    }
  };

  const handlePinChange = async () => {
    setPinChangeError(null);
    if (oldPinInput !== centrePin) {
      setPinChangeError('L\'ancien code PIN est incorrect.');
      return;
    }
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setPinChangeError('Le nouveau code doit contenir exactement 4 chiffres.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinChangeError('La confirmation ne correspond pas au nouveau code.');
      return;
    }
    setChangingPin(true);
    const { data: existing } = await supabase
      .from('centre_config')
      .select('id')
      .eq('centre_nom', centreNom)
      .maybeSingle();
    if (existing) {
      await supabase.from('centre_config').update({ adjoint_pin: newPinInput, updated_at: new Date().toISOString() }).eq('id', (existing as { id: string }).id);
    } else {
      await supabase.from('centre_config').insert({ centre_nom: centreNom, adjoint_pin: newPinInput });
    }
    setCentrePin(newPinInput);
    setChangingPin(false);
    setPinChangeSuccess(true);
    setOldPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setTimeout(() => { setPinChangeSuccess(false); setShowPinChange(false); }, 2000);
  };

  const handleLogout = () => {
    setUnlocked(false);
    setLoginMode('choice');
    setPinInput('');
    setEmail('');
    setPassword('');
    setPinError(null);
  };

  const handleCloture = async () => {
    if (!activeCentre || !profile) return;
    setClosing(true);
    const creneau = activeSlot === 'mercredi' ? 'journee' : activeSlot;
    await supabase.from('clotures').insert({
      centre_nom: centreNom,
      date_cloture: today,
      creneau,
      responsable_nom: profile.full_name,
    });
    setClotures((prev) => [...prev, {
      id: 'temp-' + Date.now(),
      centre_nom: centreNom,
      date_cloture: today,
      creneau,
      responsable_nom: profile.full_name,
      cloture_at: new Date().toISOString(),
    }]);
    setClosing(false);
  };

  const handleUndoCloture = async () => {
    const creneau = activeSlot === 'mercredi' ? 'journee' : activeSlot;
    const cloture = clotures.find((c) => c.creneau === creneau);
    if (!cloture) return;
    await supabase.from('clotures').delete().eq('id', cloture.id);
    setClotures((prev) => prev.filter((c) => c.id !== cloture.id));
  };

  // CSV export
  const exportCSV = () => {
    const headers = ['Date', 'Centre', 'Nom Enfant', 'Section/Classe', 'Creneau', 'Statut', 'Heure de pointage', 'Soin/PAI'];
    const rows: string[][] = [];

    for (const child of children) {
      const name = childFullName(child);
      const childPt = slotPointages.find((p) => p.enfant_nom === name);
      const statut = childPt ? (childPt.statut === 'present' ? 'Present' : childPt.statut === 'parti' ? 'Parti' : 'Absent') : 'Non pointe';
      const heure = childPt ? new Date(childPt.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const soinPai = child.pai ? 'PAI: ' + child.pai.allergy : '';
      rows.push([
        today,
        centreNom,
        name,
        child.section + ' / ' + child.classe,
        slotLabels[activeSlot],
        statut,
        heure,
        soinPai,
      ]);
    }

    const csvContent = [headers, ...rows]
      .map((r) => r.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presences_' + centreNom.replace(/\s/g, '_') + '_' + today + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF print
  const printPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = generatePrintHTML();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const generatePrintHTML = (): string => {
    const rows = children.map((child) => {
      const name = childFullName(child);
      const childPt = slotPointages.find((p) => p.enfant_nom === name);
      const statut = childPt ? (childPt.statut === 'present' ? 'Present' : childPt.statut === 'parti' ? 'Parti' : 'Absent') : 'Non pointe';
      const heure = childPt ? new Date(childPt.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const pai = child.pai ? '<span style="color:#e65100;font-weight:bold;">PAI: ' + child.pai.allergy + '</span>' : '';
      return '<tr><td>' + name + '</td><td>' + child.section + '</td><td>' + child.classe + '</td><td>' + statut + '</td><td>' + heure + '</td><td>' + pai + '</td></tr>';
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Feuille de presence - ${centreNom} - ${today}</title>
    <style>
      body { font-family: 'Helvetica', sans-serif; margin: 20px; color: #1E293B; }
      h1 { font-size: 18px; color: #2563EB; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #2563EB; color: white; padding: 8px; text-align: left; font-weight: 600; }
      td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
      tr:nth-child(even) { background: #f8fafc; }
      .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; }
    </style></head><body>
    <h1>Feuille de presence</h1>
    <div class="meta">Centre: ${centreNom} | Date: ${today} | Creneau: ${slotLabels[activeSlot]} | Responsable: ${profile?.full_name || ''}</div>
    <table><thead><tr><th>Nom</th><th>Section</th><th>Classe</th><th>Statut</th><th>Heure</th><th>PAI/Soin</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">Genere le ${new Date().toLocaleString('fr-FR')} - Accueil Loisirs</div>
    </body></html>`;
  };

  // ---- Liste d'evacuation d'urgence (print/PDF) ----
  const printEvacuationList = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = generateEvacuationHTML();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const generateEvacuationHTML = (): string => {
    // Group present children by section then classe
    const groups: Record<string, Record<string, Child[]>> = {};
    for (const child of presentChildrenToday) {
      if (!groups[child.section]) groups[child.section] = {};
      if (!groups[child.section][child.classe]) groups[child.section][child.classe] = [];
      groups[child.section][child.classe].push(child);
    }
    const sectionKeys = Object.keys(groups).sort((a, b) => (sectionOrder[a] ?? 99) - (sectionOrder[b] ?? 99));

    let bodyHtml = '';
    let grandTotal = 0;
    for (const section of sectionKeys) {
      const sectionLabel = getSectionLabel(section as Section);
      let sectionTotal = 0;
      let sectionHtml = '';
      for (const [classe, kids] of Object.entries(groups[section]).sort()) {
        sectionTotal += kids.length;
        sectionHtml += `<tr class="classe-row"><td colspan="2" style="font-weight:bold;background:#EFF6FF;color:#1E293B;">${classe}</td><td style="font-weight:bold;text-align:right;background:#EFF6FF;">${kids.length}</td></tr>`;
        for (const child of kids.sort((a, b) => a.lastName.localeCompare(b.lastName))) {
          const pai = child.pai ? '<span class="pai">PAI: ' + child.pai.allergy + '</span>' : '';
          sectionHtml += '<tr><td></td><td>' + childFullName(child) + '</td><td></td></tr>';
        }
      }
      grandTotal += sectionTotal;
      bodyHtml += `
        <div class="section-block">
          <div class="section-header">${sectionLabel} <span class="section-count">${sectionTotal}</span></div>
          <table><tbody>${sectionHtml}</tbody></table>
        </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liste d'evacuation d'urgence - ${centreNom} - ${today}</title>
    <style>
      body { font-family: 'Helvetica', sans-serif; margin: 20px; color: #1E293B; }
      h1 { font-size: 20px; color: #0F172A; margin-bottom: 2px; }
      h2 { font-size: 14px; color: #dc2626; margin-top: 4px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
      .grand-total { background: #0F172A; color: white; padding: 16px 24px; border-radius: 12px; margin: 16px 0; display: flex; justify-content: space-between; align-items: center; }
      .grand-total .label { font-size: 14px; font-weight: 600; }
      .grand-total .value { font-size: 32px; font-weight: 800; }
      .section-block { margin-bottom: 16px; page-break-inside: avoid; }
      .section-header { font-size: 14px; font-weight: 700; color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; }
      .section-count { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      td { padding: 4px 8px; border-bottom: 1px solid #E2E8F0; }
      .classe-row td { border-bottom: 1px solid #BFDBFE; }
      .pai { color: #e65100; font-weight: bold; font-size: 9px; }
      .team-section { margin-top: 24px; border: 2px dashed #94a3b8; border-radius: 12px; padding: 16px; }
      .team-section h3 { font-size: 13px; color: #0F172A; margin: 0 0 8px 0; }
      .team-section p { font-size: 11px; color: #6b7280; }
      .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    <h1>Liste d'evacuation d'urgence</h1>
    <h2>URGENCE - A EMPORTER IMPERATIVEMENT</h2>
    <div class="meta">Centre: ${centreNom} | Date: ${today} | Genere a: ${new Date().toLocaleTimeString('fr-FR')}</div>
    <div class="grand-total"><span class="label">TOTAL ENFANTS PRESENTS</span><span class="value">${grandTotal}</span></div>
    ${bodyHtml}
    <div class="team-section">
      <h3>ANIMATEURS PRESENTS</h3>
      <p>(A completer manuellement - cocher les présents au moment de l'evacuation)</p>
      <p>Responsable evacuation: ..............................</p>
      <p>Point de rassemblement: ..............................</p>
    </div>
    <div class="footer">Document confidentiel - Accueil Loisirs - ${new Date().toLocaleString('fr-FR')}</div>
    </body></html>`;
  };

  // Add/edit child
  const handleSaveChild = async (data: {
    firstName: string;
    lastName: string;
    section: Section;
    classe: string;
    birthDate: string;
    regime: string;
    hasPai: boolean;
    allergy: string;
    protocol: string;
    emergencyContact: string;
    emergencyPhone: string;
    departureTime: string;
    pickupBy: string;
  }) => {
    if (!activeCentre) return;

    if (editChild) {
      // Update local state
      const updated = children.map((c) =>
        c.id === editChild.id
          ? {
              ...c,
              firstName: data.firstName,
              lastName: data.lastName,
              section: data.section,
              classe: data.classe,
              birthDate: data.birthDate,
              pai: data.hasPai ? {
                allergy: data.allergy,
                protocol: data.protocol,
                emergencyContact: data.emergencyContact,
                emergencyPhone: data.emergencyPhone,
              } : null,
              departureTime: data.departureTime || undefined,
              pickupBy: data.pickupBy || undefined,
            }
          : c
      );
      onChildrenChange(updated);
    } else {
      const newChild: Child = {
        id: 'c' + Date.now(),
        firstName: data.firstName,
        lastName: data.lastName,
        section: data.section,
        classe: data.classe,
        birthDate: data.birthDate,
        pai: data.hasPai ? {
          allergy: data.allergy,
          protocol: data.protocol,
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
        } : null,
        departureTime: data.departureTime || undefined,
        pickupBy: data.pickupBy || undefined,
        present: { matin: false, midi: false, soir: false, mercredi: false },
      };
      onChildrenChange([...children, newChild]);

      // Also persist to DB
      await supabase.from('enfants').insert({
        centre_nom: centreNom,
        first_name: data.firstName,
        last_name: data.lastName,
        section: data.section,
        classe: data.classe,
        birth_date: data.birthDate,
        regime_alimentaire: data.regime || null,
        pai_allergie: data.hasPai ? data.allergy : null,
        pai_protocole: data.hasPai ? data.protocol : null,
        pai_contact_urgence: data.hasPai ? data.emergencyContact : null,
        pai_telephone_urgence: data.hasPai ? data.emergencyPhone : null,
        departure_time: data.departureTime || null,
        pickup_by: data.pickupBy || null,
      });
    }

    setShowAddChild(false);
    setEditChild(null);
  };

  const handleDeleteChild = async (childId: string) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    onChildrenChange(children.filter((c) => c.id !== childId));
    // Delete from DB if exists
    const dbRow = enfantRows.find((e) => e.first_name === child.firstName && e.last_name === child.lastName);
    if (dbRow) {
      await supabase.from('enfants').delete().eq('id', dbRow.id);
    }
  };

  // ---- Excel / CSV import (tolerant parser) ----
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!activeCentre) {
      setImportStatus('Erreur : aucun centre actif sélectionné. Impossible d importer les enfants.');
      return;
    }
    setImporting(true);
    setImportStatus(null);
    try {
      const buf = await readFileAsArrayBuffer(file);
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('Aucune feuille trouvée dans ce fichier.');
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error('Impossible de lire la première feuille du classeur.');
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      if (rows.length === 0) {
        setImportStatus('Erreur : le fichier est vide ou ne contient aucune ligne de données.');
        return;
      }

      // Tolerant column matching — accept French/English headers, various casings
      const findCol = (row: Record<string, unknown>, candidates: string[]): string | undefined => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
          const found = keys.find((k) => k.toLowerCase().trim() === cand.toLowerCase());
          if (found) return found;
        }
        // Fuzzy: check if any key contains the candidate
        for (const cand of candidates) {
          const found = keys.find((k) => k.toLowerCase().includes(cand.toLowerCase()));
          if (found) return found;
        }
        return undefined;
      };

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const newChildren: Child[] = [];
      const existingMap = new Map<string, Child>();
      for (const c of children) {
        existingMap.set((childFullName(c)).toLowerCase(), c);
      }

      const slotInscriptionField: Record<string, string> = {
        midi: 'inscrit_midi',
        soir: 'inscrit_soir',
        mercredi: 'inscrit_mercredi',
      };
      const slotInscriptionChild: Record<string, 'inscritMidi' | 'inscritSoir' | 'inscritMercredi'> = {
        midi: 'inscritMidi',
        soir: 'inscritSoir',
        mercredi: 'inscritMercredi',
      };

      for (const row of rows) {
        const prenomCol = findCol(row, ['prenom', 'prénom', 'firstname', 'first_name', 'first name', 'name']);
        const nomCol = findCol(row, ['nom', 'lastname', 'last_name', 'last name', 'surname']);
        const classeCol = findCol(row, ['classe', 'class', 'niveau', 'section', 'level']);
        const naissanceCol = findCol(row, ['naissance', 'birth', 'date de naissance', 'birthdate', 'birth_date', 'ddn']);
        const regimeCol = findCol(row, ['regime', 'régime', 'alimentaire', 'diet', 'meal']);

        const firstName = prenomCol ? String(row[prenomCol]).trim() : '';
        const lastName = nomCol ? String(row[nomCol]).trim() : '';

        if (!firstName || !lastName) {
          skipped++;
          continue;
        }

        const fullNameKey = (firstName + ' ' + lastName).toLowerCase();
        const classeRaw = classeCol ? String(row[classeCol]).trim() : 'Import';
        const classeUpper = classeRaw.toUpperCase();
        let section: Section = 'PS';
        if (classeUpper.includes('MS')) section = 'MS';
        else if (classeUpper.includes('GS')) section = 'GS';
        else if (classeUpper.includes('CP') || classeUpper.includes('CE') || classeUpper.includes('CM') || classeUpper.includes('ELEMENT')) section = 'GS';

        const existing = existingMap.get(fullNameKey);
        if (existing) {
          // Check if already enrolled for this slot
          const childKey = slotInscriptionChild[importSlot];
          if (existing[childKey]) {
            skipped++;
            continue;
          }
          // Update inscription for the selected slot — no duplicate created
          const updatedChild: Child = {
            ...existing,
            [childKey]: true,
          };
          existingMap.set(fullNameKey, updatedChild);
          const idx = children.findIndex((c) => c.id === existing.id);
          if (idx >= 0) {
            const newChildrenList = [...children];
            newChildrenList[idx] = updatedChild;
            onChildrenChange(newChildrenList);
          }
          // Update DB inscription column
          const dbRow = enfantRows.find((e) => e.first_name === firstName && e.last_name === lastName);
          if (dbRow) {
            await supabase.from('enfants')
              .update({ [slotInscriptionField[importSlot]]: true })
              .eq('id', dbRow.id);
          }
          updated++;
          continue;
        }

        const birthDate = naissanceCol ? parseDate(String(row[naissanceCol]).trim()) : '2021-01-01';
        const regime = regimeCol ? String(row[regimeCol]).trim() : '';

        const childKey = slotInscriptionChild[importSlot];
        const newChild: Child = {
          id: 'imp' + Date.now() + '_' + imported,
          firstName,
          lastName,
          section,
          classe: classeRaw,
          birthDate,
          pai: null,
          present: { matin: false, midi: false, soir: false, mercredi: false },
          [childKey]: true,
        };
        newChildren.push(newChild);
        existingMap.set(fullNameKey, newChild);
        imported++;

        // Persist to DB with inscription flag
        await supabase.from('enfants').insert({
          centre_nom: centreNom,
          first_name: firstName,
          last_name: lastName,
          section,
          classe: classeRaw,
          birth_date: birthDate,
          regime_alimentaire: regime || null,
          [slotInscriptionField[importSlot]]: true,
        });
      }

      if (newChildren.length > 0) {
        onChildrenChange([...children, ...newChildren]);
      }
      const totalOk = imported + updated;
      setImportStatus(totalOk > 0
        ? `${imported} nouveau${imported > 1 ? 'x' : ''} · ${updated} inscription${updated > 1 ? 's' : ''} mise${updated > 1 ? 's' : ''} à jour (${importSlot})${skipped > 0 ? `, ${skipped} ignoré${skipped > 1 ? 's' : ''}` : ''}`
        : `Aucune modification (${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportStatus('Erreur lors de la lecture du fichier : ' + msg + '. Format accepté : Excel (.xlsx, .xls) ou CSV.');
    } finally {
      setImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  function parseDate(raw: string): string {
    // Try DD/MM/YYYY or DD-MM-YYYY
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      let y = m[3];
      if (y.length === 2) y = '20' + y;
      return y + '-' + mo + '-' + d;
    }
    // Try YYYY-MM-DD already
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // Fallback
    return '2021-01-01';
  }

  // FileReader-based read that works on all browsers including mobile
  function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Impossible de lire le contenu du fichier.'));
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier (FileReader).'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ---- Dual access choice screen (replaces single PIN gate) ----
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#F1F5F9]">
        <div className="bg-[#0F172A] px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <button onClick={onExit} className="p-1.5 rounded-xl text-white/80 active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-white" />
            <p className="text-sm font-bold text-white">Espace Direction</p>
          </div>
        </div>

        {loginMode === 'choice' && (
          <div className="flex flex-col items-center px-6 pt-16">
            <div className="w-16 h-16 rounded-3xl bg-blue-100 flex items-center justify-center mb-4">
              <Lock size={28} className="text-[#2563EB]" />
            </div>
            <p className="text-sm font-bold text-[#1E293B] mb-1">Acces protege</p>
            <p className="text-xs text-gray-400 text-center mb-8">Choisissez votre mode d'acces a l'espace de gestion.</p>

            <div className="w-full max-w-sm space-y-3">
              {/* Option 1: Directeur */}
              <button
                onClick={() => { setLoginMode('directeur'); setPinError(null); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] active:scale-[0.98] transition text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                  <Mail size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#1E293B]">Directeur</p>
                  <p className="text-xs text-gray-400 mt-0.5">Connexion email + mot de passe</p>
                </div>
                <ChevronDown size={18} className="text-gray-300 -rotate-90" />
              </button>

              {/* Option 2: Adjoint */}
              <button
                onClick={() => { setLoginMode('adjoint'); setPinError(null); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] active:scale-[0.98] transition text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                  <KeyRound size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#1E293B]">Adjoint</p>
                  <p className="text-xs text-gray-400 mt-0.5">Code PIN rapide (4 chiffres)</p>
                </div>
                <ChevronDown size={18} className="text-gray-300 -rotate-90" />
              </button>
            </div>
          </div>
        )}

        {loginMode === 'directeur' && (
          <div className="flex flex-col items-center px-6 pt-12">
            <div className="w-16 h-16 rounded-3xl bg-[#0F172A] flex items-center justify-center mb-4">
              <Mail size={28} className="text-white" />
            </div>
            <p className="text-sm font-bold text-[#1E293B] mb-1">Connexion Directeur</p>
            <p className="text-xs text-gray-400 text-center mb-6">Saisissez vos identifiants de direction.</p>
            <div className="w-full max-w-sm space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@centre.fr"
                  className="w-full mt-1 px-4 py-3 bg-white rounded-2xl text-sm outline-none focus:ring-2 ring-blue-200 border border-[#E2E8F0]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDirecteurLogin()}
                  placeholder="••••••••"
                  className="w-full mt-1 px-4 py-3 bg-white rounded-2xl text-sm outline-none focus:ring-2 ring-blue-200 border border-[#E2E8F0]"
                />
              </div>
              {pinError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <AlertCircle size={16} className="text-rose-500" />
                  <p className="text-xs text-rose-600">{pinError}</p>
                </div>
              )}
              <button
                onClick={handleDirecteurLogin}
                disabled={authLoading}
                className="w-full mt-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                {authLoading ? 'Connexion...' : 'Se connecter'}
              </button>
              <button
                onClick={() => { setLoginMode('choice'); setPinError(null); }}
                className="w-full py-2.5 text-gray-400 text-xs font-semibold active:scale-95 transition"
              >
                Retour au choix
              </button>
            </div>
          </div>
        )}

        {loginMode === 'adjoint' && (
          <div className="flex flex-col items-center px-6 pt-16">
            <div className="w-16 h-16 rounded-3xl bg-blue-100 flex items-center justify-center mb-4">
              <KeyRound size={28} className="text-[#2563EB]" />
            </div>
            <p className="text-sm font-bold text-[#1E293B] mb-1">Acces Adjoint</p>
            <p className="text-xs text-gray-400 text-center mb-6">Saisissez le code PIN pour acceder a l'espace de gestion.</p>
            <div className="w-full max-w-xs">
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="----"
                className="w-full px-4 py-3 bg-white rounded-2xl text-center text-2xl tracking-[0.5em] font-bold text-[#1E293B] outline-none focus:ring-2 ring-blue-200 shadow-sm border border-[#E2E8F0]"
                onKeyDown={(e) => e.key === 'Enter' && handleAdjointUnlock()}
                autoFocus
              />
              {pinError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3">
                  <AlertCircle size={16} className="text-rose-500" />
                  <p className="text-xs text-rose-600">{pinError}</p>
                </div>
              )}
              <button
                onClick={handleAdjointUnlock}
                disabled={pinInput.length < 4}
                className="w-full mt-4 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200"
              >
                Debloquer
              </button>
              <button
                onClick={() => { setLoginMode('choice'); setPinError(null); setPinInput(''); }}
                className="w-full py-2.5 text-gray-400 text-xs font-semibold active:scale-95 transition mt-2"
              >
                Retour au choix
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Effectifs page overlay
  if (showEffectifs) {
    return (
      <EffectifsPage
        children={children}
        pointages={pointages}
        activeSlot={activeSlot}
        centreNom={centreNom}
        onBack={() => setShowEffectifs(false)}
      />
    );
  }

  // Grille Mairie page overlay
  if (showGrille) {
    return (
      <GrilleMairie
        children={children}
        pointages={pointages}
        centreNom={centreNom}
        onBack={() => setShowGrille(false)}
      />
    );
  }

  // Renforts page overlay
  if (showRenforts) {
    return <RenfortsPage onBack={() => setShowRenforts(false)} />;
  }

  // Equipe direction page overlay
  if (showEquipe) {
    return <EquipeDirectionPage onBack={() => setShowEquipe(false)} />;
  }

  // Classes management overlay
  if (showClasses) {
    return <ClassesManagementPage onBack={() => setShowClasses(false)} />;
  }

  // Grille Soir overlay
  if (showGrilleSoir) {
    return <PrintGrilleSoir children={children} centreNom={centreNom} onBack={() => setShowGrilleSoir(false)} />;
  }

  // Grille Mercredi overlay
  if (showGrilleMercredi) {
    return <PrintGrilleMercredi children={children} centreNom={centreNom} onBack={() => setShowGrilleMercredi(false)} />;
  }

  // Calendrier placeholder
  if (showCalendrier) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] pb-8">
        <div className="bg-[#0F172A] px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <button onClick={() => setShowCalendrier(false)} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
            <ArrowLeft size={20} />
            <span className="text-sm font-bold">Retour Direction</span>
          </button>
        </div>
        <div className="px-5 pt-4">
          <h1 className="text-xl font-bold text-[#1E293B]">Calendrier</h1>
          <p className="text-sm text-gray-400">Événements et activités du centre</p>
        </div>
        <div className="px-5 mt-4">
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center">
            <CalIcon size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Module calendrier — bientôt disponible</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Header */}
      <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="p-1.5 rounded-xl text-white/80 active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-white" />
            <p className="text-sm font-bold text-white">Espace Direction</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50 hidden sm:inline">
            {accessRole === 'directeur' ? 'Directeur' : 'Adjoint'}
          </span>
          <p className="text-xs text-white/70">{profile?.full_name}</p>
          {/* Se deconnecter de la Direction */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold active:scale-95 transition hover:bg-white/20"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Se deconnecter</span>
          </button>
        </div>
      </div>

      {/* Ratio gauge */}
      <div className="px-5 pt-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0]">
          <div className="flex items-center gap-3 mb-4">
            <div className={'w-12 h-12 rounded-2xl flex items-center justify-center ' + (ratioStatus === 'ok' ? 'bg-emerald-100' : 'bg-red-100')}>
              <Shield size={24} className={ratioStatus === 'ok' ? 'text-emerald-600' : 'text-red-600'} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Taux réglementaire · {slotRatioLabels[activeSlot]}</p>
              <p className="text-sm font-bold text-[#1E293B]">
                1 animateur pour {legalRatio} enfants ({slotRatioLabels[activeSlot]})
              </p>
            </div>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={'absolute top-0 left-0 h-full rounded-full transition-all duration-500 ' + (ratioStatus === 'ok' ? 'bg-emerald-500' : 'bg-red-500')}
              style={{ width: `${Math.min((animatorCount / Math.max(requiredAnimators, 1)) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">
                {animatorCount} animateur{animatorCount > 1 ? 's' : ''} présent{animatorCount > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{presentChildrenCount} enfants · {requiredAnimators} requis</span>
              {ratioStatus === 'ok' ? (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Conforme</span>
              ) : (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Sous-effectif : manque {requiredAnimators - animatorCount} animateur(s)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6-button grid */}
      {activeView === 'dashboard' && (
        <div className="px-5 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <DirButton icon={Users} label="Équipe" subtitle="Animateurs & absences" color="bg-blue-100" iconColor="text-[#2563EB]" onClick={() => setShowEquipe(true)} />
            <DirButton icon={PhoneCall} label="Liste renfort" subtitle="Remplaçants & évaluations" color="bg-orange-100" iconColor="text-orange-600" onClick={() => setShowRenforts(true)} />
            <DirButton icon={FileSpreadsheet} label="Tableau effectif" subtitle="Récap par niveau" color="bg-emerald-100" iconColor="text-emerald-600" onClick={() => setShowEffectifs(true)} />
            <DirButton icon={Users} label="Gestion enfants" subtitle="Inscrits & import Excel" color="bg-rose-100" iconColor="text-rose-600" onClick={() => setActiveView('enfants')} />
            <DirButton icon={CheckCircle} label="Grille mairie" subtitle="Feuille de pointage" color="bg-sky-100" iconColor="text-sky-600" onClick={() => setShowGrille(true)} />
            <DirButton icon={School} label="Classes & Profs" subtitle="Gestion des classes" color="bg-indigo-100" iconColor="text-indigo-600" onClick={() => setShowClasses(true)} />
            <DirButton icon={Printer} label="Grilles émargement" subtitle="Soir & Mercredi (PDF)" color="bg-teal-100" iconColor="text-teal-600" onClick={() => setActiveView('grilles')} />
            <DirButton icon={CalIcon} label="Calendrier" subtitle="Événements du centre" color="bg-amber-100" iconColor="text-amber-600" onClick={() => setShowCalendrier(true)} />
          </div>
        </div>
      )}

      {activeView === 'dashboard' && (
        <>
          {/* Slot selector */}
          <div className="px-5 pt-4 flex gap-2">
            {(['matin', 'midi', 'soir', 'mercredi'] as TimeSlot[]).map((slot) => (
              <button
                key={slot}
                onClick={() => setActiveSlot(slot)}
                className={'flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition ' + (activeSlot === slot ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
              >
                {slotLabels[slot]}
              </button>
            ))}
          </div>

          {/* Stats cards */}
          <div className="px-5 mt-4 grid grid-cols-2 gap-3">
            <StatCard icon={Users} label="Inscrits" value={totalInscrits} color="indigo" active={selectedStat === 'inscrits'} onClick={() => setSelectedStat(selectedStat === 'inscrits' ? null : 'inscrits')} />
            <StatCard icon={CheckCircle} label="Presents" value={presentCount} color="emerald" active={selectedStat === 'presents'} onClick={() => { setSelectedStat(null); setShowEffectifs(true); }} />
            <StatCard icon={XCircle} label="Absents" value={absentCount} color="rose" active={selectedStat === 'absents'} onClick={() => setSelectedStat(selectedStat === 'absents' ? null : 'absents')} />
            <StatCard icon={LogOut} label="Partis" value={partiCount} color="violet" active={selectedStat === 'partis'} onClick={() => setSelectedStat(selectedStat === 'partis' ? null : 'partis')} />
          </div>

          {/* Cantine - Total du jour (non-nominative count by class) */}
          {activeSlot === 'midi' && (
            <div className="px-5 mt-3">
              <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E8F0] bg-[#F1F5F9]">
                  <Utensils size={18} className="text-[#2563EB]" />
                  <p className="text-sm font-bold text-[#1E293B]">Cantine - Total du jour</p>
                </div>
                <div className="p-4">
                  {/* Big TOTAL display */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">Total du jour</p>
                      <p className="text-xs text-gray-300 mt-0.5">Non-nominatif, par classe</p>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-extrabold text-[#0F172A] leading-none">{cantineTotal}</p>
                      <p className="text-xs text-gray-400 mt-1">repas</p>
                    </div>
                  </div>

                  {/* Count by class */}
                  <div className="pt-3 border-t border-[#E2E8F0]">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Repartition par classe</p>
                    <div className="grid grid-cols-2 gap-2">
                      {sortedClasses.map(([classe, count]) => (
                        <div key={classe} className="flex items-center justify-between py-2 px-3 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]">
                          <span className="text-xs font-semibold text-[#1E293B] truncate">{classe}</span>
                          <span className="text-lg font-bold text-[#2563EB]">{count}</span>
                        </div>
                      ))}
                      {sortedClasses.length === 0 && (
                        <div className="col-span-2 text-center py-4">
                          <p className="text-xs text-gray-300">Aucun enfant present au midi</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cantine / Repas module for Midi slot */}
          {activeSlot === 'midi' && (
            <div className="px-5 mt-3">
              <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E8F0] bg-amber-50">
                  <Utensils size={18} className="text-amber-600" />
                  <p className="text-sm font-bold text-[#1E293B]">Pointage Repas / Cantine</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Total repas commandes</p>
                    <p className="text-2xl font-bold text-amber-600">{totalRepas}</p>
                  </div>
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Repartition des regimes</p>
                    <div className="space-y-1.5">
                      {Object.entries(regimeCounts).sort((a, b) => b[1] - a[1]).map(([regime, count]) => (
                        <div key={regime} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className={'w-2 h-2 rounded-full ' + (regime === 'Standard' ? 'bg-gray-400' : regime === 'Sans porc' ? 'bg-blue-400' : regime === 'Vegetarien' ? 'bg-emerald-400' : 'bg-orange-400')} />
                            <span className="text-xs font-semibold text-gray-700">{regime}</span>
                          </div>
                          <span className="text-sm font-bold text-[#1E293B]">{count}</span>
                        </div>
                      ))}
                      {Object.keys(regimeCounts).length === 0 && (
                        <p className="text-xs text-gray-300 text-center py-2">Aucun enfant present au midi</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={copyCuisineRecap}
                    disabled={totalRepas === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-40 shadow-sm shadow-amber-200"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Recapitulatif copie !' : 'Copier le recapitulatif cuisine'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Soins count */}
          <div className="px-5 mt-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Heart size={18} className="text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Soins dispenses (journee)</p>
                <p className="text-lg font-bold text-[#1E293B]">{careCount}</p>
              </div>
            </div>
          </div>

          {/* Cloture section */}
          <div className="px-5 mt-4">
            {slotClotured ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                    <Lock size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-800">Creneau cloture</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Par {clotureInfo?.responsable_nom} le {new Date(clotureInfo?.cloture_at || '').toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <button
                    onClick={handleUndoCloture}
                    className="px-3 py-2 bg-white text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 active:scale-95 transition"
                  >
                    Rouvrir
                  </button>
                </div>
                <p className="text-xs text-emerald-600 mt-2">Les pointages de ce creneau sont verrouilles. Aucune modification accidentale possible.</p>
              </div>
            ) : (
              <button
                onClick={handleCloture}
                disabled={closing}
                className="w-full py-4 bg-[#0F172A] text-white font-bold rounded-2xl active:scale-95 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-40"
              >
                {closing ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                {closing ? 'Cloture en cours...' : 'Cloturer le creneau'}
              </button>
            )}
          </div>

          {/* Export buttons */}
          <div className="px-5 mt-4 space-y-3">
            <button
              onClick={exportCSV}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <FileDown size={20} className="text-emerald-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-[#1E293B]">Exporter les presences (CSV)</p>
                <p className="text-xs text-gray-400">Fichier Excel/CSV pour CAF et Mairie</p>
              </div>
              <Download size={18} className="text-gray-300" />
            </button>

            <button
              onClick={printPDF}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Printer size={20} className="text-[#2563EB]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-[#1E293B]">Imprimer la feuille de presence</p>
                <p className="text-xs text-gray-400">Mise en page PDF prete a imprimer</p>
              </div>
              <Printer size={18} className="text-gray-300" />
            </button>

            {/* Liste d'evacuation d'urgence */}
            <button
              onClick={printEvacuationList}
              disabled={presentChildrenToday.length === 0}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border-2 border-rose-200 active:scale-[0.98] transition disabled:opacity-40"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-[#1E293B]">Liste d'evacuation d'urgence</p>
                <p className="text-xs text-gray-400">Enfants et animateurs présents du jour (impression)</p>
              </div>
              <Printer size={18} className="text-rose-300" />
            </button>
          </div>

          {/* Security & Access section */}
          <div className="px-5 mt-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={18} className="text-[#2563EB]" />
                <p className="text-sm font-bold text-[#1E293B]">Sécurité &amp; Accès</p>
              </div>
              <p className="text-xs text-gray-400 mb-3">Gérez le code PIN d'accès adjoint. Le changement prend effet immédiatement pour tous les utilisateurs.</p>
              <button
                onClick={() => setShowPinChange(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white text-sm font-bold rounded-xl active:scale-95 transition"
              >
                <Lock size={16} />
                Modifier le code PIN d'accès
              </button>
            </div>
          </div>

          {/* PIN change modal */}
          {showPinChange && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" onClick={() => setShowPinChange(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#1E293B]">Modifier le code PIN</h2>
                  <button onClick={() => setShowPinChange(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                    <X size={20} />
                  </button>
                </div>
                {pinChangeSuccess ? (
                  <div className="flex flex-col items-center py-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
                      <CheckCircle size={28} className="text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700">Code PIN modifié avec succès</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase">Ancien code PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={oldPinInput}
                        onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="----"
                        className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-center text-xl tracking-[0.4em] font-bold text-[#1E293B] outline-none focus:ring-2 ring-blue-200 border border-[#E2E8F0]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase">Nouveau code PIN (4 chiffres)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="----"
                        className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-center text-xl tracking-[0.4em] font-bold text-[#1E293B] outline-none focus:ring-2 ring-blue-200 border border-[#E2E8F0]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase">Confirmer le nouveau code</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="----"
                        className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-center text-xl tracking-[0.4em] font-bold text-[#1E293B] outline-none focus:ring-2 ring-blue-200 border border-[#E2E8F0]"
                        onKeyDown={(e) => e.key === 'Enter' && handlePinChange()}
                      />
                    </div>
                    {pinChangeError && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                        <AlertCircle size={14} />
                        {pinChangeError}
                      </div>
                    )}
                    <button
                      onClick={handlePinChange}
                      disabled={changingPin || !oldPinInput || !newPinInput || !confirmPinInput}
                      className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                      {changingPin ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      {changingPin ? 'Enregistrement...' : 'Enregistrer le nouveau code'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Emergency data reset */}
          <div className="px-5 mt-4">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-red-800">Vider toutes les données locales</p>
                <p className="text-xs text-red-500">Réinitialise l'application pour repartir d'une page blanche</p>
              </div>
            </button>
          </div>

          {/* Date info */}
          <div className="px-5 mt-4">
            <div className="bg-[#F1F5F9] rounded-2xl p-3 flex items-center gap-2 text-xs text-gray-400">
              <Calendar size={14} />
              <span>Date: {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </>
      )}

      {activeView === 'enfants' && (
        <>
          {/* Back to dashboard */}
          <div className="px-5 mt-4">
            <button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 active:scale-95 transition"
            >
              <ArrowLeft size={16} />
              Retour au tableau de bord
            </button>
          </div>

          {/* Add child + Import buttons */}
          <div className="px-5 mt-4 space-y-3">
            <button
              onClick={() => { setEditChild(null); setShowAddChild(true); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-blue-200"
            >
              <Plus size={18} />
              Ajouter un enfant
            </button>

            {/* Slot selector for import */}
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Créneau d'inscription</p>
              <div className="flex gap-2">
                {([
                  { value: 'midi', label: 'Midi' },
                  { value: 'soir', label: 'Soir' },
                  { value: 'mercredi', label: 'Mercredi' },
                ] as { value: 'midi' | 'soir' | 'mercredi'; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setImportSlot(opt.value)}
                    className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + (importSlot === opt.value ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-300 mt-2">Les enfants existants ne seront pas dupliqués : seule leur inscription au créneau sélectionné sera cochée.</p>
            </div>

            <button
              onClick={() => fileInputRefState?.click()}
              disabled={importing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white text-[#2563EB] font-bold rounded-2xl active:scale-95 transition border-2 border-blue-200 disabled:opacity-40"
            >
              {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {importing ? 'Import en cours...' : 'Importer Excel / CSV'}
            </button>
            <input
              ref={(el) => setFileInputRefState(el)}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => handleImportFile(e)}
            />
            {importStatus && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${importStatus.startsWith('Erreur') ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                {importStatus.startsWith('Erreur') ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                {importStatus}
              </div>
            )}
          </div>

          {/* Children list */}
          <div className="px-5 mt-4 space-y-3">
            {children.map((child) => (
              <div key={child.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className={'w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ' + getAvatarColor(child.firstName + child.lastName)}>
                    {getInitials(child.firstName, child.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#1E293B] truncate">{child.firstName} {child.lastName}</p>
                      {child.pai && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <Heart size={10} className="text-orange-500" />
                          {child.pai.allergy}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {getSectionLabel(child.section)} - {child.classe} - {getAge(child.birthDate)} ans
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditChild(child); setShowAddChild(true); }}
                    className="p-2 rounded-xl bg-blue-50 text-blue-500 active:scale-90 transition"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteChild(child.id)}
                    className="p-2 rounded-xl bg-rose-50 text-rose-500 active:scale-90 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {children.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Users size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun enfant inscrit</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeView === 'grilles' && (
        <>
          <div className="px-5 mt-4">
            <button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 active:scale-95 transition"
            >
              <ArrowLeft size={16} />
              Retour au tableau de bord
            </button>
          </div>
          <div className="px-5 mt-4">
            <h1 className="text-xl font-bold text-[#1E293B]">Grilles d'émargement</h1>
            <p className="text-sm text-gray-400">Feuilles imprimables pour le terrain</p>
          </div>
          <div className="px-5 mt-4 space-y-3">
            <button
              onClick={() => setShowGrilleSoir(true)}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Printer size={20} className="text-teal-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-[#1E293B]">Grille hebdomadaire du Soir</p>
                <p className="text-xs text-gray-400">A4 paysage · Lundi au Vendredi · 16h30 à 18h30</p>
              </div>
            </button>
            <button
              onClick={() => setShowGrilleMercredi(true)}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] active:scale-[0.98] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Printer size={20} className="text-teal-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-[#1E293B]">Grille du Mercredi</p>
                <p className="text-xs text-gray-400">A4 journalier · Matin, Repas, départs 16h45 à 18h30</p>
              </div>
            </button>
          </div>
        </>
      )}
      {showAddChild && (
        <AddChildModal
          child={editChild}
          onClose={() => { setShowAddChild(false); setEditChild(null); }}
          onSave={handleSaveChild}
        />
      )}

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" onClick={() => setShowResetConfirm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mb-3">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">Vider toutes les données locales ?</p>
              <p className="text-xs text-gray-400 mt-1">
                Cette action supprime les enfants, l'équipe, les pointages et les soins stockés localement. Les données du serveur ne sont pas affectées.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-2xl active:scale-95 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onChildrenChange([]);
                  setPointages([]);
                  setClotures([]);
                  setEnfantRows([]);
                  setCareCount(0);
                  try {
                    localStorage.removeItem('auth_user');
                    localStorage.removeItem('active-centre-id');
                  } catch { /* ignore */ }
                  setShowResetConfirm(false);
                  window.location.reload();
                }}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-red-200"
              >
                Vider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail bottom sheet */}
      {selectedStat && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center" onClick={() => setSelectedStat(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease]" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] animate-[slideUp_0.25s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[#1E293B]">
                  {getChildrenForStat().length}{' '}
                  {selectedStat === 'inscrits' ? 'inscrits' : selectedStat === 'presents' ? 'présents' : selectedStat === 'absents' ? 'absents' : 'partis'}
                </p>
                <p className="text-xs text-gray-400">{slotLabels[activeSlot]} - {centreNom}</p>
              </div>
              <button
                onClick={() => setSelectedStat(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {groupedChildren.map(([section, sectionChildren]) => (
                <div key={section} className="mb-4">
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{getSectionLabel(section as Section)}</span>
                    <span className="text-xs text-gray-300">({sectionChildren.length})</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  {sectionChildren.map((child) => {
                    const name = childFullName(child);
                    const pt = slotPointages.find((p) => p.enfant_nom === name);
                    const heure = pt ? new Date(pt.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    return (
                      <div key={child.id} className="flex items-center gap-3 py-2.5 border-b border-[#E2E8F0]">
                        <div className={'w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0 ' + getAvatarColor(child.firstName + child.lastName)}>
                          {getInitials(child.firstName, child.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1E293B] truncate">{child.lastName} {child.firstName}</p>
                          <p className="text-[10px] text-gray-400">{child.classe}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{heure}</span>
                          {child.pai && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded-full flex items-center gap-0.5">
                              <Heart size={8} className="text-orange-500" />
                              PAI
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {getChildrenForStat().length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aucun enfant dans cette categorie</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat card component
function StatCard({ icon: Icon, label, value, color, active, onClick }: { icon: typeof Users; label: string; value: number; color: string; active?: boolean; onClick?: () => void }) {
  const colorMap: Record<string, { bg: string; text: string; icon: string; ring: string }> = {
    indigo: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500', ring: 'ring-blue-300' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500', ring: 'ring-emerald-300' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-500', ring: 'ring-rose-300' },
    violet: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500', ring: 'ring-blue-300' },
  };
  const c = colorMap[color] || colorMap.indigo;
  return (
    <button
      onClick={onClick}
      className={'rounded-2xl p-4 shadow-sm border transition-all text-left ' + c.bg + (active ? ' ring-2 ' + c.ring + ' scale-[1.02]' : ' border-[#E2E8F0] active:scale-[0.98]')}
    >
      <div className="flex items-center justify-between">
        <Icon size={18} className={c.icon} />
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <p className={'text-xs font-semibold mt-1 ' + c.text}>{label}</p>
    </button>
  );
}

// Direction dashboard button (6-button grid)
function DirButton({ icon: Icon, label, subtitle, color, iconColor, onClick }: {
  icon: typeof Users; label: string; subtitle: string; color: string; iconColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0] flex flex-col items-start gap-3 active:scale-[0.97] transition hover:shadow-md text-left"
    >
      <div className={'w-12 h-12 rounded-2xl flex items-center justify-center ' + color}>
        <Icon size={24} className={iconColor} />
      </div>
      <div>
        <p className="text-sm font-bold text-[#1E293B]">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}

// Add/Edit child modal
function AddChildModal({ child, onClose, onSave }: {
  child: Child | null;
  onClose: () => void;
  onSave: (data: {
    firstName: string; lastName: string; section: Section; classe: string; birthDate: string;
    regime: string; hasPai: boolean; allergy: string; protocol: string;
    emergencyContact: string; emergencyPhone: string; departureTime: string; pickupBy: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState(child?.firstName || '');
  const [lastName, setLastName] = useState(child?.lastName || '');
  const [section, setSection] = useState<Section>(child?.section || 'PS');
  const [classe, setClasse] = useState(child?.classe || 'Classe 1 - PS');
  const [birthDate, setBirthDate] = useState(child?.birthDate || '2021-01-01');
  const [regime, setRegime] = useState('');
  const [hasPai, setHasPai] = useState(!!child?.pai);
  const [allergy, setAllergy] = useState(child?.pai?.allergy || '');
  const [protocol, setProtocol] = useState(child?.pai?.protocol || '');
  const [emergencyContact, setEmergencyContact] = useState(child?.pai?.emergencyContact || '');
  const [emergencyPhone, setEmergencyPhone] = useState(child?.pai?.emergencyPhone || '');
  const [departureTime, setDepartureTime] = useState(child?.departureTime || '16:30');
  const [pickupBy, setPickupBy] = useState(child?.pickupBy || '');

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) return;
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      section,
      classe,
      birthDate,
      regime: regime.trim(),
      hasPai,
      allergy: allergy.trim(),
      protocol: protocol.trim(),
      emergencyContact: emergencyContact.trim(),
      emergencyPhone: emergencyPhone.trim(),
      departureTime,
      pickupBy: pickupBy.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-lg font-bold text-[#1E293B]">{child ? 'Modifier' : 'Ajouter'} un enfant</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Prenom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Nom</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Section</label>
            <div className="flex gap-2 mt-1">
              {(['PS', 'MS', 'GS'] as Section[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition ' + (section === s ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Classe</label>
            <input value={classe} onChange={(e) => setClasse(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Date de naissance</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Regime alimentaire (optionnel)</label>
            <input value={regime} onChange={(e) => setRegime(e.target.value)} placeholder="Ex: sans porc, vegetarien" className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
          </div>

          {/* PAI section */}
          <div className="pt-3 border-t border-[#E2E8F0]">
            <button
              onClick={() => setHasPai(!hasPai)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Heart size={16} className={hasPai ? 'text-orange-500' : 'text-gray-300'} />
                <p className="text-sm font-bold text-[#1E293B]">PAI / Allergie</p>
              </div>
              <div className={'relative w-12 h-7 rounded-full transition ' + (hasPai ? 'bg-orange-500' : 'bg-gray-200')}>
                <div className={'absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ' + (hasPai ? 'left-6' : 'left-1')} />
              </div>
            </button>
            {hasPai && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Allergie</label>
                  <input value={allergy} onChange={(e) => setAllergy(e.target.value)} placeholder="Ex: Arachides" className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-orange-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Protocole / Conduite a tenir</label>
                  <textarea value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="Ex: Eviter contact, injecter EpiPen, appeler SAMU" className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-orange-200 resize-none" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Contact d urgence</label>
                    <input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Nom" className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-orange-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Telephone</label>
                    <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="06..." className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-orange-200" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Departure info */}
          <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Heure de depart</label>
              <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Recupere par</label>
              <input value={pickupBy} onChange={(e) => setPickupBy(e.target.value)} placeholder="Maman, Papa..." className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!firstName.trim() || !lastName.trim()}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200"
          >
            {child ? 'Enregistrer les modifications' : 'Ajouter l enfant'}
          </button>
        </div>
      </div>
    </div>
  );
}
