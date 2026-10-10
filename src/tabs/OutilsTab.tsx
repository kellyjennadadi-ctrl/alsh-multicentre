import { useState, useEffect, useCallback } from 'react';
import {
  Music,
  ListMusic,
  Gamepad2,
  Scissors,
  Play,
  Pause,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Moon,
  Wind,
  PartyPopper,
  CloudRain,
  Sun,
  Clock,
  Users,
  MapPin,
  User,
  Check,
  Sparkles,
  Link2,
  Loader2,
  AlertCircle,
  FileText,
  Upload,
  ImagePlus,
  X,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { songs as seedSongs, playlists as seedPlaylists, games as seedGames, tutorials as seedTutorials } from '@/data/outilsData';
import type { Song, Playlist, Game, Tutorial, GameLocation, GameAge, GameDuration } from '@/types';

type SubSection = 'chansons' | 'playlists' | 'jeux' | 'tutos';

const subSections: { key: SubSection; label: string; icon: typeof Music }[] = [
  { key: 'chansons', label: 'Chansons', icon: Music },
  { key: 'playlists', label: 'Playlists', icon: ListMusic },
  { key: 'jeux', label: 'Jeux', icon: Gamepad2 },
  { key: 'tutos', label: 'Tutos', icon: Scissors },
];

const playlistIcons: Record<string, typeof Moon> = {
  moon: Moon,
  wind: Wind,
  music: Music,
  party: PartyPopper,
};

const durationLabels: Record<Game['duration'], string> = {
  short: '< 15 min',
  medium: '15-30 min',
  long: '> 30 min',
};

const difficultyColors: Record<Tutorial['difficulty'], string> = {
  Facile: 'bg-emerald-100 text-emerald-700',
  Moyen: 'bg-amber-100 text-amber-700',
  Difficile: 'bg-rose-100 text-rose-700',
};

const categoryLabels: Record<Tutorial['category'], string> = {
  bricolage: 'Bricolage',
  recyclage: 'Zéro déchet',
  saisons: 'Saisons',
};

// ── DB row → domain type mappers ──

function mapSongRow(row: Record<string, unknown>): Song {
  return {
    id: row.id as string,
    title: row.title as string,
    lyrics: row.lyrics as string,
    refrain: row.refrain as string,
    level: row.level as Song['level'],
    audioUrl: (row.audio_url as string | null) ?? null,
  };
}

function mapPlaylistRow(row: Record<string, unknown>): Playlist {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    theme: row.theme as Playlist['theme'],
    url: row.url as string,
    color: row.color as string,
    icon: row.icon as string,
  };
}

function mapGameRow(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    title: row.title as string,
    location: row.location as Game['location'],
    age: row.age as Game['age'],
    duration: row.duration as Game['duration'],
    players: row.players as string,
    objectives: row.objectives as string,
    material: row.material as string,
    rules: row.rules as string[],
    variant: row.variant as string,
  };
}

function mapTutoRow(row: Record<string, unknown>): Tutorial {
  return {
    id: row.id as string,
    title: row.title as string,
    category: row.category as Tutorial['category'],
    difficulty: row.difficulty as Tutorial['difficulty'],
    recommendedAge: row.recommended_age as string,
    material: row.material as string[],
    steps: row.steps as string[],
    imageUrl: (row.image_url as string | null) ?? null,
    pdfUrl: (row.pdf_url as string | null) ?? null,
  };
}

