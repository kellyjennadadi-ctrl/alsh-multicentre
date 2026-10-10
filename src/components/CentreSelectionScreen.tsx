import { useState } from 'react';
import { Building2, Lock, ChevronRight, Loader2, AlertCircle, ArrowLeft, Plus, X, Check, School } from 'lucide-react';
import { useAuth, type Centre } from '@/lib/auth';

const STRUCTURE_TYPES = [
  { value: 'Elementaire', label: 'Elementaire' },
  { value: 'Maternelle', label: 'Maternelle' },
  { value: 'Periscolaire', label: 'Periscolaire' },
  { value: 'ALSH', label: 'ALSH' },
];

export function CentreSelectionScreen() {
  const { centres, selectCentre, createCentre, profile, signOut, refreshCentres } = useAuth();
  const [selected, setSelected] = useState<Centre | null>(null);
  const [pinCode, setPinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create centre modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Periscolaire');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const handleValidate = async () => {
    if (!selected || !pinCode.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await selectCentre(selected, pinCode.trim());
    if (err) setError(err);
    setSubmitting(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPin.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { error: err } = await createCentre(newName.trim(), newType, newPin.trim());
    if (err) {
      setCreateError(err);
    } else {
      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreate(false);
        setNewName('');
        setNewType('Periscolaire');
        setNewPin('');
        setCreateSuccess(false);
      }, 1200);
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-[#0F172A] flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 w-full max-w-sm">
        <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg">
          <Building2 size={32} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Choisir votre centre</h1>
        <p className="text-sm text-blue-200 mt-1 text-center">
          Bonjour {profile?.full_name || 'utilisateur'}, selectionnez la structure a gerer.
        </p>
      </div>

      {/* Centre cards */}
      {!selected && (
        <div className="w-full max-w-sm space-y-3">
          {centres.length === 0 && (
            <div className="text-center py-8 text-blue-200 text-sm">
              Aucun centre disponible. Ajoutez-en un ci-dessous.
            </div>
          )}
          {centres.map((centre) => (
            <button
              key={centre.id}
              onClick={() => { setSelected(centre); setError(null); setPinCode(''); }}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-lg active:scale-[0.98] transition text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{centre.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {centre.type || 'Periscolaire'}
                  <span className="ml-1">- Code d'acces requis</span>
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}

          {/* Add centre button */}
          <button
            onClick={() => { setShowCreate(true); setCreateError(null); }}
            className="w-full flex items-center justify-center gap-2 p-4 bg-white/10 backdrop-blur-sm border-2 border-dashed border-white/30 rounded-2xl text-white font-bold text-sm active:scale-[0.98] transition"
          >
            <Plus size={18} />
            Ajouter un centre
          </button>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-3 text-blue-200 font-medium text-sm mt-4"
          >
            <ArrowLeft size={16} />
            Se deconnecter
          </button>
        </div>
      )}

      {/* PIN entry */}
      {selected && (
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">
            <button
              onClick={() => { setSelected(null); setError(null); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 font-medium"
            >
              <ArrowLeft size={14} />
              Changer de centre
            </button>

            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
                <Building2 size={26} className="text-[#2563EB]" />
              </div>
              <p className="text-sm font-bold text-gray-900 text-center">{selected.name}</p>
              <p className="text-xs text-gray-400 mt-1">Saisissez le code d'acces du centre</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                <Lock size={12} /> Code d'acces (4 a 6 chiffres)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="----"
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-center text-2xl tracking-[0.5em] font-bold text-gray-900 outline-none focus:ring-2 ring-blue-200"
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
                <p className="text-xs text-rose-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleValidate}
              disabled={submitting || pinCode.length < 4}
              className="w-full py-3.5 bg-gradient-to-r bg-[#0F172A] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {submitting ? 'Validation...' : 'Acceder au centre'}
            </button>

            <p className="text-center text-xs text-gray-300">
              Code de test : 2026
            </p>
          </div>
        </div>
      )}

      {/* Create centre modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => !creating && setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease]" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-[slideUp_0.25s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <School size={20} className="text-[#2563EB]" />
                </div>
                <p className="text-sm font-bold text-gray-900">Nouveau centre</p>
              </div>
              <button
                onClick={() => !creating && setShowCreate(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 active:scale-90 transition"
              >
                <X size={18} />
              </button>
            </div>

            {createSuccess ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <Check size={28} className="text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-gray-900">Centre cree !</p>
                <p className="text-xs text-gray-400 mt-1">Il apparait dans la liste.</p>
              </div>
            ) : (
              <>
                {/* Name */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Nom du centre</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: ALSH Robespierre"
                    className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 outline-none focus:ring-2 ring-blue-200"
                    autoFocus
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Type de structure</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {STRUCTURE_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setNewType(t.value)}
                        className={'py-2.5 rounded-xl text-xs font-bold transition ' + (newType === t.value ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-gray-50 text-gray-500 border border-gray-100')}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PIN */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                    <Lock size={12} /> Code PIN direction (4 a 6 chiffres)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="----"
                    className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-center text-xl tracking-[0.5em] font-bold text-gray-900 outline-none focus:ring-2 ring-blue-200"
                  />
                </div>

                {createError && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
                    <p className="text-xs text-rose-600">{createError}</p>
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim() || newPin.length < 4}
                  className="w-full py-3.5 bg-gradient-to-r bg-[#0F172A] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                >
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {creating ? 'Creation...' : 'Enregistrer le centre'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
