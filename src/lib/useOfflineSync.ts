import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type ConnectionStatus = 'online' | 'offline';

interface QueuedPointage {
  id: string;
  centre_nom: string;
  enfant_nom: string;
  statut: string;
  creneau: string;
  date_pointage: string;
  queued_at: number;
}

const STORAGE_KEY = 'pending-pointages';

function loadQueue(): QueuedPointage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedPointage[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedPointage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch { /* stockage plein / indisponible */ }
}

type PointageKey = { centre_nom: string; enfant_nom: string; creneau: string; date_pointage: string };

// Une entrée de la file est identifiée par centre + enfant + créneau + date
function sameKey(a: PointageKey, b: PointageKey): boolean {
  return a.centre_nom === b.centre_nom &&
    a.enfant_nom === b.enfant_nom &&
    a.creneau === b.creneau &&
    a.date_pointage === b.date_pointage;
}

export function useOfflineSync() {
  const [status, setStatus] = useState<ConnectionStatus>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(loadQueue().length);
  }, []);

  // Listen to online/offline events
  useEffect(() => {
    const goOnline = () => setStatus('online');
    const goOffline = () => setStatus('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    refreshPendingCount();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshPendingCount]);

  // Queue a pointage when offline (or always queue + try sync)
  const queuePointage = useCallback(
    (data: { centre_nom: string; enfant_nom: string; statut: string; creneau: string; date_pointage: string }) => {
      const queue = loadQueue();
      // Remove any existing entry for the same child/slot/date (keep latest)
      const filtered = queue.filter((q) => !sameKey(q, data));
      filtered.push({
        id: 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        ...data,
        queued_at: Date.now(),
      });
      saveQueue(filtered);
      setPendingCount(filtered.length);
    },
    []
  );

  // Retire de la file une entrée devenue obsolète (le pointage vient d'être enregistré en ligne)
  const dequeuePointage = useCallback((key: PointageKey) => {
    const queue = loadQueue();
    const filtered = queue.filter((q) => !sameKey(q, key));
    if (filtered.length !== queue.length) {
      saveQueue(filtered);
      setPendingCount(filtered.length);
    }
  }, []);

  // Sync all pending pointages to Supabase
  const syncPending = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    const queue = loadQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    setSyncing(true);
    let synced = 0;
    let failed = 0;
    const remaining: QueuedPointage[] = [];

    for (const item of queue) {
      // Upsert atomique : pas de doublon même si deux appareils écrivent en même temps
      const { error } = await supabase.from('pointages').upsert(
        {
          centre_nom: item.centre_nom,
          enfant_nom: item.enfant_nom,
          statut: item.statut,
          creneau: item.creneau,
          date_pointage: item.date_pointage,
        },
        { onConflict: 'centre_nom,enfant_nom,creneau,date_pointage' }
      );

      if (error) {
        failed++;
        remaining.push(item);
      } else {
        synced++;
      }
    }

    saveQueue(remaining);
    setPendingCount(remaining.length);
    setSyncing(false);
    return { synced, failed };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (status === 'online' && pendingCount > 0 && !syncing) {
      syncPending();
    }
  }, [status, pendingCount, syncing, syncPending]);

  return {
    status,
    pendingCount,
    syncing,
    queuePointage,
    dequeuePointage,
    syncPending,
    refreshPendingCount,
  };
}
