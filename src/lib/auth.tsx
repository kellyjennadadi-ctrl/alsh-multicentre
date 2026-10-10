import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface Centre {
  id: string;
  name: string;
  pin_code: string;
  type?: string;
}

export interface UserProfile {
  full_name: string;
  role: string;
  email: string;
  phone: string | null;
  diploma: string | null;
  emergency_contact: string | null;
}

interface AuthState {
  session: import('@supabase/supabase-js').Session | null;
  profile: UserProfile | null;
  centres: Centre[];
  activeCentre: Centre | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  selectCentre: (centre: Centre, pinCode: string) => Promise<{ error: string | null }>;
  createCentre: (name: string, type: string, pinCode: string) => Promise<{ error: string | null; centre?: Centre }>;
  clearActiveCentre: () => void;
  refreshCentres: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'phone' | 'diploma' | 'emergency_contact' | 'full_name' | 'role'>>) => Promise<{ error: string | null }>;
  demoSignIn: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_CENTRE = 'active-centre-id';

const DEFAULT_PROFILE: UserProfile = {
  full_name: 'Utilisateur',
  role: 'animateur',
  email: '',
  phone: null,
  diploma: null,
  emergency_contact: null,
};

// Le mode démo (accès sans compte) est désactivé par défaut.
// Pour l'activer en développement : VITE_ALLOW_DEMO_ACCESS=true dans .env
export const DEMO_ACCESS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEMO_ACCESS === 'true';

const STORAGE_CENTRES_CACHE = 'centres-cache';

const DEMO_CENTRES: Centre[] = [
  { id: 'demo-1', name: 'Centre de démonstration', pin_code: '2026', type: 'Periscolaire' },
];

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

