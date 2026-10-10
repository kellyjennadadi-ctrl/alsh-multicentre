import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { PlanningTab } from '@/tabs/PlanningTab';
import { PointageTab } from '@/tabs/PointageTab';
import { SanteTab } from '@/tabs/SanteTab';
import { AnimationTab } from '@/tabs/AnimationTab';
import { EspaceProTab } from '@/tabs/EspaceProTab';
import { useOfflineSync } from '@/lib/useOfflineSync';
import { Loader2, WifiOff, RefreshCw, Check, AlertCircle, Heart, Mail, Lock, Eye, EyeOff, ChevronRight, Zap, UserPlus, User as UserIcon } from 'lucide-react';
import { AppHeader } from '@/components/ProfileMenu';
import { useAuth, DEMO_ACCESS_ENABLED } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { CentreSelectionScreen } from '@/components/CentreSelectionScreen';
import { children as initialChildren, animators as initialAnimators, schoolClasses as initialClasses } from '@/data/mockData';
import type { TabKey, Child, Animator, SchoolClass, AppMode, TimeSlot, Section } from '@/types';

interface PointageRow {
  id: string;
  centre_nom: string;
  enfant_nom: string;
  statut: string;
  creneau: string;
  date_pointage: string;
  updated_at: string;
}

interface EnfantDbRow {
  id: string;
  first_name: string;
  last_name: string;
  section: string;
  classe: string;
  birth_date: string | null;
  regime_alimentaire: string | null;
  pai_allergie: string | null;
  pai_protocole: string | null;
  pai_contact_urgence: string | null;
  pai_telephone_urgence: string | null;
  departure_time: string | null;
  pickup_by: string | null;
  inscrit_midi: boolean | null;
  inscrit_soir: boolean | null;
  inscrit_mercredi: boolean | null;
}

// Fiche enfant (base de données) -> objet utilisé par l'application
function rowToChild(r: EnfantDbRow): Child {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    section: r.section as Section,
    classe: r.classe,
    birthDate: r.birth_date || '',
    regime: r.regime_alimentaire || undefined,
    pai: r.pai_allergie !== null
      ? {
          allergy: r.pai_allergie || '',
          protocol: r.pai_protocole || '',
          emergencyContact: r.pai_contact_urgence || '',
          emergencyPhone: r.pai_telephone_urgence || '',
        }
      : null,
    departureTime: r.departure_time || undefined,
    pickupBy: r.pickup_by || undefined,
    present: { matin: false, midi: false, soir: false, mercredi: false },
    inscritMidi: !!r.inscrit_midi,
    inscritSoir: !!r.inscrit_soir,
    inscritMercredi: !!r.inscrit_mercredi,
  };
}

// Applique des lignes de pointage à une liste d'enfants (fonction pure)
function applyRows(list: Child[], rows: PointageRow[]): Child[] {
  if (rows.length === 0) return list;
  const byName = new Map<string, PointageRow[]>();
  for (const row of rows) {
    const arr = byName.get(row.enfant_nom);
    if (arr) arr.push(row); else byName.set(row.enfant_nom, [row]);
  }
  return list.map((child) => {
    const childRows = byName.get(childFullName(child));
    if (!childRows) return child;
    const present = { ...child.present };
    for (const row of childRows) {
      const slot = dbToSlot[row.creneau];
      if (!slot) continue;
      present[slot] = row.statut === 'present';
    }
    return { ...child, present };
  });
}

const slotToDb: Record<TimeSlot, string> = {
  matin: 'matin',
  midi: 'midi',
  soir: 'soir',
  mercredi: 'journee',
};

