import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  School,
  User,
  Check,
  X,
  Loader2,
  Palette,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { ClassLevel } from '@/types';

interface ClassRow {
  id: string;
  centre_nom: string;
  name: string;
  code: string;
  level: string;
  teacher_name: string | null;
  color: string | null;
  sort_order: number;
}

const LEVEL_OPTIONS: { value: ClassLevel; label: string }[] = [
  { value: 'PS', label: 'Petite Section' },
  { value: 'MS', label: 'Moyenne Section' },
  { value: 'GS', label: 'Grande Section' },
  { value: 'Elementaire', label: 'Élémentaire' },
  { value: 'Double', label: 'Double niveau' },
];

const COLOR_OPTIONS = [
  { value: '#2563EB', label: 'Bleu' },
  { value: '#10B981', label: 'Vert' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Rouge' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#EC4899', label: 'Rose' },
  { value: '#14B8A6', label: 'Turquoise' },
  { value: '#6B7280', label: 'Gris' },
];

const LEVEL_COLORS: Record<string, string> = {
  PS: '#2563EB',
  MS: '#10B981',
  GS: '#F59E0B',
  Elementaire: '#8B5CF6',
  Double: '#6B7280',
};

export function ClassesManagementPage({ onBack }: { onBack: () => void }) {
  const { activeCentre } = useAuth();
  const centreNom = activeCentre?.name || '';
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editLevel, setEditLevel] = useState<ClassLevel>('PS');
  const [editTeacher, setEditTeacher] = useState('');
  const [editColor, setEditColor] = useState('#2563EB');

  // Add form state
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newLevel, setNewLevel] = useState<ClassLevel>('PS');
  const [newTeacher, setNewTeacher] = useState('');
  const [newColor, setNewColor] = useState('#2563EB');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    if (!centreNom) return;
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('centre_nom', centreNom)
      .order('sort_order', { ascending: true });
    if (data) setClasses(data as ClassRow[]);
    setLoading(false);
  }, [centreNom]);

  useEffect(() => {
    loadClasses();

    const channel = supabase
      .channel('classes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes', filter: 'centre_nom=eq.' + centreNom },
        () => { loadClasses(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadClasses, centreNom]);

  const handleAdd = async () => {
    if (!newName.trim() || !centreNom) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('classes').insert({
      centre_nom: centreNom,
      name: newName.trim(),
      code: newCode.trim() || newLevel,
      level: newLevel,
      teacher_name: newTeacher.trim() || null,
      color: newColor,
      sort_order: classes.length,
    });
    if (err) {
      setError(err.message);
    } else {
      setShowAddForm(false);
      setNewName('');
      setNewCode('');
      setNewLevel('PS');
      setNewTeacher('');
      setNewColor('#2563EB');
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('classes')
      .update({
        name: editName.trim(),
        code: editCode.trim() || editLevel,
        level: editLevel,
        teacher_name: editTeacher.trim() || null,
        color: editColor,
      })
      .eq('id', editingId);
    if (err) {
      setError(err.message);
    } else {
      setEditingId(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('classes').delete().eq('id', id);
  };

  const startEdit = (cls: ClassRow) => {
    setEditingId(cls.id);
    setEditName(cls.name);
    setEditCode(cls.code);
    setEditLevel(cls.level as ClassLevel);
    setEditTeacher(cls.teacher_name || '');
    setEditColor(cls.color || LEVEL_COLORS[cls.level] || '#2563EB');
  };

  const levelLabel = (level: string) => LEVEL_OPTIONS.find((o) => o.value === level)?.label || level;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-8">
      {/* Header */}
      <div className="bg-[#0F172A] px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/90 active:scale-95 transition">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold">Retour Direction</span>
        </button>
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <School size={22} className="text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">Classes &amp; Professeurs</h1>
            <p className="text-sm text-gray-400">Gestion des classes et enseignants référents</p>
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="px-5 mt-4">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-blue-200"
        >
          <Plus size={18} />
          Ajouter une classe
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 mt-3">
          <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
            <X size={14} />
            {error}
          </div>
        </div>
      )}

      {/* Classes list */}
      <div className="px-5 mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-200">
            <School size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucune classe enregistrée</p>
            <p className="text-xs text-gray-300 mt-1">Ajoutez votre première classe ci-dessus</p>
          </div>
        ) : (
          classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0]"
            >
              {editingId === cls.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase">Nom</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                        placeholder="Ex: Petite Section"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase">Code</label>
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                        placeholder="PS"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Niveau</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {LEVEL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setEditLevel(opt.value)}
                          className={'px-3 py-1.5 rounded-lg text-xs font-bold transition ' + (editLevel === opt.value ? 'bg-[#2563EB] text-white' : 'bg-gray-100 text-gray-500')}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Enseignant(e) référent(e)</label>
                    <input
                      value={editTeacher}
                      onChange={(e) => setEditTeacher(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                      placeholder="Ex: Mme Martin"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5"><Palette size={12} /> Couleur</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setEditColor(c.value)}
                          className={'w-8 h-8 rounded-full transition ' + (editColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : '')}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#2563EB] text-white text-sm font-bold rounded-xl active:scale-95 transition disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-500 text-sm font-bold rounded-xl active:scale-95 transition"
                    >
                      <X size={16} />
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: cls.color || LEVEL_COLORS[cls.level] || '#2563EB' }}
                  >
                    {cls.code || cls.level}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#1E293B]">{cls.name}</p>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full">
                        {levelLabel(cls.level)}
                      </span>
                    </div>
                    {cls.teacher_name ? (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <User size={11} />
                        {cls.teacher_name}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 mt-0.5 italic">Aucun enseignant assigné</p>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(cls)}
                    className="p-2 rounded-xl bg-blue-50 text-blue-500 active:scale-90 transition"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(cls.id)}
                    className="p-2 rounded-xl bg-rose-50 text-rose-500 active:scale-90 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add form modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-5" onClick={() => setShowAddForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-bold text-gray-900">Nouvelle classe</h2>
              <button onClick={() => setShowAddForm(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Nom de la classe</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                    placeholder="Ex: Petite Section"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Code court</label>
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                    placeholder="PS"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Niveau</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setNewLevel(opt.value)}
                      className={'px-3 py-2 rounded-lg text-xs font-bold transition ' + (newLevel === opt.value ? 'bg-[#2563EB] text-white' : 'bg-gray-100 text-gray-500')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Enseignant(e) référent(e)</label>
                <input
                  value={newTeacher}
                  onChange={(e) => setNewTeacher(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                  placeholder="Ex: Mme Martin"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5"><Palette size={12} /> Couleur d&apos;identification</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewColor(c.value)}
                      className={'w-9 h-9 rounded-full transition ' + (newColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : '')}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                  <X size={14} />
                  {error}
                </div>
              )}
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-lg shadow-blue-200 disabled:opacity-40"
              >
                {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Créer la classe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