// Dernière liste de centres connue (permet de choisir un centre hors-ligne)
function loadCachedCentres(): Centre[] {
  try {
    const raw = localStorage.getItem(STORAGE_CENTRES_CACHE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Centre[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function cacheCentres(list: Centre[]) {
  try { localStorage.setItem(STORAGE_CENTRES_CACHE, JSON.stringify(list)); } catch { /* ignore */ }
}

function splitFullName(fullName: string, fallback: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || fallback;
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(DEFAULT_PROFILE);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [activeCentre, setActiveCentre] = useState<Centre | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchProfile = useCallback(async (userId: string, email: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name, role, phone, diploma, emergency_contact')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        const d = data as { full_name: string; role: string; phone: string | null; diploma: string | null; emergency_contact: string | null };
        setProfile({
          full_name: d.full_name,
          role: d.role,
          email,
          phone: d.phone,
          diploma: d.diploma,
          emergency_contact: d.emergency_contact,
        });
      } else {
        setProfile({ full_name: email, role: 'animateur', email, phone: null, diploma: null, emergency_contact: null });
      }
    } catch {
      setProfile({ full_name: email, role: 'animateur', email, phone: null, diploma: null, emergency_contact: null });
    }
  }, []);

  const refreshCentres = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('centres')
        .select('id, name, pin_code, type')
        .order('name', { ascending: true });
      if (error || !data) {
        setCentres(loadCachedCentres());
        return;
      }
      const list = data as Centre[];
      cacheCentres(list);
      setCentres(list);
    } catch {
      setCentres(loadCachedCentres());
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Check for a saved Supabase session (instant, no blocking)
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        setSession(s);
        if (s) {
          setIsAuthenticated(true);
          fetchProfile(s.user.id, s.user.email || '');
          refreshCentres();
        }
        // If no session, keep default profile so app renders without crashing;
        // the user can interact and sign in from the login screen when they choose to.
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) {
        setIsAuthenticated(true);
        fetchProfile(s.user.id, s.user.email || '');
        refreshCentres();
      } else {
        // Sign-out: clear auth state but keep a default profile so React doesn't crash
        setIsAuthenticated(false);
        setProfile(DEFAULT_PROFILE);
        setActiveCentre(null);
        setCentres([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile, refreshCentres]);

  // Restore active centre from localStorage when centres load
  useEffect(() => {
    if (isAuthenticated && centres.length > 0 && !activeCentre) {
      const savedId = safeGetItem(STORAGE_CENTRE);
      if (savedId) {
        const found = centres.find((c) => c.id === savedId);
        if (found) setActiveCentre(found);
      }
    }
  }, [centres, activeCentre, isAuthenticated]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message || null };
    } catch {
      return { error: 'Impossible de se connecter au serveur. Vérifiez votre connexion.' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (data.user) {
        const { error: profileErr } = await supabase
          .from('user_profiles')
          .insert({ id: data.user.id, email, full_name: fullName, role });
        if (profileErr) return { error: profileErr.message };

      }
      return { error: null };
    } catch {
      return { error: 'Impossible de créer le compte. Vérifiez votre connexion.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try { localStorage.removeItem(STORAGE_CENTRE); } catch { /* ignore */ }
    setSession(null);
    setActiveCentre(null);
    setProfile(DEFAULT_PROFILE);
    setCentres([]);
    setIsAuthenticated(false);
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  }, []);

  const demoSignIn = useCallback(() => {
    if (!DEMO_ACCESS_ENABLED) return;
    setIsAuthenticated(true);
    setProfile({
      full_name: 'Utilisateur Démo',
      role: 'animateur',
      email: 'demo@accueil-loisirs.fr',
      phone: null,
      diploma: null,
      emergency_contact: null,
    });
    setCentres(DEMO_CENTRES);
    setActiveCentre(DEMO_CENTRES[0]);
    setLoading(false);
  }, []);

  // Crée (si besoin) la fiche équipe de l'utilisateur dans le centre choisi
  const ensureAnimateur = useCallback(async (centre: Centre) => {
    if (centre.id.startsWith('demo-') || !session?.user || !profile) return;
    try {
      const { firstName, lastName } = splitFullName(profile.full_name, profile.email.split('@')[0] || 'Utilisateur');
      const { data } = await supabase
        .from('animateurs')
        .select('id')
        .eq('centre_nom', centre.name)
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .maybeSingle();
      if (data) return;
      const dbRole = profile.role === 'directeur' ? 'Direction' : profile.role === 'adjoint' ? 'Adjoint' : 'Permanent';
      await supabase.from('animateurs').insert({
        centre_nom: centre.name,
        first_name: firstName,
        last_name: lastName,
        role: dbRole,
        phone: profile.phone || '',
        diplomas: [],
        slots: [],
        present_today: false,
      });
    } catch { /* non bloquant */ }
  }, [session, profile]);

  const selectCentre = useCallback(async (centre: Centre, pinCode: string) => {
    if (!pinCode || pinCode.trim() !== centre.pin_code) {
      return { error: "Code d'accès incorrect pour ce centre." };
    }
    try { localStorage.setItem(STORAGE_CENTRE, centre.id); } catch { /* ignore */ }
    setActiveCentre(centre);
    void ensureAnimateur(centre);
    return { error: null };
  }, [ensureAnimateur]);

  const clearActiveCentre = useCallback(() => {
    try { localStorage.removeItem(STORAGE_CENTRE); } catch { /* ignore */ }
    setActiveCentre(null);
  }, []);

  const createCentre = useCallback(async (name: string, type: string, pinCode: string) => {
    try {
      const { data, error } = await supabase
        .from('centres')
        .insert({ name, type, pin_code: pinCode })
        .select('id, name, pin_code, type')
        .single();
      if (error) return { error: error.message };
      const newCentre = data as Centre;
      setCentres((prev) => [...prev, newCentre].sort((a, b) => a.name.localeCompare(b.name)));
      return { error: null, centre: newCentre };
    } catch {
      return { error: 'Impossible de créer le centre. Vérifiez votre connexion.' };
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<UserProfile, 'phone' | 'diploma' | 'emergency_contact' | 'full_name' | 'role'>>) => {
    if (!session?.user) return { error: 'Non connecté' };
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', session.user.id);
      if (error) return { error: error.message };
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      return { error: null };
    } catch {
      return { error: 'Impossible de mettre à jour le profil.' };
    }
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        centres,
        activeCentre,
        loading,
        isAuthenticated,
        signIn,
        signUp,
        signOut,
        selectCentre,
        createCentre,
        clearActiveCentre,
        refreshCentres,
        updateProfile,
        demoSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
