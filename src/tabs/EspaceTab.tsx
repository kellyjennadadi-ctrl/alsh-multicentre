import { useState } from 'react';
import {
  Sparkles,
  X,
  ChevronRight,
  BookOpen,
  CalendarDays,
  MessageSquare,
  Send,
  Flag,
  Archive,
  Copy,
  Check,
  Plus,
  MapPin,
  Clock,
  Users,
  Megaphone,
  PartyPopper,
  Music,
  Trees,
  Palette,
  TrendingUp,
  Star,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { getAvatarColor } from '@/utils/helpers';
import { animators } from '@/data/mockData';
import { useAuth } from '@/lib/auth';
import type { PedagogicalPeriod, CalendarEvent, ChatMessage, CalendarEventType } from '@/types';

type SubView = 'grid' | 'filrouge' | 'calendrier' | 'chat';

const DEFAULT_PERIODS: PedagogicalPeriod[] = [
  { id: 'p1', index: 1, name: 'Rentree - Toussaint', theme: '', objectives: '', activities: '', completed: false },
  { id: 'p2', index: 2, name: 'Toussaint - Noel', theme: '', objectives: '', activities: '', completed: false },
  { id: 'p3', index: 3, name: 'Noel - Hiver', theme: '', objectives: '', activities: '', completed: false },
  { id: 'p4', index: 4, name: 'Hiver - Printemps', theme: '', objectives: '', activities: '', completed: false },
  { id: 'p5', index: 5, name: 'Printemps - Ete', theme: '', objectives: '', activities: '', completed: false },
];

const DEMO_PERIODS: PedagogicalPeriod[] = [
  { id: 'p1', index: 1, name: 'Rentree - Toussaint', theme: 'Decouverte & Rentrer ensemble', objectives: 'Creer du lien entre enfants, poser les regles de vie collective, decouvrir l espace ALSH.', activities: 'Jeux de nom, chasse au tresor de l accueil, atelier affiche des regles.', completed: true },
  { id: 'p2', index: 2, name: 'Toussaint - Noel', theme: 'Lumiere & Fete de fin d annee', objectives: 'Travailler la motricite fine, preparer le spectacle de Noel, decouvrir les traditions.', activities: 'Lanternes automne, atelier decorations sapin, repetitions chant, spectacle.', completed: true },
  { id: 'p3', index: 3, name: 'Noel - Hiver', theme: 'Sciences & Curiosite', objectives: 'Experimenter, formuler des hypotheses, travailler en petits groupes.', activities: 'Experiences eau/glace, atelier volcan, mini-expo scientifique.', completed: false },
  { id: 'p4', index: 4, name: 'Hiver - Printemps', theme: 'Nature & Environnement', objectives: 'Sensibiliser au tri, jardinage, observation du cycle des saisons.', activities: 'Plantation, atelier recyclage, sortie parc, herbier.', completed: false },
  { id: 'p5', index: 5, name: 'Printemps - Ete', theme: 'Sport & Grands jeux', objectives: 'Valoriser l effort, cooperation, preparer la kermesse de fin d annee.', activities: 'Olympiades, relais, grand jeu de piste, kermesse.', completed: false },
];

const DEMO_PERSONAL_EVENTS: CalendarEvent[] = [
  { id: 'pe1', date: '2026-10-05', title: 'Atelier peinture (PS)', type: 'activite', time: '11:45', location: 'Salle 1', isTeam: false },
  { id: 'pe2', date: '2026-10-07', title: 'Jeu cooperatif (GS)', type: 'activite', time: '16:45', location: 'Cour', isTeam: false },
  { id: 'pe3', date: '2026-10-09', title: 'Chant & musique', type: 'activite', time: '16:45', location: 'Salle 2', isTeam: false },
];

const DEMO_TEAM_EVENTS: CalendarEvent[] = [
  { id: 'te1', date: '2026-10-10', title: 'Sortie au parc animalier', type: 'sortie', time: '09:00', location: 'Parc central', isTeam: true },
  { id: 'te2', date: '2026-10-15', title: 'Spectacle de magie', type: 'spectacle', time: '14:00', location: 'Salle des fetes', isTeam: true },
  { id: 'te3', date: '2026-10-18', title: 'Reunion d equipe mensuelle', type: 'reunion', time: '17:00', location: 'Bureau directeur', isTeam: true },
  { id: 'te4', date: '2026-10-25', title: 'Kermesse de Toussaint', type: 'kermesse', time: '15:00', location: 'Cour centrale', isTeam: true },
];

const DEMO_MESSAGES: ChatMessage[] = [
  { id: 'm1', authorId: 'a1', authorName: 'Sarah', text: 'Bonjour a tous ! Petit rappel : sortie au parc demain, prevoir vestes chaudes pour les enfants.', timestamp: '08:15', isImportant: true },
  { id: 'm2', authorId: 'a2', authorName: 'Yanes', text: 'Bien note Sarah, je gere le groupe GS demain apres-midi.', timestamp: '08:22', isImportant: false },
  { id: 'm3', authorId: 'a3', authorName: 'Karim', text: 'Manon Robert est partie avec sa nounou hier soir, pas la maman comme prevu. Transmission faite ce matin.', timestamp: '09:01', isImportant: false },
  { id: 'm4', authorId: 'a1', authorName: 'Sarah', text: 'Attention : Tom Bernard a oublie son EpiPen a la maison. Les parents le deposent a 10h. Vigilance repas midi !', timestamp: '09:30', isImportant: true },
];

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { label: string; icon: typeof MapPin; color: string; bg: string }> = {
  sortie: { label: 'Sortie', icon: Trees, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  spectacle: { label: 'Spectacle', icon: Music, color: 'text-[#2563EB]', bg: 'bg-blue-50' },
  reunion: { label: 'Reunion', icon: Users, color: 'text-[#2563EB]', bg: 'bg-blue-50' },
  kermesse: { label: 'Kermesse', icon: PartyPopper, color: 'text-amber-600', bg: 'bg-amber-50' },
  activite: { label: 'Activite', icon: Palette, color: 'text-sky-600', bg: 'bg-sky-50' },
};

export function EspaceTab() {
  const centerName = useAuth().activeCentre?.name || 'Accueil Loisirs';
  const [subView, setSubView] = useState<SubView>('grid');

  if (subView !== 'grid') {
    return <SubViewRouter subView={subView} onBack={() => setSubView('grid')} />;
  }

  const tiles = [
    { key: 'filrouge' as SubView, title: 'Fil Rouge Pedagogique', subtitle: 'Projet annuel sur 5 periodes', icon: BookOpen, color: 'bg-blue-100', iconColor: 'text-[#2563EB]' },
    { key: 'calendrier' as SubView, title: 'Double Calendrier', subtitle: 'Mes activites & evenements centre', icon: CalendarDays, color: 'bg-blue-100', iconColor: 'text-[#2563EB]' },
    { key: 'chat' as SubView, title: 'Chat Equipe', subtitle: 'Transmissions en direct', icon: MessageSquare, color: 'bg-amber-100', iconColor: 'text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={20} className="text-[#2563EB]" />
          <h1 className="text-xl font-bold text-gray-900">Espace Animateur</h1>
        </div>
        <p className="text-sm text-gray-400">Mon espace personnel &amp; transmissions d equipe</p>
      </div>

      <div className="px-5 mt-4">
        <div className="bg-gradient-to-br bg-[#2563EB] rounded-3xl p-5 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} />
            <p className="text-xs font-bold uppercase tracking-wide opacity-90">Centre actif</p>
          </div>
          <p className="text-lg font-bold">{centerName}</p>
          <p className="text-xs opacity-75 mt-1">Fil rouge, planning et transmissions - tout au meme endroit</p>
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="grid grid-cols-1 gap-3">
          {tiles.map(({ key, title, subtitle, icon: Icon, color, iconColor }) => (
            <button
              key={key}
              onClick={() => setSubView(key)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-4 active:scale-95 transition hover:shadow-md text-left"
            >
              <div className={"w-14 h-14 rounded-2xl " + color + " flex items-center justify-center flex-shrink-0"}>
                <Icon size={26} className={iconColor} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubViewRouter({ subView, onBack }: { subView: SubView; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 text-sm font-semibold mb-3"
        >
          <X size={18} />
          Retour
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {subView === 'filrouge' && 'Fil Rouge Pedagogique'}
          {subView === 'calendrier' && 'Double Calendrier'}
          {subView === 'chat' && 'Chat Equipe & Transmissions'}
        </h1>
      </div>
      {subView === 'filrouge' && <FilRougeView />}
      {subView === 'calendrier' && <CalendrierView />}
      {subView === 'chat' && <ChatView />}
    </div>
  );
}

// -- SECTION 1: FIL ROUGE PEDAGOGIQUE --
export function FilRougeView() {
  const [periods, setPeriods] = useState<PedagogicalPeriod[]>(DEMO_PERIODS);
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archived, setArchived] = useState<string[]>([]);
  const [showArchivedList, setShowArchivedList] = useState(false);

  const completedCount = periods.filter((p) => p.completed).length;
  const progress = Math.round((completedCount / periods.length) * 100);

  const editing = periods.find((p) => p.id === editingPeriod);

  const updatePeriod = (id: string, updates: Partial<PedagogicalPeriod>) => {
    setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const toggleCompleted = (id: string) => {
    setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, completed: !p.completed } : p)));
  };

  const handleArchive = () => {
    setArchived((prev) => [...prev, 'Fil Rouge ' + (new Date().getFullYear() - 1) + '-' + new Date().getFullYear()]);
    setShowArchiveModal(false);
  };

  const handleDuplicate = () => {
    setPeriods(DEFAULT_PERIODS.map((p) => ({ ...p })));
    setShowArchiveModal(false);
  };

  return (
    <div className="px-5 mt-4 space-y-4">
      {/* Progress bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#2563EB]" />
            <p className="text-sm font-bold text-gray-900">Avancement du fil rouge</p>
          </div>
          <p className="text-2xl font-bold text-[#2563EB]">{progress}%</p>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: progress + '%' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{completedCount} / {periods.length} periodes completees</p>
      </div>

      {/* Archive / Duplicate buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowArchiveModal(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-[#2563EB] text-sm font-bold rounded-2xl border border-blue-200 active:scale-95 transition"
        >
          <Archive size={16} />
          Archiver
        </button>
        <button
          onClick={() => setShowArchivedList(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-500 text-sm font-bold rounded-2xl border border-gray-100 active:scale-95 transition"
        >
          <Copy size={16} />
          Archives ({archived.length})
        </button>
      </div>

      {/* Periods */}
      <div className="space-y-3">
        {periods.map((period) => (
          <div
            key={period.id}
            className={"bg-white rounded-2xl p-4 shadow-sm border transition " + (period.completed ? 'border-emerald-200' : 'border-gray-50')}
          >
            <div className="flex items-start gap-3">
              <div className={"w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 " + (period.completed ? 'bg-emerald-500' : 'bg-blue-100')}>
                {period.completed ? (
                  <Check size={18} className="text-white" strokeWidth={3} />
                ) : (
                  <span className="text-sm font-bold text-[#2563EB]">{period.index}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">Periode {period.index}</p>
                <p className="text-sm font-bold text-gray-900">{period.name}</p>

                {period.theme ? (
                  <div className="mt-2 bg-blue-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-blue-400 uppercase">Theme</p>
                    <p className="text-sm font-bold text-blue-800">{period.theme}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 mt-1 italic">Theme non defini</p>
                )}

                {period.objectives && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Objectifs</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{period.objectives}</p>
                  </div>
                )}

                {period.activities && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Activites cles</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{period.activities}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
              <button
                onClick={() => setEditingPeriod(period.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl active:scale-95 transition"
              >
                <Plus size={14} />
                {period.theme ? 'Modifier' : 'Renseigner'}
              </button>
              <button
                onClick={() => toggleCompleted(period.id)}
                className={"flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition active:scale-95 " + (period.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400')}
              >
                <Check size={14} />
                {period.completed ? 'Terminee' : 'Marquer fini'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditingPeriod(null)}
        title={editing ? 'Periode ' + editing.index + ' - ' + editing.name : ''}
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Grand theme</label>
              <input
                value={editing.theme}
                onChange={(e) => updatePeriod(editing.id, { theme: e.target.value })}
                placeholder="Ex: Sciences & Curiosite"
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Objectifs pedagogiques</label>
              <textarea
                value={editing.objectives}
                onChange={(e) => updatePeriod(editing.id, { objectives: e.target.value })}
                placeholder="Ex: Experimenter, formuler des hypotheses..."
                rows={3}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase">Activites cles associees</label>
              <textarea
                value={editing.activities}
                onChange={(e) => updatePeriod(editing.id, { activities: e.target.value })}
                placeholder="Ex: Experiences eau/glace, atelier volcan..."
                rows={3}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none"
              />
            </div>
            <button
              onClick={() => setEditingPeriod(null)}
              className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-md shadow-blue-200"
            >
              Enregistrer
            </button>
          </div>
        )}
      </Modal>

      {/* Archive modal */}
      <Modal open={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="Archiver / Dupliquer le fil rouge">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Archive size={32} className="text-[#2563EB]" />
            </div>
            <p className="text-sm text-gray-500">
              Archivez le fil rouge actuel pour le conserver et rechargez-le l annee suivante, ou dupliquez le modele pour demarrer une nouvelle annee.
            </p>
          </div>
          <button
            onClick={handleArchive}
            className="w-full flex items-center gap-3 py-3.5 px-4 bg-blue-50 rounded-2xl border-2 border-blue-200 active:scale-95 transition"
          >
            <Archive size={20} className="text-[#2563EB]" />
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-blue-800">Archiver le fil rouge actuel</p>
              <p className="text-xs text-blue-500">Sauvegarde l annee en cours</p>
            </div>
            <ChevronRight size={18} className="text-blue-300" />
          </button>
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-3 py-3.5 px-4 bg-blue-50 rounded-2xl border-2 border-blue-200 active:scale-95 transition"
          >
            <Copy size={20} className="text-[#2563EB]" />
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-blue-800">Dupliquer le modele</p>
              <p className="text-xs text-blue-500">Repartir d un fil rouge vierge</p>
            </div>
            <ChevronRight size={18} className="text-blue-300" />
          </button>
        </div>
      </Modal>

      {/* Archived list modal */}
      <Modal open={showArchivedList} onClose={() => setShowArchivedList(false)} title="Fils rouges archives">
        <div className="space-y-3">
          {archived.length === 0 ? (
            <div className="text-center py-8">
              <Archive size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucune archive pour le moment</p>
            </div>
          ) : (
            archived.map((name, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4 bg-gray-50 rounded-2xl">
                <Archive size={18} className="text-blue-500" />
                <p className="text-sm font-bold text-gray-700 flex-1">{name}</p>
                <button className="px-3 py-1.5 bg-blue-100 text-[#2563EB] text-xs font-bold rounded-xl active:scale-95 transition">
                  Recharger
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

// -- SECTION 2: DOUBLE CALENDRIER --
export function CalendrierView() {
  const [view, setView] = useState<'perso' | 'team'>('perso');
  const [showAddModal, setShowAddModal] = useState(false);
  const [personalEvents, setPersonalEvents] = useState<CalendarEvent[]>(DEMO_PERSONAL_EVENTS);
  const [teamEvents] = useState<CalendarEvent[]>(DEMO_TEAM_EVENTS);

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<CalendarEventType>('activite');

  const events = view === 'perso' ? personalEvents : teamEvents;
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const handleAdd = () => {
    if (!newTitle || !newDate) return;
    const newEvent: CalendarEvent = {
      id: 'e' + Date.now(),
      date: newDate,
      title: newTitle,
      type: newType,
      time: newTime || '--:--',
      location: newLocation,
      isTeam: false,
    };
    setPersonalEvents([...personalEvents, newEvent]);
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewLocation('');
    setNewType('activite');
    setShowAddModal(false);
  };

  return (
    <div className="px-5 mt-4 space-y-4">
      {/* Toggle perso / team */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('perso')}
          className={"flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition " + (view === 'perso' ? 'bg-[#2563EB] text-white shadow-md shadow-blue-200' : 'bg-white text-gray-500 border border-gray-100')}
        >
          <Palette size={16} />
          Mon Planning Activites
        </button>
        <button
          onClick={() => setView('team')}
          className={"flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition " + (view === 'team' ? 'bg-[#2563EB] text-white shadow-md shadow-blue-200' : 'bg-white text-gray-500 border border-gray-100')}
        >
          <Megaphone size={16} />
          Calendrier Centre
        </button>
      </div>

      {/* Description */}
      <div className={"rounded-2xl p-3 " + (view === 'perso' ? 'bg-blue-50' : 'bg-blue-50')}>
        <p className="text-xs text-gray-600">
          {view === 'perso'
            ? 'Votre planning personnel : preparez vos creneaux, jeux et activites prevues.'
            : 'Evenements partages de l equipe : sorties, spectacles, reunions, kermesse.'}
        </p>
      </div>

      {/* Add button (perso only) */}
      {view === 'perso' && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-md shadow-blue-200"
        >
          <Plus size={20} />
          Ajouter une activite
        </button>
      )}

      {/* Events list */}
      <div className="space-y-3">
        {sortedEvents.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-50 text-center">
            <CalendarDays size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun evenement planifie</p>
          </div>
        ) : (
          sortedEvents.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.type];
            return (
              <div key={event.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <div className="flex items-start gap-3">
                  <div className={"w-12 h-12 rounded-2xl " + config.bg + " flex items-center justify-center flex-shrink-0"}>
                    <config.icon size={22} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={"px-2 py-0.5 " + config.bg + " " + config.color + " text-[10px] font-bold rounded-full"}>
                        {config.label}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(event.date)}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 mt-1">{event.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} />
                        {event.time}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={12} />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Ajouter une activite">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Titre de l activite</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Atelier peinture (PS)"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Type</label>
            <div className="flex gap-2 flex-wrap mt-2">
              {(Object.keys(EVENT_TYPE_CONFIG) as CalendarEventType[]).map((t) => {
                const cfg = EVENT_TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={"px-3 py-2 rounded-xl text-xs font-bold transition " + (newType === t ? cfg.bg + ' ' + cfg.color + ' border-2 border-current' : 'bg-gray-50 text-gray-400 border border-gray-100')}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Heure</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Lieu</label>
            <input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Ex: Salle 1, Cour..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newTitle || !newDate}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-md shadow-blue-200"
          >
            Ajouter
          </button>
        </div>
      </Modal>
    </div>
  );
}

// -- SECTION 3: CHAT EQUIPE --
function ChatView() {
  const centerName = useAuth().activeCentre?.name || 'Accueil Loisirs';
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [input, setInput] = useState('');
  const [isImportant, setIsImportant] = useState(false);

  const currentAnimator = animators[0];

  const handleSend = () => {
    if (!input.trim()) return;
    const now = new Date();
    const newMsg: ChatMessage = {
      id: 'm' + Date.now(),
      authorId: currentAnimator.id,
      authorName: currentAnimator.firstName,
      text: input.trim(),
      timestamp: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isImportant,
    };
    setMessages([...messages, newMsg]);
    setInput('');
    setIsImportant(false);
  };

  return (
    <div className="px-5 mt-4 space-y-3">
      {/* Channel header */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
          <MessageSquare size={20} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">Equipe {centerName}</p>
          <p className="text-xs text-gray-400">Canal securise - {animators.length} membres</p>
        </div>
        <div className="flex -space-x-2">
          {animators.slice(0, 4).map((a) => (
            <div
              key={a.id}
              className={"w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white " + getAvatarColor(a.firstName)}
            >
              {a.firstName[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {messages.map((msg) => {
          const isMine = msg.authorId === currentAnimator.id;
          return (
            <div
              key={msg.id}
              className={"flex gap-2.5 " + (isMine ? 'flex-row-reverse' : '')}
            >
              <div className={"w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 " + getAvatarColor(msg.authorName)}>
                {msg.authorName[0]}
              </div>
              <div className={"flex-1 min-w-0 flex flex-col " + (isMine ? 'items-end' : 'items-start')}>
                <div className={"flex items-baseline gap-2 " + (isMine ? 'flex-row-reverse' : '')}>
                  <p className="text-xs font-bold text-gray-700">{msg.authorName}</p>
                  <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                </div>
                <div
                  className={"mt-1 rounded-2xl px-4 py-2.5 max-w-[85%] " + (msg.isImportant ? 'bg-amber-50 border-2 border-amber-300' : isMine ? 'bg-[#2563EB] text-white' : 'bg-white border border-gray-100')}
                >
                  {msg.isImportant && (
                    <div className="flex items-center gap-1 mb-1">
                      <Flag size={12} className="text-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Transmission importante</span>
                    </div>
                  )}
                  <p className={"text-sm leading-relaxed " + (msg.isImportant ? 'text-amber-900' : isMine ? 'text-white' : 'text-gray-700')}>
                    {msg.text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div className="fixed bottom-20 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto px-5">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2">
            {isImportant && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 rounded-xl mb-2">
                <div className="flex items-center gap-1.5">
                  <Flag size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Transmission importante</span>
                </div>
                <button onClick={() => setIsImportant(false)} className="p-1 text-amber-500">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsImportant(!isImportant)}
                className={"p-2.5 rounded-xl transition flex-shrink-0 " + (isImportant ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-400')}
              >
                <Flag size={18} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ecrire un message a l equipe..."
                className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2.5 bg-[#2563EB] text-white rounded-xl active:scale-90 transition disabled:opacity-40 flex-shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
