import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  X,
  Check,
  Users,
  AlertTriangle,
  Calendar,
  Clock,
  ChevronRight,
  Trash2,
  Loader2,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getPresentCount } from '@/utils/helpers';
import type { Child } from '@/types';

interface FieldTrip {
  id: string;
  centre_nom: string;
  destination: string;
  date: string;
  heure_depart: string;
  heure_retour: string;
  created_at: string;
}

interface TripChild {
  id: string;
  trip_id: string;
  child_name: string;
  group_name: string;
  depart_checked: boolean;
  retour_checked: boolean;
  has_pai: boolean;
  pai_allergy: string | null;
}

interface SortieTabProps {
  children?: Child[];
}

export function SortieTab({ children = [] }: SortieTabProps) {
  const { activeCentre } = useAuth();
  const centreNom = activeCentre?.name || '';
  const [trips, setTrips] = useState<FieldTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<FieldTrip | null>(null);
  const [tripChildren, setTripChildren] = useState<TripChild[]>([]);
  const [loadingTrip, setLoadingTrip] = useState(false);

  // Create form
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [heureDepart, setHeureDepart] = useState('09:00');
  const [heureRetour, setHeureRetour] = useState('16:00');
  const [creating, setCreating] = useState(false);

  // Group management
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    if (!centreNom) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('sorties_liste')
        .select('*')
        .eq('centre_nom', centreNom)
        .order('date', { ascending: false });
      setTrips((data as FieldTrip[]) || []);
      setLoading(false);
    };
    load();
  }, [centreNom]);

  const handleCreate = async () => {
    if (!destination.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('sorties_liste')
      .insert({
        centre_nom: centreNom,
        destination: destination.trim(),
        date,
        heure_depart: heureDepart,
        heure_retour: heureRetour,
      })
      .select('*')
      .single();

    if (error) {
      // Table might not exist yet — create with local fallback
      const localTrip: FieldTrip = {
        id: 'local-' + Date.now(),
        centre_nom: centreNom,
        destination: destination.trim(),
        date,
        heure_depart: heureDepart,
        heure_retour: heureRetour,
        created_at: new Date().toISOString(),
      };
      setTrips((prev) => [localTrip, ...prev]);
    } else if (data) {
      const newTrip = data as FieldTrip;
      setTrips((prev) => [newTrip, ...prev]);

      // Pre-fill with present children (matin)
      const presentChildren = children.filter((c) => c.present.matin);
      if (presentChildren.length > 0) {
        const rows = presentChildren.map((c) => ({
          trip_id: newTrip.id,
          child_name: c.firstName + ' ' + c.lastName,
          group_name: 'Groupe 1',
          depart_checked: false,
          retour_checked: false,
          has_pai: !!c.pai,
          pai_allergy: c.pai?.allergy || null,
        }));
        await supabase.from('sorties_enfants').insert(rows);
      }
    }

    setShowCreate(false);
    setDestination('');
    setCreating(false);
  };

  const openTrip = async (trip: FieldTrip) => {
    setSelectedTrip(trip);
    setLoadingTrip(true);
    const { data } = await supabase
      .from('sorties_enfants')
      .select('*')
      .eq('trip_id', trip.id);
    setTripChildren((data as TripChild[]) || []);
    setLoadingTrip(false);
  };

  const toggleCheck = useCallback(async (id: string, field: 'depart_checked' | 'retour_checked') => {
    setTripChildren((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: !tc[field] } : tc))
    );
    const current = tripChildren.find((tc) => tc.id === id);
    if (current) {
      await supabase
        .from('sorties_enfants')
        .update({ [field]: !current[field] })
        .eq('id', id);
    }
  }, [tripChildren]);

  const changeGroup = useCallback(async (id: string, groupName: string) => {
    setTripChildren((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, group_name: groupName } : tc))
    );
    await supabase.from('sorties_enfants').update({ group_name: groupName }).eq('id', id);
  }, []);

  const deleteTrip = async (tripId: string) => {
    await supabase.from('sorties_enfants').delete().eq('trip_id', tripId);
    await supabase.from('sorties_liste').delete().eq('id', tripId);
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    if (selectedTrip?.id === tripId) setSelectedTrip(null);
  };

  // Detail view
  if (selectedTrip) {
    const groups = [...new Set(tripChildren.map((tc) => tc.group_name))].sort();
    const paiChildren = tripChildren.filter((tc) => tc.has_pai);
    const allDepart = tripChildren.length > 0 && tripChildren.every((tc) => tc.depart_checked);
    const allRetour = tripChildren.length > 0 && tripChildren.every((tc) => tc.retour_checked);

    return (
      <div className="min-h-screen bg-[#F1F5F9] pb-24">
        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-gray-100">
          <button
            onClick={() => setSelectedTrip(null)}
            className="flex items-center gap-1.5 text-gray-500 text-sm font-semibold mb-3"
          >
            <ArrowLeft size={18} />
            Retour aux sorties
          </button>
          <h1 className="text-xl font-bold text-[#1E293B]">{selectedTrip.destination}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(selectedTrip.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {selectedTrip.heure_depart} - {selectedTrip.heure_retour}
            </span>
          </div>
        </div>

        {/* PAI Alert banner */}
        {paiChildren.length > 0 && (
          <div className="px-5 mt-4">
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-600" />
                <p className="text-sm font-bold text-red-800">
                  {paiChildren.length} enfant{paiChildren.length > 1 ? 's' : ''} PAI en sortie
                </p>
              </div>
              <div className="space-y-1.5">
                {paiChildren.map((tc) => (
                  <div key={tc.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                    <FileText size={14} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-red-900 truncate">{tc.child_name}</p>
                      <p className="text-[10px] text-red-600">Allergie: {tc.pai_allergy}</p>
                    </div>
                    <button className="px-2.5 py-1.5 bg-red-500 text-white text-[10px] font-bold rounded-lg active:scale-95 transition">
                      Protocole
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary counters */}
        <div className="px-5 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-50 text-center">
              <p className="text-2xl font-bold text-[#2563EB]">{tripChildren.length}</p>
              <p className="text-[10px] text-gray-400 font-semibold">Enfants</p>
            </div>
            <div className={'rounded-2xl p-3.5 shadow-sm border text-center ' + (allDepart ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-50')}>
              <p className={'text-2xl font-bold ' + (allDepart ? 'text-emerald-600' : 'text-gray-400')}>
                {tripChildren.filter((tc) => tc.depart_checked).length}
              </p>
              <p className="text-[10px] text-gray-400 font-semibold">Depart</p>
            </div>
            <div className={'rounded-2xl p-3.5 shadow-sm border text-center ' + (allRetour ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-50')}>
              <p className={'text-2xl font-bold ' + (allRetour ? 'text-emerald-600' : 'text-gray-400')}>
                {tripChildren.filter((tc) => tc.retour_checked).length}
              </p>
              <p className="text-[10px] text-gray-400 font-semibold">Retour</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loadingTrip && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        )}

        {/* Groups with children */}
        {!loadingTrip && groups.map((group) => {
          const groupChildren = tripChildren.filter((tc) => tc.group_name === group);
          const groupDepart = groupChildren.filter((tc) => tc.depart_checked).length;
          const groupRetour = groupChildren.filter((tc) => tc.retour_checked).length;
          return (
            <div key={group} className="px-5 mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#2563EB]" />
                  <p className="text-sm font-bold text-[#1E293B]">{group}</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className={'px-2 py-0.5 rounded-full ' + (groupDepart === groupChildren.length ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                    {groupDepart} / {groupChildren.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {groupChildren.map((tc) => (
                  <div
                    key={tc.id}
                    className={'bg-white rounded-2xl p-3 shadow-sm border flex items-center gap-3 ' + (tc.has_pai ? 'border-red-200' : 'border-gray-50')}
                  >
                    {/* Depart checkbox */}
                    <button
                      onClick={() => toggleCheck(tc.id, 'depart_checked')}
                      className={'w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-90 ' + (tc.depart_checked ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-300')}
                    >
                      {tc.depart_checked && <Check size={18} />}
                    </button>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1E293B] truncate flex items-center gap-1.5">
                        {tc.child_name}
                        {tc.has_pai && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full">PAI</span>
                        )}
                      </p>
                      <select
                        value={tc.group_name}
                        onChange={(e) => changeGroup(tc.id, e.target.value)}
                        className="text-[10px] text-gray-400 bg-transparent outline-none mt-0.5"
                      >
                        {groups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                        <option value={newGroupName || 'Nouveau groupe'}>{newGroupName || '+ Nouveau groupe'}</option>
                      </select>
                    </div>

                    {/* Retour checkbox */}
                    <button
                      onClick={() => toggleCheck(tc.id, 'retour_checked')}
                      className={'w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-90 ' + (tc.retour_checked ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-300')}
                    >
                      {tc.retour_checked && <Check size={18} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* New group input */}
        <div className="px-5 mt-4">
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nom du nouveau groupe..."
              className="flex-1 px-4 py-2.5 bg-white rounded-xl text-sm outline-none focus:ring-2 ring-blue-200 border border-gray-100"
            />
            <button
              onClick={() => {
                if (newGroupName.trim()) {
                  setTripChildren((prev) => prev.map((tc) => tc.group_name === newGroupName ? tc : tc));
                  setNewGroupName('');
                }
              }}
              className="px-4 py-2.5 bg-[#2563EB] text-white text-sm font-bold rounded-xl active:scale-95 transition"
            >
              OK
            </button>
          </div>
        </div>

        {/* Delete trip */}
        <div className="px-5 mt-6">
          <button
            onClick={() => deleteTrip(selectedTrip.id)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 font-bold rounded-2xl active:scale-95 transition border border-rose-200"
          >
            <Trash2 size={18} />
            Supprimer cette sortie
          </button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Listes de sorties</h1>
            <p className="text-sm text-gray-400">Sorties terrain et appel</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-xl active:scale-95 transition shadow-lg shadow-blue-200"
          >
            <Plus size={16} />
            Créer
          </button>
        </div>

        {/* Quick stat */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users size={20} className="text-[#2563EB]" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Enfants présents ce matin</p>
              <p className="text-lg font-bold text-gray-900">
                {getPresentCount(children, 'matin')} <span className="text-xs text-gray-400 font-normal">/ {children.length}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trip list */}
      <div className="px-5 mt-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <MapPin size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">Aucune sortie planifiée</p>
            <p className="text-xs text-gray-300 mt-1">Touchez "Créer" pour en ajouter une</p>
          </div>
        ) : (
          trips.map((trip) => (
            <button
              key={trip.id}
              onClick={() => openTrip(trip)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3 active:scale-95 transition hover:shadow-md text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                <MapPin size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{trip.destination}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-0.5">
                    <Calendar size={11} />
                    {new Date(trip.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock size={11} />
                    {trip.heure_depart}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-bold text-[#1E293B]">Nouvelle sortie</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Destination</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex: Médiathèque, Parc des Lions..."
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Heure départ</label>
                  <input
                    type="time"
                    value={heureDepart}
                    onChange={(e) => setHeureDepart(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Heure retour</label>
                  <input
                    type="time"
                    value={heureRetour}
                    onChange={(e) => setHeureRetour(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 ring-blue-200"
                  />
                </div>
              </div>
              <div className="bg-blue-50 rounded-2xl p-3">
                <p className="text-xs text-blue-700">
                  Les enfants pointés "présents" ce matin seront automatiquement ajoutés à la liste de la sortie.
                </p>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !destination.trim()}
                className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Créer la sortie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
