import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Users,
  Phone,
  Calendar,
  ChevronRight,
  UserPlus,
  Link as LinkIcon,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getSectionLabel } from '@/utils/helpers';
import type { Section } from '@/types';

interface AnimatorRow {
  id: string;
  centre_nom: string;
  first_name: string;
  last_name: string;
  role: string;
  section: string | null;
  phone: string | null;
  diploma: string | null;
  present_today: boolean;
  created_at: string;
}

const ROLE_OPTIONS = ['Direction', 'Adjoint', 'Permanent', 'Vacataire', 'Renfort'];
const SECTION_OPTIONS: Section[] = ['PS', 'MS', 'GS'];

function getRoleBadgeClass(role: string): string {
  if (role === 'Direction') return 'bg-[#0F172A] text-white';
  if (role === 'Adjoint') return 'bg-[#2563EB] text-white';
  if (role === 'Permanent') return 'bg-blue-100 text-blue-700';
  if (role === 'Vacataire') return 'bg-sky-100 text-sky-700';
  return 'bg-amber-100 text-amber-700';
}

interface EquipeDirectionPageProps {
  onBack: () => void;
}

export function EquipeDirectionPage({ onBack }: EquipeDirectionPageProps) {
  const { activeCentre } = useAuth();
  const centreNom = activeCentre?.name || '';
  const [animators, setAnimators] = useState<AnimatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnimatorRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Absences stored locally (keyed by animator id)
  const [absences, setAbsences] = useState<Record<string, { date: string; slot: string; reason: string }[]>>({});

  // Add form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('Permanent');
  const [section, setSection] = useState<Section>('PS');
  const [phone, setPhone] = useState('');

  // Absence form
  const [showAbsForm, setShowAbsForm] = useState(false);
  const [absDate, setAbsDate] = useState(new Date().toISOString().split('T')[0]);
  const [absSlot, setAbsSlot] = useState('Journée');
  const [absReason, setAbsReason] = useState('');

  useEffect(() => {
    if (!centreNom) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('animateurs')
        .select('id, centre_nom, first_name, last_name, role, section, phone, diploma, present_today, created_at')
        .eq('centre_nom', centreNom)
        .neq('role', 'Renfort')
        .order('created_at', { ascending: true });
      setAnimators((data as AnimatorRow[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('equipe-direction-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animateurs', filter: 'centre_nom=eq.' + centreNom },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [centreNom]);

  const fullName = (a: AnimatorRow) => a.first_name + ' ' + a.last_name;

  const handleAdd = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('animateurs').insert({
      centre_nom: centreNom,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      section,
      phone: phone.trim() || null,
      diplomas: [],
      slots: [],
      present_today: false,
    });
    if (err) setError(err.message);
    else {
      setShowAdd(false);
      setFirstName('');
      setLastName('');
      setRole('Permanent');
      setSection('PS');
      setPhone('');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('animateurs').delete().eq('id', id);
    setDeletingId(null);
    if (selected?.id === id) setSelected(null);
  };

  const addAbsence = (animatorId: string) => {
    if (!absReason.trim()) return;
    setAbsences((prev) => ({
      ...prev,
      [animatorId]: [...(prev[animatorId] || []), { date: absDate, slot: absSlot, reason: absReason.trim() }],
    }));
    setShowAbsForm(false);
    setAbsReason('');
    setAbsDate(new Date().toISOString().split('T')[0]);
    setAbsSlot('Journée');
  };

  const removeAbsence = (animatorId: string, idx: number) => {
    setAbsences((prev) => ({
      ...prev,
      [animatorId]: (prev[animatorId] || []).filter((_, i) => i !== idx),
    }));
  };

  const absenceCount = (id: string) => absences[id]?.length || 0;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-8">
      {/* Header */}
      <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">Retour Direction</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
          >
            <UserPlus size={15} />
            Inviter
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
          >
            <Plus size={15} />
            Ajouter
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="px-5 pt-4 pb-2">
        <h1 className="text-xl font-bold text-[#1E293B]">Équipe d'animation</h1>
        <p className="text-sm text-gray-400">{animators.length} membre{animators.length > 1 ? 's' : ''} · absences et statuts</p>
      </div>

      {/* List */}
      <div className="px-5 mt-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : animators.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucun animateur enregistré</p>
          </div>
        ) : (
          animators.map((animator) => {
            const absCount = absenceCount(animator.id);
            return (
              <div key={animator.id} className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center text-sm font-bold text-[#2563EB] flex-shrink-0">
                    {animator.first_name[0]}
                  </div>
                  <button onClick={() => setSelected(animator)} className="flex-1 min-w-0 text-left active:scale-[0.98] transition">
                    <p className="text-sm font-bold text-[#1E293B] truncate">{fullName(animator)}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={'px-2 py-0.5 text-[10px] font-bold rounded-full ' + getRoleBadgeClass(animator.role)}>
                        {animator.role}
                      </span>
                      {animator.section && (
                        <span className="text-[10px] text-gray-400 font-medium">{getSectionLabel(animator.section as Section)}</span>
                      )}
                      {animator.phone && (
                        <a href={'tel:' + animator.phone} className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 font-medium active:scale-95 transition">
                          <Phone size={10} />
                          {animator.phone}
                        </a>
                      )}
                    </div>
                  </button>
                  {/* Absence counter badge */}
                  <button
                    onClick={() => setSelected(animator)}
                    className={'flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition active:scale-95 ' + (absCount > 0 ? 'bg-rose-50' : 'bg-emerald-50')}
                  >
                    <span className={'text-lg font-extrabold leading-none ' + (absCount > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {absCount}
                    </span>
                    <span className={'text-[9px] font-bold uppercase mt-0.5 ' + (absCount > 0 ? 'text-rose-500' : 'text-emerald-500')}>
                      abs
                    </span>
                  </button>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => setSelected(animator)}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-500 active:scale-90 transition"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(animator.id)}
                      disabled={deletingId === animator.id}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-500 active:scale-90 transition disabled:opacity-40"
                    >
                      {deletingId === animator.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail / absence modal */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
              <div>
                <p className="text-lg font-bold text-[#1E293B]">{fullName(selected)}</p>
                <p className="text-xs text-gray-400">{selected.role} · {absenceCount(selected.id)} absence{absenceCount(selected.id) > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Add absence button */}
              <button
                onClick={() => setShowAbsForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl active:scale-95 transition border border-rose-200"
              >
                <Plus size={18} />
                Ajouter une absence
              </button>

              {/* Absence list */}
              <div className="space-y-2">
                {(absences[selected.id] || []).length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <Calendar size={24} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">Aucune absence enregistrée</p>
                  </div>
                ) : (
                  (absences[selected.id] || []).map((abs, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 px-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                        <Calendar size={14} className="text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1E293B]">{new Date(abs.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {abs.slot}</p>
                        <p className="text-[10px] text-gray-500 truncate">{abs.reason}</p>
                      </div>
                      <button
                        onClick={() => removeAbsence(selected.id, i)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-400 active:scale-90 transition flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Absence form modal */}
      {showAbsForm && selected && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-6" onClick={() => setShowAbsForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#1E293B]">Nouvelle absence</p>
              <button onClick={() => setShowAbsForm(false)} className="p-2 rounded-xl text-gray-400 active:scale-90 transition">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Date</label>
              <input type="date" value={absDate} onChange={(e) => setAbsDate(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Créneau</label>
              <div className="flex gap-2 mt-1">
                {['Midi', 'Soir', 'Journée'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setAbsSlot(s)}
                    className={'flex-1 py-2 rounded-xl text-xs font-bold transition ' + (absSlot === s ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Motif</label>
              <input value={absReason} onChange={(e) => setAbsReason(e.target.value)} placeholder="Maladie, formation..." className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" autoFocus />
            </div>
            <button
              onClick={() => addAbsence(selected.id)}
              disabled={!absReason.trim()}
              className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setShowInvite(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <UserPlus size={18} className="text-[#2563EB]" />
                </div>
                <h2 className="text-lg font-bold text-[#1E293B]">Inviter un collègue</h2>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Code du centre</p>
              <p className="text-3xl font-extrabold text-[#2563EB] tracking-wider mb-3">{activeCentre?.pin_code || '----'}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeCentre?.pin_code || '').then(() => {
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  });
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-[#2563EB] font-bold text-sm rounded-xl active:scale-95 transition border border-blue-200"
              >
                {copiedCode ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                {copiedCode ? 'Code copié !' : 'Copier le code'}
              </button>
            </div>

            <button
              onClick={() => {
                const link = window.location.origin + window.location.pathname;
                navigator.clipboard.writeText(link).then(() => {
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                });
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-blue-200"
            >
              {copiedLink ? <Check size={18} className="text-emerald-300" /> : <LinkIcon size={18} />}
              {copiedLink ? 'Lien copié !' : 'Copier le lien direct'}
            </button>

            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                Tout collègue qui entre ce code lors de sa connexion, ou qui ouvre le lien direct, est automatiquement rattaché au centre <span className="font-bold text-gray-700">{centreNom}</span> et apparaît dans la liste de l'équipe.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add animator modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-bold text-[#1E293B]">Ajouter un animateur</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Prénom</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Nom</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Statut</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {ROLE_OPTIONS.filter((r) => r !== 'Renfort').map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={'px-3 py-2 rounded-xl text-xs font-bold transition ' + (role === r ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100')}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Section</label>
                <div className="flex gap-2 mt-1">
                  {SECTION_OPTIONS.map((s) => (
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
                <label className="text-xs font-semibold text-gray-400 uppercase">Téléphone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06..." className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <X size={16} className="text-rose-500" />
                  <p className="text-xs text-rose-600">{error}</p>
                </div>
              )}
              <button
                onClick={handleAdd}
                disabled={saving || !firstName.trim() || !lastName.trim()}
                className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Ajouter l'animateur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
