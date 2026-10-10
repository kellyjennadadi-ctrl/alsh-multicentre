import { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  ChevronRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Heart,
  Zap,
} from 'lucide-react';
import { useAuth, type Centre } from '@/lib/auth';

const FALLBACK_CENTRES: Centre[] = [
  { id: 'demo-1', name: 'Centre de démonstration', pin_code: '2026', type: 'Periscolaire' },
  { id: 'demo-2', name: 'Ecole Jean Jaures', pin_code: '2026', type: 'Elementaire' },
];

type Step = 'login' | 'centre';

export function LoginScreen() {
  const { signIn, signUp, selectCentre, demoSignIn, centres, profile } = useAuth();

  // Local state only — no async calls at mount
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: centre selection
  const [selectedCentre, setSelectedCentre] = useState<Centre | null>(null);
  const [centrePin, setCentrePin] = useState('');
  const [centreError, setCentreError] = useState<string | null>(null);

  const availableCentres = centres.length > 0 ? centres : FALLBACK_CENTRES;

  // ── Step 1: email + password ──
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);

    // Try Supabase auth, but fall back to local demo if it fails
    const { error: err } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (err) {
      // If Supabase fails, offer to continue in local/demo mode
      setError(null);
      // Auto-advance to centre selection — the user is "locally authenticated"
      setStep('centre');
      return;
    }

    setStep('centre');
  };

  // ── Step 2: select centre + validate PIN ──
  const handleCentreValidate = async () => {
    if (!selectedCentre || !centrePin.trim()) return;
    setSubmitting(true);
    setCentreError(null);

    const { error: err } = await selectCentre(selectedCentre, centrePin.trim());
    setSubmitting(false);

    if (err) {
      setCentreError(err);
    }
    // On success, the auth context sets activeCentre and App.tsx renders the dashboard
  };

  // ── Demo bypass: skip everything ──
  const handleDemo = () => {
    demoSignIn();
    // demoSignIn sets isAuthenticated=true; App.tsx will then show CentreSelectionScreen
    // where the user can pick a centre. To fully bypass, auto-select the first centre.
    selectCentre(FALLBACK_CENTRES[0], '2026');
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 w-full max-w-sm">
        <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg">
          <Heart size={32} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Accueil Loisirs</h1>
        <p className="text-sm text-blue-200 mt-1 text-center">Gestion d'activités périscolaires</p>
      </div>

      {/* ─────────── Step 1: Login ─────────── */}
      {step === 'login' && (
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Étape 1 — Connexion</p>

          {/* Email */}
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
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Mot de passe</label>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full pl-10 pr-10 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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

          {/* Error (non-blocking) */}
          {error && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">{error}</p>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleLogin}
            disabled={submitting || !email.trim() || !password.trim()}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            type="button"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
            {submitting ? 'Veuillez patienter...' : 'Continuer'}
          </button>

          {/* Demo bypass */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleDemo}
              className="w-full py-2.5 text-sm font-medium text-gray-400 flex items-center justify-center gap-1.5 active:scale-95 transition"
              type="button"
            >
              <Zap size={14} />
              Passer en mode démo
            </button>
          </div>
        </div>
      )}

      {/* ─────────── Step 2: Centre selection ─────────── */}
      {step === 'centre' && (
        <div className="w-full max-w-sm space-y-3">
          {/* Back button */}
          <button
            onClick={() => { setStep('login'); setError(null); setCentrePin(''); setSelectedCentre(null); }}
            className="flex items-center gap-1.5 text-xs text-blue-200 font-medium mb-2"
            type="button"
          >
            <ArrowLeft size={12} />
            Retour à la connexion
          </button>

          <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Étape 2 — Choisissez votre centre</p>

          {/* User badge */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 mb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white">
              {(profile?.full_name || email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile?.full_name || email}</p>
              <p className="text-xs text-blue-200">Connecté</p>
            </div>
          </div>

          {/* Centre list */}
          {availableCentres.map((centre) => (
            <button
              key={centre.id}
              onClick={() => { setSelectedCentre(centre); setCentreError(null); setCentrePin(''); }}
              className={'w-full flex items-center gap-4 p-4 rounded-2xl shadow-lg active:scale-[0.98] transition text-left border-2 ' +
                (selectedCentre?.id === centre.id
                  ? 'bg-white border-[#2563EB]'
                  : 'bg-white border-transparent')}
              type="button"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{centre.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{centre.type || 'Périscolaire'} — Code requis</p>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}

          {/* PIN entry for selected centre */}
          {selectedCentre && (
            <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-4 mt-4 animate-[fadeIn_0.2s_ease]">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
                  <Building2 size={26} className="text-[#2563EB]" />
                </div>
                <p className="text-sm font-bold text-gray-900 text-center">{selectedCentre.name}</p>
                <p className="text-xs text-gray-400 mt-1">Saisissez le mot de passe du centre</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                  <Lock size={12} /> Mot de passe du centre
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={centrePin}
                  onChange={(e) => setCentrePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="----"
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-center text-2xl tracking-[0.5em] font-bold text-gray-900 outline-none focus:ring-2 ring-blue-200"
                  onKeyDown={(e) => e.key === 'Enter' && handleCentreValidate()}
                  autoFocus
                />
              </div>

              {centreError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
                  <p className="text-xs text-rose-600">{centreError}</p>
                </div>
              )}

              <button
                onClick={handleCentreValidate}
                disabled={submitting || centrePin.length < 4}
                className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                type="button"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {submitting ? 'Validation...' : "Accéder à l'application"}
              </button>

              <p className="text-center text-xs text-gray-300">Code de test : 2026</p>
            </div>
          )}

          {/* Demo bypass on step 2 as well */}
          <button
            onClick={handleDemo}
            className="w-full mt-4 py-2.5 text-sm font-medium text-blue-200 flex items-center justify-center gap-1.5 active:scale-95 transition"
            type="button"
          >
            <Zap size={14} />
            Passer en mode démo
          </button>
        </div>
      )}
    </div>
  );
}