export function OutilsTab() {
  const [activeSub, setActiveSub] = useState<SubSection>('chansons');

  // Data + loading state
  const [songs, setSongs] = useState<Song[]>(seedSongs);
  const [playlists, setPlaylists] = useState<Playlist[]>(seedPlaylists);
  const [games, setGames] = useState<Game[]>(seedGames);
  const [tutorials, setTutorials] = useState<Tutorial[]>(seedTutorials);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Song UI state
  const [playingSong, setPlayingSong] = useState<string | null>(null);
  const [showAddSong, setShowAddSong] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongLyrics, setNewSongLyrics] = useState('');
  const [newSongRefrain, setNewSongRefrain] = useState('');
  const [newSongLevel, setNewSongLevel] = useState<'maternelle' | 'élémentaire'>('maternelle');
  const [newSongAudio, setNewSongAudio] = useState('');
  const [submittingSong, setSubmittingSong] = useState(false);

  // Playlist UI state
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [submittingPlaylist, setSubmittingPlaylist] = useState(false);

  // Game filter + add state
  const [locFilter, setLocFilter] = useState<GameLocation>('all');
  const [ageFilter, setAgeFilter] = useState<GameAge>('all');
  const [durFilter, setDurFilter] = useState<GameDuration>('all');
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [showAddGame, setShowAddGame] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGamePlayers, setNewGamePlayers] = useState('');
  const [newGameObjectives, setNewGameObjectives] = useState('');
  const [newGameMaterial, setNewGameMaterial] = useState('');
  const [newGameRules, setNewGameRules] = useState('');
  const [newGameVariant, setNewGameVariant] = useState('');
  const [newGameLocation, setNewGameLocation] = useState<'interieur' | 'exterieur'>('exterieur');
  const [newGameAge, setNewGameAge] = useState<'PS' | 'MS' | 'GS'>('PS');
  const [newGameDuration, setNewGameDuration] = useState<'short' | 'medium' | 'long'>('short');
  const [submittingGame, setSubmittingGame] = useState(false);

  // Tutorial add state
  const [showAddTuto, setShowAddTuto] = useState(false);
  const [newTutoTitle, setNewTutoTitle] = useState('');
  const [newTutoCategory, setNewTutoCategory] = useState<Tutorial['category']>('bricolage');
  const [newTutoDifficulty, setNewTutoDifficulty] = useState<Tutorial['difficulty']>('Facile');
  const [newTutoAge, setNewTutoAge] = useState('');
  const [newTutoMaterial, setNewTutoMaterial] = useState('');
  const [newTutoSteps, setNewTutoSteps] = useState('');
  const [newTutoImageFile, setNewTutoImageFile] = useState<File | null>(null);
  const [newTutoImageUrl, setNewTutoImageUrl] = useState('');
  const [newTutoPdfFile, setNewTutoPdfFile] = useState<File | null>(null);
  const [newTutoPdfUrl, setNewTutoPdfUrl] = useState('');
  const [submittingTuto, setSubmittingTuto] = useState(false);

  // ── Fetch all data on mount ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [songsRes, plRes, gamesRes, tutoRes] = await Promise.all([
        supabase.from('outils_songs').select('*').order('created_at', { ascending: false }),
        supabase.from('outils_playlists').select('*').order('created_at', { ascending: false }),
        supabase.from('outils_games').select('*').order('created_at', { ascending: false }),
        supabase.from('outils_tutorials').select('*').order('created_at', { ascending: false }),
      ]);

      if (songsRes.error) throw songsRes.error;
      if (plRes.error) throw plRes.error;
      if (gamesRes.error) throw gamesRes.error;
      if (tutoRes.error) throw tutoRes.error;

      if (songsRes.data && songsRes.data.length > 0) setSongs(songsRes.data.map(mapSongRow));
      if (plRes.data && plRes.data.length > 0) setPlaylists(plRes.data.map(mapPlaylistRow));
      if (gamesRes.data && gamesRes.data.length > 0) setGames(gamesRes.data.map(mapGameRow));
      if (tutoRes.data && tutoRes.data.length > 0) setTutorials(tutoRes.data.map(mapTutoRow));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Add handlers ──

  const handleAddSong = async () => {
    if (!newSongTitle.trim() || !newSongLyrics.trim()) return;
    setSubmittingSong(true);
    try {
      const { data, error } = await supabase
        .from('outils_songs')
        .insert({
          title: newSongTitle.trim(),
          lyrics: newSongLyrics.trim(),
          refrain: newSongRefrain.trim() || 'Refrain à compléter',
          level: newSongLevel,
          audio_url: newSongAudio.trim() || null,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) setSongs([mapSongRow(data), ...songs]);
      setNewSongTitle('');
      setNewSongLyrics('');
      setNewSongRefrain('');
      setNewSongAudio('');
      setShowAddSong(false);
    } catch {
      // keep local-only on failure
      setSongs([
        {
          id: `local-${Date.now()}`,
          title: newSongTitle.trim(),
          lyrics: newSongLyrics.trim(),
          refrain: newSongRefrain.trim() || 'Refrain à compléter',
          level: newSongLevel,
          audioUrl: newSongAudio.trim() || null,
        },
        ...songs,
      ]);
      setNewSongTitle('');
      setNewSongLyrics('');
      setNewSongRefrain('');
      setNewSongAudio('');
      setShowAddSong(false);
    } finally {
      setSubmittingSong(false);
    }
  };

  const handleAddPlaylist = async () => {
    if (!newPlaylistTitle.trim() || !newPlaylistUrl.trim()) return;
    setSubmittingPlaylist(true);
    try {
      const { data, error } = await supabase
        .from('outils_playlists')
        .insert({
          title: newPlaylistTitle.trim(),
          description: 'Playlist personnalisée',
          theme: 'calme',
          url: newPlaylistUrl.trim(),
          color: 'from-blue-400 to-blue-500',
          icon: 'music',
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) setPlaylists([mapPlaylistRow(data), ...playlists]);
      setNewPlaylistTitle('');
      setNewPlaylistUrl('');
      setShowAddPlaylist(false);
    } catch {
      setPlaylists([
        {
          id: `local-${Date.now()}`,
          title: newPlaylistTitle.trim(),
          description: 'Playlist personnalisée',
          theme: 'calme',
          url: newPlaylistUrl.trim(),
          color: 'from-blue-400 to-blue-500',
          icon: 'music',
        },
        ...playlists,
      ]);
      setNewPlaylistTitle('');
      setNewPlaylistUrl('');
      setShowAddPlaylist(false);
    } finally {
      setSubmittingPlaylist(false);
    }
  };

  const handleAddGame = async () => {
    if (!newGameTitle.trim() || !newGameRules.trim()) return;
    setSubmittingGame(true);
    try {
      const { data, error } = await supabase
        .from('outils_games')
        .insert({
          title: newGameTitle.trim(),
          location: newGameLocation,
          age: newGameAge,
          duration: newGameDuration,
          players: newGamePlayers.trim() || 'Non précisé',
          objectives: newGameObjectives.trim() || 'Non précisé',
          material: newGameMaterial.trim() || 'Aucun',
          rules: newGameRules.split('\n').filter((r) => r.trim()),
          variant: newGameVariant.trim() || 'Aucune variante',
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) setGames([mapGameRow(data), ...games]);
      resetGameForm();
      setShowAddGame(false);
    } catch {
      setGames([
        {
          id: `local-${Date.now()}`,
          title: newGameTitle.trim(),
          location: newGameLocation,
          age: newGameAge,
          duration: newGameDuration,
          players: newGamePlayers.trim() || 'Non précisé',
          objectives: newGameObjectives.trim() || 'Non précisé',
          material: newGameMaterial.trim() || 'Aucun',
          rules: newGameRules.split('\n').filter((r) => r.trim()),
          variant: newGameVariant.trim() || 'Aucune variante',
        },
        ...games,
      ]);
      resetGameForm();
      setShowAddGame(false);
    } finally {
      setSubmittingGame(false);
    }
  };

  const resetGameForm = () => {
    setNewGameTitle('');
    setNewGamePlayers('');
    setNewGameObjectives('');
    setNewGameMaterial('');
    setNewGameRules('');
    setNewGameVariant('');
  };

  const handleAddTuto = async () => {
    if (!newTutoTitle.trim() || !newTutoSteps.trim()) return;
    setSubmittingTuto(true);
    let imageUrl: string | null = newTutoImageUrl.trim() || null;
    let pdfUrl: string | null = newTutoPdfUrl.trim() || null;
    try {
      // Upload image file if provided
      if (newTutoImageFile) {
        const ext = newTutoImageFile.name.split('.').pop() || 'webp';
        const imgPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: imgErr } = await supabase.storage
          .from('tutorials-images')
          .upload(imgPath, newTutoImageFile);
        if (imgErr) throw imgErr;
        const { data: pubData } = supabase.storage
          .from('tutorials-images')
          .getPublicUrl(imgPath);
        imageUrl = pubData.publicUrl;
      }
      // Upload PDF file if provided
      if (newTutoPdfFile) {
        const pdfPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
        const { error: pdfErr } = await supabase.storage
          .from('tutorials-pdfs')
          .upload(pdfPath, newTutoPdfFile);
        if (pdfErr) throw pdfErr;
        const { data: pubData } = supabase.storage
          .from('tutorials-pdfs')
          .getPublicUrl(pdfPath);
        pdfUrl = pubData.publicUrl;
      }
      const { data, error } = await supabase
        .from('outils_tutorials')
        .insert({
          title: newTutoTitle.trim(),
          category: newTutoCategory,
          difficulty: newTutoDifficulty,
          recommended_age: newTutoAge.trim() || 'Non précisé',
          material: newTutoMaterial.split('\n').filter((m) => m.trim()),
          steps: newTutoSteps.split('\n').filter((s) => s.trim()),
          image_url: imageUrl,
          pdf_url: pdfUrl,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) setTutorials([mapTutoRow(data), ...tutorials]);
      resetTutoForm();
      setShowAddTuto(false);
    } catch {
      setTutorials([
        {
          id: `local-${Date.now()}`,
          title: newTutoTitle.trim(),
          category: newTutoCategory,
          difficulty: newTutoDifficulty,
          recommendedAge: newTutoAge.trim() || 'Non précisé',
          material: newTutoMaterial.split('\n').filter((m) => m.trim()),
          steps: newTutoSteps.split('\n').filter((s) => s.trim()),
          imageUrl,
          pdfUrl,
        },
        ...tutorials,
      ]);
      resetTutoForm();
      setShowAddTuto(false);
    } finally {
      setSubmittingTuto(false);
    }
  };

  const resetTutoForm = () => {
    setNewTutoTitle('');
    setNewTutoAge('');
    setNewTutoMaterial('');
    setNewTutoSteps('');
    setNewTutoImageFile(null);
    setNewTutoImageUrl('');
    setNewTutoPdfFile(null);
    setNewTutoPdfUrl('');
  };

  const filteredGames = games.filter((g) => {
    if (locFilter !== 'all' && g.location !== locFilter) return false;
    if (ageFilter !== 'all' && g.age !== ageFilter) return false;
    if (durFilter !== 'all' && g.duration !== durFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Boîte à Outils</h1>
        <p className="text-sm text-gray-400">Ressources &amp; animation</p>
      </div>

      {/* Sub-section tabs */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-4 gap-2">
          {subSections.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSub(key)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all ${
                activeSub === key
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-200'
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-blue-500">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-medium">Chargement des ressources...</span>
        </div>
      )}

      {/* Error banner */}
      {loadError && !loading && (
        <div className="mx-5 mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">Affichage des données de démonstration (connexion indisponible).</p>
        </div>
      )}

      {/* CHANSONS */}
      {activeSub === 'chansons' && !loading && (
        <div className="px-5 mt-4 space-y-3">
          <button
            onClick={() => setShowAddSong(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl border-2 border-dashed border-blue-200 text-[#2563EB] font-bold text-sm active:scale-[0.98] transition"
          >
            <Plus size={18} />
            Ajouter un chant
          </button>

          {songs.map((song) => (
            <div key={song.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Music size={18} className="text-[#2563EB]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{song.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      song.level === 'maternelle' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {song.level === 'maternelle' ? 'Maternelle' : 'Élémentaire'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPlayingSong(playingSong === song.id ? null : song.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                    playingSong === song.id ? 'bg-[#2563EB] text-white' : 'bg-blue-50 text-[#2563EB]'
                  }`}
                >
                  {playingSong === song.id ? <Pause size={14} /> : <Play size={14} />}
                  {playingSong === song.id ? 'Pause' : 'Écouter'}
                </button>
              </div>

              {/* Refrain highlight */}
              <div className="bg-blue-50 rounded-xl p-3 mb-2">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Refrain</p>
                <p className="text-sm font-semibold text-blue-800 italic">{song.refrain}</p>
              </div>

              {/* Full lyrics */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Paroles</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{song.lyrics}</p>
              </div>

              {/* Audio player */}
              {playingSong === song.id && (
                <div className="mt-3 flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-1 bg-blue-400 rounded-full animate-pulse"
                        style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#2563EB] rounded-full w-1/3 transition-all" />
                  </div>
                  <span className="text-xs text-blue-400 font-medium">0:42</span>
                </div>
              )}

              {/* Audio link if available */}
              {song.audioUrl && (
                <a
                  href={song.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1.5 text-xs text-blue-500 font-medium"
                >
                  <Link2 size={12} />
                  Lien audio externe
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PLAYLISTS */}
      {activeSub === 'playlists' && !loading && (
        <div className="px-5 mt-4 space-y-3">
          {playlists.map((pl) => {
            const Icon = playlistIcons[pl.icon] || Music;
            return (
              <a
                key={pl.id}
                href={pl.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block bg-gradient-to-br ${pl.color} rounded-2xl p-5 shadow-sm active:scale-[0.98] transition relative overflow-hidden`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full -ml-4 -mb-4" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Icon size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{pl.title}</p>
                      <p className="text-xs text-white/80">{pl.description}</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-white/70" />
                </div>
              </a>
            );
          })}

          <button
            onClick={() => setShowAddPlaylist(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl border-2 border-dashed border-blue-200 text-[#2563EB] font-bold text-sm active:scale-[0.98] transition"
          >
            <Plus size={18} />
            Ajouter ma playlist
          </button>
        </div>
      )}

      {/* JEUX */}
      {activeSub === 'jeux' && !loading && (
        <div className="px-5 mt-4 space-y-4">
          {/* Filters */}
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <MapPin size={11} /> Météo / Espace
              </p>
              <div className="flex gap-2">
                {([
                  { key: 'all' as GameLocation, label: 'Tous', icon: null },
                  { key: 'interieur' as GameLocation, label: 'Intérieur / Pluie', icon: CloudRain },
                  { key: 'exterieur' as GameLocation, label: 'Extérieur / Cour', icon: Sun },
                ]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setLocFilter(key)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      locFilter === key ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-500 border border-gray-100'
                    }`}
                  >
                    {Icon && <Icon size={13} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Users size={11} /> Âge
              </p>
              <div className="flex gap-2">
                {([
                  { key: 'all' as GameAge, label: 'Tous' },
                  { key: 'PS' as GameAge, label: 'Petits (PS)' },
                  { key: 'MS' as GameAge, label: 'Moyens (MS)' },
                  { key: 'GS' as GameAge, label: 'Grands (GS)' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setAgeFilter(key)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      ageFilter === key ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-500 border border-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Clock size={11} /> Durée
              </p>
              <div className="flex gap-2">
                {([
                  { key: 'all' as GameDuration, label: 'Toutes' },
                  { key: 'short' as GameDuration, label: '< 15 min' },
                  { key: 'medium' as GameDuration, label: '15-30 min' },
                  { key: 'long' as GameDuration, label: '> 30 min' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setDurFilter(key)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      durFilter === key ? 'bg-[#2563EB] text-white' : 'bg-white text-gray-500 border border-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Game cards */}
          <div className="space-y-3">
            {filteredGames.map((game) => {
              const expanded = expandedGame === game.id;
              return (
                <div key={game.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                  <button
                    onClick={() => setExpandedGame(expanded ? null : game.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Gamepad2 size={18} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{game.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            {game.location === 'interieur' ? <CloudRain size={10} /> : <Sun size={10} />}
                            {game.location === 'interieur' ? 'Intérieur' : 'Extérieur'}
                          </span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{game.age}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{durationLabels[game.duration]}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <User size={9} />
                            {game.players}
                          </span>
                        </div>
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </button>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-gray-50 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Objectif pédagogique</p>
                        <p className="text-sm text-gray-700">{game.objectives}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Matériel requis</p>
                        <p className="text-sm text-gray-700">{game.material}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Règles étape par étape</p>
                        <div className="space-y-1.5">
                          {game.rules.map((rule, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] text-[10px] font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <p className="text-sm text-gray-700">{rule}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mb-1">Variante</p>
                        <p className="text-sm text-amber-800">{game.variant}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredGames.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">Aucun jeu ne correspond à ces filtres</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAddGame(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl border-2 border-dashed border-blue-200 text-[#2563EB] font-bold text-sm active:scale-[0.98] transition"
          >
            <Plus size={18} />
            Créer un jeu
          </button>
        </div>
      )}

      {/* TUTOS */}
      {activeSub === 'tutos' && !loading && (
        <div className="px-5 mt-4 space-y-3">
          <button
            onClick={() => setShowAddTuto(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-2xl border-2 border-dashed border-blue-200 text-[#2563EB] font-bold text-sm active:scale-[0.98] transition"
          >
            <Plus size={18} />
            Ajouter un tutoriel
          </button>

          {tutorials.map((tuto) => (
            <div key={tuto.id} className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
              {/* Illustration banner */}
              {tuto.imageUrl ? (
                <div className="relative h-40 overflow-hidden">
                  <img src={tuto.imageUrl} alt={tuto.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-sm font-bold text-white drop-shadow-lg">{tuto.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-white/90">{categoryLabels[tuto.category]}</span>
                      <span className="text-[10px] text-white/60">·</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${difficultyColors[tuto.difficulty]}`}>
                        {tuto.difficulty}
                      </span>
                      <span className="text-[10px] text-white/60">·</span>
                      <span className="text-[10px] text-white/90 flex items-center gap-0.5">
                        <User size={9} />
                        {tuto.recommendedAge}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <Scissors size={18} className="text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{tuto.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">{categoryLabels[tuto.category]}</span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${difficultyColors[tuto.difficulty]}`}>
                          {tuto.difficulty}
                        </span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <User size={9} />
                          {tuto.recommendedAge}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Material */}
              <div className="p-4">
              <div className="bg-gray-50 rounded-xl p-3 mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Sparkles size={11} /> Matériel nécessaire
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tuto.material.map((m, i) => (
                    <span key={i} className="px-2 py-1 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-100">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1.5">Pas-à-pas</p>
                <div className="space-y-1.5">
                  {tuto.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* PDF button */}
              {tuto.pdfUrl && (
                <a
                  href={tuto.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 font-bold text-sm rounded-xl border border-rose-200 active:scale-95 transition"
                >
                  <FileText size={18} />
                  Télécharger / Voir la fiche PDF
                </a>
              )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Song Modal */}
      <Modal open={showAddSong} onClose={() => setShowAddSong(false)} title="Ajouter un chant">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Titre</label>
            <input value={newSongTitle} onChange={(e) => setNewSongTitle(e.target.value)} placeholder="Ex: Alouette"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div className="flex gap-2">
            {(['maternelle', 'élémentaire'] as const).map((lvl) => (
              <button key={lvl} onClick={() => setNewSongLevel(lvl)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${newSongLevel === lvl ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                {lvl === 'maternelle' ? 'Maternelle' : 'Élémentaire'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Refrain</label>
            <input value={newSongRefrain} onChange={(e) => setNewSongRefrain(e.target.value)} placeholder="Le refrain mis en valeur"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Paroles complètes</label>
            <textarea value={newSongLyrics} onChange={(e) => setNewSongLyrics(e.target.value)} placeholder="Collez les paroles ici..." rows={5}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
              <Link2 size={12} /> Lien audio (optionnel)
            </label>
            <input value={newSongAudio} onChange={(e) => setNewSongAudio(e.target.value)} placeholder="https://... (MP3, YouTube, etc.)"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <button onClick={handleAddSong} disabled={!newSongTitle.trim() || !newSongLyrics.trim() || submittingSong}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2">
            {submittingSong ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {submittingSong ? 'Enregistrement...' : 'Enregistrer le chant'}
          </button>
        </div>
      </Modal>

      {/* Add Playlist Modal */}
      <Modal open={showAddPlaylist} onClose={() => setShowAddPlaylist(false)} title="Ajouter ma playlist">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Titre de la playlist</label>
            <input value={newPlaylistTitle} onChange={(e) => setNewPlaylistTitle(e.target.value)} placeholder="Ex: Ma playlist détente"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
              <Link2 size={12} /> Lien (Spotify, Deezer, YouTube...)
            </label>
            <input value={newPlaylistUrl} onChange={(e) => setNewPlaylistUrl(e.target.value)} placeholder="https://..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <button onClick={handleAddPlaylist} disabled={!newPlaylistTitle.trim() || !newPlaylistUrl.trim() || submittingPlaylist}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2">
            {submittingPlaylist ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {submittingPlaylist ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </Modal>

      {/* Add Game Modal */}
      <Modal open={showAddGame} onClose={() => setShowAddGame(false)} title="Créer un jeu">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Titre du jeu</label>
            <input value={newGameTitle} onChange={(e) => setNewGameTitle(e.target.value)} placeholder="Ex: Le loup-garou"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Nombre de joueurs</label>
            <input value={newGamePlayers} onChange={(e) => setNewGamePlayers(e.target.value)} placeholder="Ex: 5 à 15"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase">Lieu</label>
              <div className="flex flex-col gap-1 mt-1">
                {(['interieur', 'exterieur'] as const).map((loc) => (
                  <button key={loc} onClick={() => setNewGameLocation(loc)}
                    className={`py-2 rounded-lg text-xs font-bold transition ${newGameLocation === loc ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                    {loc === 'interieur' ? 'Intérieur' : 'Extérieur'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase">Âge</label>
              <div className="flex flex-col gap-1 mt-1">
                {(['PS', 'MS', 'GS'] as const).map((a) => (
                  <button key={a} onClick={() => setNewGameAge(a)}
                    className={`py-2 rounded-lg text-xs font-bold transition ${newGameAge === a ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase">Durée</label>
              <div className="flex flex-col gap-1 mt-1">
                {([
                  { key: 'short' as const, label: '< 15 min' },
                  { key: 'medium' as const, label: '15-30 min' },
                  { key: 'long' as const, label: '> 30 min' },
                ]).map(({ key, label }) => (
                  <button key={key} onClick={() => setNewGameDuration(key)}
                    className={`py-2 rounded-lg text-xs font-bold transition ${newGameDuration === key ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Objectif pédagogique</label>
            <input value={newGameObjectives} onChange={(e) => setNewGameObjectives(e.target.value)} placeholder="Ex: Coopération, écoute..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Matériel requis</label>
            <input value={newGameMaterial} onChange={(e) => setNewGameMaterial(e.target.value)} placeholder="Ex: Aucun, un ballon..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Règles (une étape par ligne)</label>
            <textarea value={newGameRules} onChange={(e) => setNewGameRules(e.target.value)} placeholder={"Étape 1: ...\nÉtape 2: ..."} rows={4}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Variante (optionnel)</label>
            <input value={newGameVariant} onChange={(e) => setNewGameVariant(e.target.value)} placeholder="Ex: Jouer en silence..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <button onClick={handleAddGame} disabled={!newGameTitle.trim() || !newGameRules.trim() || submittingGame}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2">
            {submittingGame ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {submittingGame ? 'Création...' : 'Créer le jeu'}
          </button>
        </div>
      </Modal>

      {/* Add Tutorial Modal */}
      <Modal open={showAddTuto} onClose={() => setShowAddTuto(false)} title="Ajouter un tutoriel">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Titre</label>
            <input value={newTutoTitle} onChange={(e) => setNewTutoTitle(e.target.value)} placeholder="Ex: Couronne de fleurs séchées"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div className="flex gap-2">
            {(['bricolage', 'recyclage', 'saisons'] as Tutorial['category'][]).map((cat) => (
              <button key={cat} onClick={() => setNewTutoCategory(cat)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${newTutoCategory === cat ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['Facile', 'Moyen', 'Difficile'] as Tutorial['difficulty'][]).map((diff) => (
              <button key={diff} onClick={() => setNewTutoDifficulty(diff)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${newTutoDifficulty === diff ? 'bg-[#2563EB] text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                {diff}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Âge conseillé</label>
            <input value={newTutoAge} onChange={(e) => setNewTutoAge(e.target.value)} placeholder="Ex: 3-6 ans"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Matériel (un par ligne)</label>
            <textarea value={newTutoMaterial} onChange={(e) => setNewTutoMaterial(e.target.value)} placeholder={"Pinceaux\nPeinture\nFeuilles"} rows={3}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase">Étapes (une par ligne)</label>
            <textarea value={newTutoSteps} onChange={(e) => setNewTutoSteps(e.target.value)} placeholder={"Étape 1: ...\nÉtape 2: ..."} rows={4}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none" />
          </div>

          {/* Image upload */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
              <ImagePlus size={12} /> Photo du rendu final (optionnel)
            </label>
            {newTutoImageFile ? (
              <div className="mt-1 relative rounded-xl overflow-hidden h-32">
                <img src={URL.createObjectURL(newTutoImageFile)} alt="Aperçu" className="w-full h-full object-cover" />
                <button onClick={() => setNewTutoImageFile(null)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl text-sm text-gray-500 border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                  <Upload size={16} />
                  Importer une photo
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setNewTutoImageFile(f); }} />
                </label>
              </div>
            )}
            <input value={newTutoImageUrl} onChange={(e) => setNewTutoImageUrl(e.target.value)} placeholder="... ou collez l'URL d'une image"
              className="w-full mt-2 px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>

          {/* PDF upload */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
              <FileText size={12} /> Document PDF (gabarits, fiche technique)
            </label>
            {newTutoPdfFile ? (
              <div className="mt-1 flex items-center justify-between gap-2 py-3 px-4 bg-rose-50 rounded-xl border border-rose-200">
                <div className="flex items-center gap-2 text-sm text-rose-700 font-medium">
                  <FileText size={16} />
                  {newTutoPdfFile.name}
                </div>
                <button onClick={() => setNewTutoPdfFile(null)}
                  className="w-7 h-7 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl text-sm text-gray-500 border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                <Upload size={16} />
                Joindre un document PDF
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setNewTutoPdfFile(f); }} />
              </label>
            )}
            <input value={newTutoPdfUrl} onChange={(e) => setNewTutoPdfUrl(e.target.value)} placeholder="... ou collez l'URL d'un PDF"
              className="w-full mt-2 px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200" />
          </div>

          <button onClick={handleAddTuto} disabled={!newTutoTitle.trim() || !newTutoSteps.trim() || submittingTuto}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2">
            {submittingTuto ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {submittingTuto ? 'Création...' : 'Créer la fiche'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
