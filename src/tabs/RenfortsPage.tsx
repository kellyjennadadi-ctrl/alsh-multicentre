import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Phone,
  GraduationCap,
  Star,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  CircleDot,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface RenfortRow {
  id: string;
  centre_nom: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  diploma: string | null;
  evaluation: string | null;
  note_interne: string | null;
}

type EvalStatus = 'recommande' | 'non_recommande' | 'a_tester';

const EVAL_CONFIG: Record<EvalStatus, { label: string; bg: string; text: string; dot: string; icon: typeof Star }> = {
  recommande: { label: 'Recommandé', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
  non_recommande: { label: 'Non recommandé', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', icon: XCircle },
  a_tester: { label: 'À tester', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', icon: CircleDot },
};

interface RenfortsPageProps {
  onBack: () => void;
}

export function RenfortsPage({ onBack }: RenfortsPageProps) {
  const { activeCentre } = useAuth();
  const centreNom = activeCentre?.name || '';
  const [renforts, setRenforts] = useState<RenfortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<RenfortRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add/edit form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [diploma, setDiploma] = useState('');
  const [evaluation, setEvaluation] = useState<EvalStatus>('a_tester');
  const [noteInterne, setNoteInterne] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centreNom) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('animateurs')
        .select('id, centre_nom, first_name, last_name, role, phone, diploma, evaluation, note_interne')
        .eq('centre_nom', centreNom)
        .eq('role', 'Renfort')
        .order('created_at', { ascending: true });
      setRenforts((data as RenfortRow[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('renforts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animateurs', filter: 'centre_nom=eq.' + centreNom },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [centreNom]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setDiploma('');
    setEvaluation('a_tester');
    setNoteInterne('');
    setError(null);
    setEditTarget(null);
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (row: RenfortRow) => {
    setEditTarget(row);
    setFirstName(row.first_name);
    setLastName(row.last_name);
    setPhone(row.phone || '');
    setDiploma(row.diploma || '');
    setEvaluation((row.evaluation as EvalStatus) || 'a_tester');
    setNoteInterne(row.note_interne || '');
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      centre_nom: centreNom,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: 'Renfort',
      phone: phone.trim() || null,
      diploma: diploma.trim() || null,
      evaluation,
      note_interne: noteInterne.trim() || null,
    };

    if (editTarget) {
      const { error: err } = await supabase.from('animateurs').update(payload).eq('id', editTarget.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.from('animateurs').insert({ ...payload, present_today: false });
      if (err) setError(err.message);
    }

    if (!error) {
      setShowAdd(false);
      resetForm();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('animateurs').delete().eq('id', id);
    setDeletingId(null);
  };

  const cycleEvaluation = async (row: RenfortRow) => {
    const current = (row.evaluation as EvalStatus) || 'a_tester';
    const next: EvalStatus = current === 'a_tester' ? 'recommande' : current === 'recommande' ? 'non_recommande' : 'a_tester';
    await supabase.from('animateurs').update({ evaluation: next }).eq('id', row.id);
  };

  const fullName = (r: RenfortRow) => r.first_name + ' ' + r.last_name;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-8">
      {/* Header */}
      <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">Retour Direction</span>
        </button>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl text-white text-xs font-bold active:scale-95 transition"
        >
          <Plus size={15} />
          Ajouter
        </button>
      </div>

      {/* Title */}
      <div className="px-5 pt-4 pb-2">
        <h1 className="text-xl font-bold text-[#1E293B]">Liste Renforts</h1>
        <p className="text-sm text-gray-400">Animateurs remplaçants et évaluation</p>
      </div>

      {/* List */}
      <div className="px-5 mt-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : renforts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <GraduationCap size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucun renfort enregistré</p>
            <p className="text-xs text-gray-300 mt-1">Touchez « Ajouter » pour créer une fiche</p>
          </div>
        ) : (
          renforts.map((renfort) => {
            const evalStatus = (renfort.evaluation as EvalStatus) || 'a_tester';
            const ec = EVAL_CONFIG[evalStatus];
            const EvalIcon = ec.icon;
            return (
              <div key={renfort.id} className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                {/* Card header */}
                <div className="p-4 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center text-sm font-bold text-[#2563EB] flex-shrink-0">
                    {renfort.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1E293B] truncate">{fullName(renfort)}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {renfort.diploma && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">
                          <GraduationCap size={10} />
                          {renfort.diploma}
                        </span>
                      )}
                      {renfort.phone && (
                        <a
                          href={'tel:' + renfort.phone}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-full active:scale-95 transition"
                        >
                          <Phone size={10} />
                          {renfort.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(renfort)}
                      className="p-2 rounded-xl bg-blue-50 text-blue-500 active:scale-90 transition"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(renfort.id)}
                      disabled={deletingId === renfort.id}
                      className="p-2 rounded-xl bg-rose-50 text-rose-500 active:scale-90 transition disabled:opacity-40"
                    >
                      {deletingId === renfort.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                {/* Evaluation pill (tap to cycle) */}
                <button
                  onClick={() => cycleEvaluation(renfort)}
                  className={'w-full flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] active:scale-[0.98] transition ' + ec.bg}
                >
                  <div className="flex items-center gap-2">
                    <span className={'w-2.5 h-2.5 rounded-full ' + ec.dot} />
                    <span className={'text-xs font-bold ' + ec.text}>{ec.label}</span>
                    <EvalIcon size={14} className={ec.text} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Toucher pour changer</span>
                </button>

                {/* Internal note */}
                {renfort.note_interne && (
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-[#E2E8F0]">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Note interne</p>
                    <p className="text-xs text-gray-600">{renfort.note_interne}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => { setShowAdd(false); resetForm(); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-bold text-[#1E293B]">{editTarget ? 'Modifier' : 'Ajouter'} un renfort</h2>
              <button onClick={() => { setShowAdd(false); resetForm(); }} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
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
                <label className="text-xs font-semibold text-gray-400 uppercase">Téléphone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06..." className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Diplôme</label>
                <input value={diploma} onChange={(e) => setDiploma(e.target.value)} placeholder="BAFA, stagiaire, BPJEPS..." className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Évaluation</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(EVAL_CONFIG) as EvalStatus[]).map((status) => {
                    const ec = EVAL_CONFIG[status];
                    const EvalIcon = ec.icon;
                    return (
                      <button
                        key={status}
                        onClick={() => setEvaluation(status)}
                        className={'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition ' + (evaluation === status ? ec.bg + ' ' + ec.text + ' border-current' : 'bg-gray-50 text-gray-400 border-gray-100')}
                      >
                        <EvalIcon size={18} />
                        <span className="text-[10px] font-bold">{ec.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Note interne</label>
                <textarea
                  value={noteInterne}
                  onChange={(e) => setNoteInterne(e.target.value)}
                  placeholder="Commentaire sur la prestation..."
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200 resize-none"
                  rows={3}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <XCircle size={16} className="text-rose-500" />
                  <p className="text-xs text-rose-600">{error}</p>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !firstName.trim() || !lastName.trim()}
                className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {editTarget ? 'Enregistrer' : 'Ajouter le renfort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