const dbToSlot: Record<string, TimeSlot> = {
  matin: 'matin',
  midi: 'midi',
  soir: 'soir',
  journee: 'mercredi',
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function childFullName(c: Child): string {
  return c.firstName + ' ' + c.lastName;
}

function App() {
  const { isAuthenticated, activeCentre, loading, demoSignIn, signIn, signUp } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-3xl bg-white/15 flex items-center justify-center mb-3 shadow-lg">
          <Heart size={28} className="text-white animate-pulse" />
        </div>
        <Loader2 size={20} className="animate-spin text-blue-200" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <InlineLogin demoSignIn={demoSignIn} signIn={signIn} signUp={signUp} />;
  }

  if (!activeCentre) {
    return (
      <ErrorBoundary fallbackName="CentreSelection">
        <CentreSelectionScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackName="Application" onReset={() => window.location.reload()}>
      {/* key = centre : changer de structure remet à zéro tout l'état (enfants, pointages, classes) */}
      <AppContent key={activeCentre.id} />
    </ErrorBoundary>
  );
}

type LoginMode = 'signin' | 'signup';

const ROLES = [
  { value: 'animateur', label: 'Animateur/trice' },
  { value: 'adjoint', label: 'Adjoint(e)' },
  { value: 'directeur', label: 'Directeur/trice' },
] as const;

function InlineLogin({
  demoSignIn,
  signIn,
  signUp,
}: {
  demoSignIn: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: string | null }>;
}) {
  const [mode, setMode] = useState<LoginMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('animateur');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);


  const handleSignIn = async (e?: { preventDefault: () => void }) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(
          /invalid login/i.test(err)
            ? 'E-mail ou mot de passe incorrect.'
            : err
        );
      }
      // En cas de succès, l'état d'authentification change et l'écran
      // « Choisir votre centre » s'affiche automatiquement.
    } catch {
      setError('Impossible de se connecter. Veuillez réessayer.');
    }
    setSubmitting(false);
  };

  const handleSignUp = async (e?: { preventDefault: () => void }) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) return;
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await signUp(email.trim(), password, fullName.trim(), role);
      if (err) {
        setError(err);
        setSubmitting(false);
        return;
      }
      setSuccessMsg('Compte créé ! Vous pouvez maintenant vous connecter.');
      setMode('signin');
      setPassword('');
    } catch {
      setError('Impossible de créer le compte. Vérifiez votre connexion.');
    }
    setSubmitting(false);
  };

  const handleDirectAccess = () => {
    demoSignIn();
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center px-6 py-10 relative">
      {/* Accès démo — uniquement en développement ou si VITE_ALLOW_DEMO_ACCESS=true */}
      {DEMO_ACCESS_ENABLED && (
      <button
        onClick={handleDirectAccess}
        className="absolute top-4 right-4 text-xs text-blue-300/60 hover:text-blue-200 font-medium flex items-center gap-1 active:scale-95 transition"
        type="button"
      >
        <Zap size={12} />
        Accès démo
      </button>
      )}

      {/* Header */}
      <div className="flex flex-col items-center mb-8 w-full max-w-sm">
        <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg">
          <Heart size={32} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Accueil Loisirs</h1>
        <p className="text-sm text-blue-200 mt-1 text-center">Gestion d'activités périscolaires</p>
      </div>

      {/* ─── Connexion / création de compte ─── */}
      {(
        <form
          onSubmit={(e) => { e.preventDefault(); mode === 'signin' ? handleSignIn() : handleSignUp(); }}
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-5"
        >
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => switchMode('signin')}
              className={'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition ' +
                (mode === 'signin' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-gray-400')}
              type="button"
            >
              <UserIcon size={14} />
              Connexion
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition ' +
                (mode === 'signup' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-gray-400')}
              type="button"
            >
              <UserPlus size={14} />
              Créer un compte
            </button>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <Check size={16} className="text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700">{successMsg}</p>
            </div>
          )}

          {/* Full name — sign-up only */}
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Nom et prénom</label>
              <div className="relative mt-1">
                <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Marie Dupont"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Adresse e-mail</label>
            <div className="relative mt-1">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marie.dupont@centre.fr"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Mot de passe</label>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? '6 caractères minimum' : '********'}
                className="w-full pl-10 pr-10 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300"
                type="button"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Role selector — sign-up only */}
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Rôle</label>
              <div className="flex gap-2 mt-1">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={'flex-1 py-2.5 rounded-xl text-xs font-bold transition ' +
                      (role === r.value ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-gray-100 text-gray-500')}
                    type="button"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
              <p className="text-xs text-rose-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password.trim() || (mode === 'signup' && !fullName.trim())}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> :
              mode === 'signin' ? <ChevronRight size={18} /> : <UserPlus size={18} />}
            {submitting ? 'Veuillez patienter...' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      )}

    </div>
  );
}

