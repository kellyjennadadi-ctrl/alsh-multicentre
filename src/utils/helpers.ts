import type { Child, Section, TimeSlot, AgeGroup } from '@/types';

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export function getAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function getSectionLabel(section: Section): string {
  const labels: Record<Section, string> = {
    PS: 'Petite Section',
    MS: 'Moyenne section',
    GS: 'Grande section',
  };
  return labels[section];
}

export function getSectionColor(section: Section): string {
  const colors: Record<Section, string> = {
    PS: 'bg-amber-100 text-amber-700',
    MS: 'bg-sky-100 text-sky-700',
    GS: 'bg-emerald-100 text-emerald-700',
  };
  return colors[section];
}

export function getWeekDays(date: Date = new Date()): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(date.getDate() + diff);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function formatDateFR(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getPresentCountBySection(
  children: Child[],
  slot: TimeSlot
): Record<Section, number> {
  return {
    PS: children.filter((c) => c.section === 'PS' && c.present[slot]).length,
    MS: children.filter((c) => c.section === 'MS' && c.present[slot]).length,
    GS: children.filter((c) => c.section === 'GS' && c.present[slot]).length,
  };
}

export function getPresentCount(children: Child[], slot: TimeSlot): number {
  return children.filter((c) => c.present[slot]).length;
}

export function getPaiChildren(children: Child[], slot: TimeSlot): Child[] {
  return children.filter((c) => c.pai !== null && c.present[slot]);
}

export function getMinutesUntil(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-sky-100 text-sky-600',
    'bg-emerald-100 text-emerald-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
    'bg-blue-100 text-blue-600',
    'bg-teal-100 text-teal-600',
    'bg-orange-100 text-orange-600',
  ];
  const hash = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return colors[hash % colors.length];
}

export function getAgeGroup(birthDate: string): AgeGroup {
  const age = getAge(birthDate);
  if (age <= 4) return 'petits';
  if (age <= 6) return 'moyens';
  return 'grands';
}

export function getAgeGroupLabel(group: AgeGroup): string {
  const labels: Record<AgeGroup, string> = {
    petits: 'Petits (3-4 ans)',
    moyens: 'Moyens (5-6 ans)',
    grands: 'Grands (7+ ans)',
  };
  return labels[group];
}

export function getPresentCountByAgeGroup(
  children: Child[],
  slot: TimeSlot
): Record<AgeGroup, number> {
  return {
    petits: children.filter((c) => getAgeGroup(c.birthDate) === 'petits' && c.present[slot]).length,
    moyens: children.filter((c) => getAgeGroup(c.birthDate) === 'moyens' && c.present[slot]).length,
    grands: children.filter((c) => getAgeGroup(c.birthDate) === 'grands' && c.present[slot]).length,
  };
}
