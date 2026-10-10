export type Section = 'PS' | 'MS' | 'GS';

export type TimeSlot = 'matin' | 'midi' | 'soir' | 'mercredi';

export type AgeGroup = 'petits' | 'moyens' | 'grands';

export type AppMode = 'peri' | 'extra';

export type AttendanceStatus = 'present' | 'absent';

export type ContractType = 'Permanente' | 'Vacataire' | 'Renfort';
export type AbsenceSlot = 'Midi' | 'Soir' | 'Journée';
export type ClassLevel = Section | 'Elementaire' | 'Double';

export interface SchoolClass {
  id: string;
  name: string;
  level: ClassLevel;
  code?: string;
  teacherName?: string;
  color?: string;
  sortOrder?: number;
}

export interface PAI {
  allergy: string;
  protocol: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  section: Section;
  classe: string;
  birthDate: string;
  pai: PAI | null;
  // Régime alimentaire (ex: sans porc, végétarien) — persisté dans enfants.regime_alimentaire
  regime?: string;
  // Soir & Mercredi
  departureTime?: string;
  pickupBy?: string;
  present: Record<TimeSlot, boolean>;
  // Per-slot enrollment (set via Excel import)
  inscritMidi?: boolean;
  inscritSoir?: boolean;
  inscritMercredi?: boolean;
}

export interface Animator {
  id: string;
  firstName: string;
  contract: ContractType;
  diplomas: string[];
  assignedGroup: Section;
  slots: string[];
  absences: { date: string; slot: AbsenceSlot; reason: string }[];
  presentToday: boolean;
  phone: string;
}

export type BoboType = 'Chute' | 'Égratignure' | 'Bosse' | 'Mal de ventre' | 'Plaie' | 'Morsure' | 'Autre';

export interface CareRecord {
  id: string;
  childId: string;
  childName: string;
  time: string;
  description: string;
  treatment: string;
  date: string;
  boboType: BoboType;
  animator: string;
  parentsNotified: boolean;
  attachmentUrl: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  allergens: string[];
}

export type MenuCategory = 'Entrée' | 'Plat' | 'Garniture' | 'Produit laitier' | 'Dessert';

export interface MenuDish {
  id: string;
  name: string;
  category: MenuCategory;
  allergens: string[];
}

export interface DayMenu {
  day: string;
  dishes: MenuDish[];
  documentUrl: string | null;
}

export interface WeeklyMenu {
  weekStart: string;
  days: DayMenu[];
}

export type TabKey = 'aujourdhui' | 'animation' | 'sante' | 'espacepro' | 'pointage' | 'direction' | 'compte';

export type AnimationSubTab = 'projet' | 'calendrier' | 'sorties';
export type EspaceProSubTab = 'direction' | 'outils' | 'compte';

export interface PedagogicalPeriod {
  id: string;
  index: number;
  name: string;
  theme: string;
  objectives: string;
  activities: string;
  completed: boolean;
}

export type CalendarEventType = 'sortie' | 'spectacle' | 'reunion' | 'kermesse' | 'activite';

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: CalendarEventType;
  time: string;
  location: string;
  isTeam: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
  isImportant: boolean;
}

export interface Song {
  id: string;
  title: string;
  lyrics: string;
  refrain: string;
  level: 'maternelle' | 'élémentaire';
  audioUrl: string | null;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  theme: 'calme' | 'dynamique' | 'jeux' | 'fete';
  url: string;
  color: string;
  icon: string;
}

export type GameLocation = 'all' | 'interieur' | 'exterieur';
export type GameAge = 'all' | 'PS' | 'MS' | 'GS';
export type GameDuration = 'all' | 'short' | 'medium' | 'long';

export interface Game {
  id: string;
  title: string;
  location: 'interieur' | 'exterieur';
  age: 'PS' | 'MS' | 'GS';
  duration: 'short' | 'medium' | 'long';
  players: string;
  objectives: string;
  material: string;
  rules: string[];
  variant: string;
}

export interface Tutorial {
  id: string;
  title: string;
  category: 'bricolage' | 'recyclage' | 'saisons';
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
  recommendedAge: string;
  material: string[];
  steps: string[];
  imageUrl: string | null;
  pdfUrl: string | null;
}