function AppContent() {
  const { activeCentre, profile, isAuthenticated } = useAuth();
  // AppContent n'est rendu que lorsqu'un centre est actif (voir App()).
  const centre = activeCentre!;
  const centreNom = centre.name;
  const [activeTab, setActiveTab] = useState<TabKey>('aujourdhui');
  const [pointageSlot, setPointageSlot] = useState<TimeSlot>('midi');
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [_animators] = useState<Animator[]>(initialAnimators);
  const [classes, setClasses] = useState<SchoolClass[]>(initialClasses);
  const [appMode, setAppMode] = useState<AppMode>('peri');
  const { status: connStatus, pendingCount, syncing, queuePointage, dequeuePointage, syncPending } = useOfflineSync();
  const isDemoCentre = centre.id.startsWith('demo-');

  // Applique une ligne de pointage reçue en temps réel
  const applySinglePointage = useCallback((row: PointageRow) => {
    setChildren((prev) => applyRows(prev, [row]));
  }, []);

  // ── Chargement des enfants (fiches, PAI, régimes) + pointages du jour, puis temps réel ──
  // Les fiches enfants viennent de la table `enfants` du centre actif : elles ne dépendent
  // plus de l'ouverture de l'Espace Direction.
  useEffect(() => {
    if (!isAuthenticated || !profile || isDemoCentre) return;

    let cancelled = false;
    const today = getToday();

    const loadAll = async () => {
      const [enf, poi] = await Promise.all([
        supabase.from('enfants').select('*').eq('centre_nom', centreNom).order('last_name'),
        supabase.from('pointages').select('*').eq('centre_nom', centreNom).eq('date_pointage', today),
      ]);
      if (cancelled) return;
      const rows = !poi.error && poi.data ? (poi.data as PointageRow[]) : [];
      if (!enf.error && enf.data) {
        const base = (enf.data as EnfantDbRow[]).map(rowToChild);
        setChildren(applyRows(base, rows));
      } else if (rows.length > 0) {
        setChildren((prev) => applyRows(prev, rows));
      }
    };

    loadAll();

    const pointagesChannel = supabase
      .channel('pointages-' + centre.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pointages', filter: 'centre_nom=eq.' + centreNom },
        (payload) => {
          const row = payload.new as PointageRow;
          if (!row || row.date_pointage !== today) return;
          applySinglePointage(row);
        }
      )
      .subscribe();

    // Changement de fiche enfant (ajout, import Excel, modification PAI/régime...) : on recharge
    const enfantsChannel = supabase
      .channel('enfants-' + centre.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'enfants', filter: 'centre_nom=eq.' + centreNom },
        () => { loadAll(); }
      )
      .subscribe();

    // Au retour sur l'application (téléphone déverrouillé, onglet réactivé) : resynchronisation
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(pointagesChannel);
      supabase.removeChannel(enfantsChannel);
    };
  }, [centre.id, centreNom, isDemoCentre, isAuthenticated, profile, applySinglePointage]);

  // ── Enregistre un pointage (upsert atomique) ou le met en file d'attente si hors-ligne ──
  const persistPointage = useCallback(
    async (child: Child, slot: TimeSlot, statut: string) => {
      if (!isAuthenticated || !profile || isDemoCentre) return;
      const payload = {
        centre_nom: centreNom,
        enfant_nom: childFullName(child),
        statut,
        creneau: slotToDb[slot],
        date_pointage: getToday(),
      };

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { error } = await supabase
          .from('pointages')
          .upsert(payload, { onConflict: 'centre_nom,enfant_nom,creneau,date_pointage' });
        if (!error) {
          // Écriture réussie : supprimer une éventuelle ancienne version en attente (sinon elle écraserait celle-ci)
          dequeuePointage(payload);
          return;
        }
      }
      queuePointage(payload);
    },
    [centreNom, queuePointage, dequeuePointage, isAuthenticated, profile, isDemoCentre]
  );

  const togglePresent = useCallback(
    (childId: string, slot: TimeSlot) => {
      const child = children.find((c) => c.id === childId);
      if (!child) return;
      // Valeur calculée depuis l'état courant (et non dans le callback de setState,
      // qui peut s'exécuter plus tard et faire enregistrer la mauvaise valeur).
      const newPresent = !child.present[slot];
      setChildren((prev) =>
        prev.map((c) => (c.id === childId ? { ...c, present: { ...c.present, [slot]: newPresent } } : c))
      );
      persistPointage(child, slot, newPresent ? 'present' : 'absent');
    },
    [children, persistPointage]
  );

  const markDeparted = useCallback(
    (childId: string, slot: TimeSlot) => {
      setChildren((prev) =>
        prev.map((c) =>
          c.id === childId
            ? { ...c, present: { ...c.present, [slot]: false } }
            : c
        )
      );

      const child = children.find((c) => c.id === childId);
      if (child) {
        persistPointage(child, slot, 'parti');
      }
    },
    [children, persistPointage]
  );

  const markDepartedWithTime = useCallback(
    (childId: string, slot: TimeSlot, time: string) => {
      setChildren((prev) =>
        prev.map((c) =>
          c.id === childId
            ? { ...c, present: { ...c.present, [slot]: false }, departureTime: time }
            : c
        )
      );

      const child = children.find((c) => c.id === childId);
      if (child) {
        persistPointage(child, slot, 'parti');
      }
    },
    [children, persistPointage]
  );

  const renameClass = useCallback((classId: string, newName: string) => {
    setClasses((prev) =>
      prev.map((cl) => (cl.id === classId ? { ...cl, name: newName } : cl))
    );
    setChildren((prev) => {
      const cls = initialClasses.find((c) => c.id === classId);
      if (!cls) return prev;
      return prev.map((c) =>
        c.classe === cls.name ? { ...c, classe: newName } : c
      );
    });
  }, []);

  const addClass = useCallback((name: string, level: SchoolClass['level']) => {
    const newId = 'cl' + Date.now();
    setClasses((prev) => [...prev, { id: newId, name, level }]);
  }, []);

  const deleteClass = useCallback((classId: string) => {
    setClasses((prev) => prev.filter((cl) => cl.id !== classId));
  }, []);

  const addAbsence = useCallback((animatorId: string, date: string, slot: 'Midi' | 'Soir' | 'Journée', reason: string) => {
    void animatorId; void date; void slot; void reason;
  }, []);

  // Safety net: profile is guaranteed non-null via DEFAULT_PROFILE in auth context.
  // This guard only triggers if something truly unexpected happens — it won't crash.
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-blue-100 flex items-center justify-center mb-4">
          <Heart size={28} className="text-[#2563EB]" />
        </div>
        <p className="text-sm font-bold text-[#1E293B] mb-1">Chargement...</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-5 py-2.5 bg-[#2563EB] text-white text-sm font-bold rounded-2xl active:scale-95 transition"
        >
          Recharger
        </button>
      </div>
    );
  }

  // ── Main app ──
  // Pointage is a full-screen overlay (not in bottom nav)
  if (activeTab === 'pointage') {
    return (
      <ErrorBoundary fallbackName="Pointage">
        <PointageTab children={children} onTogglePresent={togglePresent} onMarkDeparted={markDeparted} onMarkDepartedWithTime={markDepartedWithTime} classes={classes} mode={appMode} onModeChange={setAppMode} initialSlot={pointageSlot} onBack={() => setActiveTab('aujourdhui')} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-[#F1F5F9] min-h-screen relative">
      {/* Offline / sync banner */}
      <OfflineBanner
        status={connStatus}
        pendingCount={pendingCount}
        syncing={syncing}
        onSync={syncPending}
      />
      <AppHeader onNavigateDirection={() => setActiveTab('espacepro')} centreName={centreNom} />
      <div className="pt-2">
        {activeTab === 'aujourdhui' && <PlanningTab onNavigate={setActiveTab} children={children} mode={appMode} onModeChange={setAppMode} onOpenPointage={(slot: TimeSlot) => { setPointageSlot(slot); setActiveTab('pointage'); }} />}
        {activeTab === 'animation' && <AnimationTab />}
        {activeTab === 'sante' && <SanteTab />}
        {activeTab === 'espacepro' && (
          <EspaceProTab children={children} onChildrenChange={setChildren} centrePin={centre.pin_code} />
        )}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;

function OfflineBanner({ status, pendingCount, syncing, onSync }: {
  status: 'online' | 'offline';
  pendingCount: number;
  syncing: boolean;
  onSync: () => void;
}) {
  if (status === 'online' && pendingCount === 0 && !syncing) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1 bg-emerald-50 border-b border-emerald-100">
        <Check size={11} className="text-emerald-500" />
        <span className="text-[10px] font-semibold text-emerald-600">Connecte / Synchronise</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1 bg-orange-50 border-b border-orange-100">
        <WifiOff size={11} className="text-orange-500" />
        <span className="text-[10px] font-semibold text-orange-600">
          Mode hors-ligne - Donnees enregistrees localement{pendingCount > 0 ? ' (' + pendingCount + ' en attente)' : ''}
        </span>
      </div>
    );
  }

  if (syncing || pendingCount > 0) {
    return (
      <button onClick={onSync} className="w-full flex items-center justify-center gap-1.5 py-1 bg-blue-50 border-b border-blue-100 active:scale-95 transition">
        <RefreshCw size={11} className={'text-blue-500 ' + (syncing ? 'animate-spin' : '')} />
        <span className="text-[10px] font-semibold text-blue-600">
          {syncing ? 'Synchronisation en cours...' : 'Synchroniser ' + pendingCount + ' pointage(s) en attente'}
        </span>
      </button>
    );
  }

  return null;
}

export function useNow(intervalMs: number = 30000): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

class ErrorBoundary extends Component<{ children: ReactNode; fallbackName: string; onReset?: () => void }, { hasError: boolean; errorMessage: string; errorStack: string }> {
  state = { hasError: false, errorMessage: '', errorStack: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message, errorStack: error.stack || '' };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary [' + this.props.fallbackName + ']:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-6 py-8">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 flex items-center justify-center mb-4">
            <AlertCircle size={28} className="text-rose-500" />
          </div>
          <p className="text-sm font-bold text-[#1E293B] mb-1">Erreur dans le module {this.props.fallbackName}</p>

          {/* Raw error message */}
          <div className="w-full max-w-lg mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 overflow-hidden">
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-2">Message d'erreur</p>
            <pre className="text-xs text-rose-900 font-mono whitespace-pre-wrap break-all">{this.state.errorMessage}</pre>
          </div>

          {/* Stack trace */}
          {this.state.errorStack && (
            <div className="w-full max-w-lg mt-3 bg-gray-900 border border-gray-700 rounded-2xl p-4 overflow-hidden">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Stack trace</p>
              <pre className="text-[10px] text-gray-300 font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">{this.state.errorStack}</pre>
            </div>
          )}

          <button
            onClick={() => { this.setState({ hasError: false, errorMessage: '', errorStack: '' }); this.props.onReset?.(); }}
            className="mt-5 px-5 py-2.5 bg-[#2563EB] text-white text-sm font-bold rounded-2xl active:scale-95 transition"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
