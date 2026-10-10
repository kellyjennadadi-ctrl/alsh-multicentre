import { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  GraduationCap,
  Building2,
  LogOut,
  ArrowLeftRight,
  Pencil,
  Check,
  X,
  AlertCircle,
  Loader2,
  Heart,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Modal } from '@/components/Modal';

export function CompteTab() {
  const { profile, activeCentre, signOut, clearActiveCentre, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editDiploma, setEditDiploma] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [showSwitchCentre, setShowSwitchCentre] = useState(false);

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const initials = (profile?.full_name || '?')
    .split(' ')
    .map((p) => p?.[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const roleLabel = profile?.role === 'directeur' ? 'Directeur/trice' : profile?.role === 'adjoint' ? 'Adjointe pédagogique / Animatrice référente' : 'Animateur/trice';

  const startEdit = () => {
    setEditFullName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setEditDiploma(profile?.diploma || '');
    setEditEmergency(profile?.emergency_contact || '');
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await updateProfile({
      full_name: editFullName.trim() || profile.full_name,
      phone: editPhone.trim() || null,
      diploma: editDiploma.trim() || null,
      emergency_contact: editEmergency.trim() || null,
    });
    if (err) {
      setError(err);
    } else {
      setEditing(false);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-[#1E293B]">Mon compte</h1>
        <p className="text-sm text-gray-400">Vos informations personnelles</p>
      </div>

      {/* Profile card */}
      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-[#2563EB] flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-[#1E293B] truncate">{profile?.full_name || 'Utilisateur'}</p>
              <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {roleLabel}
              </span>
            </div>
            <button
              onClick={startEdit}
              className="p-2.5 rounded-xl bg-gray-100 text-gray-500 active:scale-90 transition"
              title="Modifier mes informations"
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Info list */}
      <div className="px-5 mt-4 space-y-3">
        <InfoRow icon={Mail} label="Adresse e-mail" value={profile?.email} />
        <InfoRow icon={Phone} label="Téléphone" value={profile.phone} />
        <InfoRow icon={Heart} label="Contact d'urgence" value={profile.emergency_contact} />
        <InfoRow icon={GraduationCap} label="Diplôme" value={profile.diploma} />
        <InfoRow icon={Shield} label="Rôle" value={roleLabel} />

        {/* Active centre */}
        {activeCentre && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Centre actif</p>
                <p className="text-sm font-bold text-[#1E293B] truncate">{activeCentre.name}</p>
                <p className="text-xs text-gray-400">{activeCentre.type || 'Périscolaire'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 mt-6 space-y-3">
        <button
          onClick={() => setShowSwitchCentre(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-[#2563EB] font-bold rounded-2xl active:scale-95 transition border-2 border-blue-200"
        >
          <ArrowLeftRight size={18} />
          Changer de centre
        </button>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-rose-50 text-rose-600 font-bold rounded-2xl active:scale-95 transition border-2 border-rose-200"
        >
          <LogOut size={18} />
          Se déconnecter
        </button>
      </div>

      {/* Edit modal */}
      <Modal open={editing} onClose={() => { setEditing(false); setError(null); }} title="Modifier mes informations">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Nom complet</label>
            <input
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-[#1E293B] outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Téléphone</label>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="Ex: 06 12 34 56 78"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-[#1E293B] outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Contact d'urgence</label>
            <input
              value={editEmergency}
              onChange={(e) => setEditEmergency(e.target.value)}
              placeholder="Ex: Sophie Dupont - 06 98 76 54 32"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-[#1E293B] outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Diplôme</label>
            <input
              value={editDiploma}
              onChange={(e) => setEditDiploma(e.target.value)}
              placeholder="Ex: BAFA, BPJEPS, CAP Petite Enfance..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-[#1E293B] outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
              <p className="text-xs text-rose-600">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setEditing(false); setError(null); }}
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition flex items-center justify-center gap-2"
            >
              <X size={18} />
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Switch centre confirmation */}
      <Modal open={showSwitchCentre} onClose={() => setShowSwitchCentre(false)} title="Changer de centre">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-center">
            Vous allez être redirigé vers la sélection des centres. Vous devrez saisir le code d'accès du nouveau centre.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSwitchCentre(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => { clearActiveCentre(); setShowSwitchCentre(false); }}
              className="flex-1 py-3 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition"
            >
              Changer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string | null | undefined }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold text-[#1E293B] truncate">
            {value || 'Non renseigné'}
          </p>
        </div>
      </div>
    </div>
  );
}
