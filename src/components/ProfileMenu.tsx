import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, ArrowLeftRight, LogOut, Shield, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { TabKey } from '@/types';

interface ProfileMenuProps {
  onNavigateDirection?: () => void;
}

export function ProfileMenu({ onNavigateDirection }: ProfileMenuProps) {
  const { profile, activeCentre, signOut, clearActiveCentre } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!profile) return null;

  const roleLabel = profile?.role === 'directeur' ? 'Directeur/trice' : profile?.role === 'adjoint' ? 'Adjoint(e)' : 'Animateur/trice';
  const initials = (profile?.full_name || '?')
    .split(' ')
    .map((p) => p?.[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/10 transition active:scale-95"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
        <ChevronDown size={14} className={`text-white/70 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-[fadeIn_0.15s_ease]">
          {/* Profile header */}
          <div className="px-4 py-4 bg-gradient-to-br from-blue-50 to-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-sm font-bold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{profile?.full_name || 'Utilisateur'}</p>
                <p className="text-xs text-blue-500 font-medium">{roleLabel}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 truncate">{profile?.email || ''}</p>
          </div>

          {/* Active centre */}
          {activeCentre && (
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-1">Centre actif</p>
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-blue-500" />
                <p className="text-sm font-semibold text-gray-700">{activeCentre.name}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-2">
            <MenuButton
              icon={Shield}
              label="Espace Direction"
              onClick={() => { if (onNavigateDirection) onNavigateDirection(); setOpen(false); }}
            />
            <MenuButton
              icon={ArrowLeftRight}
              label="Changer de structure"
              onClick={() => { clearActiveCentre(); setOpen(false); }}
            />
            <MenuButton
              icon={LogOut}
              label="Se déconnecter"
              danger
              onClick={() => { signOut(); setOpen(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition active:scale-95 ${
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} className={danger ? 'text-rose-500' : 'text-gray-400'} />
      {label}
    </button>
  );
}

export function AppHeader({ onNavigateDirection, centreName }: { onNavigateDirection?: () => void; centreName?: string }) {
  const { activeCentre } = useAuth();
  return (
    <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2 min-w-0">
        <Building2 size={18} className="text-white/80 flex-shrink-0" />
        <p className="text-sm font-bold text-white truncate">
          {centreName || activeCentre?.name || 'Accueil Loisirs'}
        </p>
      </div>
      <ProfileMenu onNavigateDirection={onNavigateDirection} />
    </div>
  );
}
