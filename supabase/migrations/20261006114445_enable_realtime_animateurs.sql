/*
# Enable realtime on animateurs table

1. Changes
- Adds the `animateurs` table to the `supabase_realtime` publication so that
  INSERT/UPDATE/DELETE events are broadcast to all subscribed clients.
- This enables live team sync: when the director adds or toggles presence on
  an animator, the adjoint's phone updates instantly without a page reload.
2. Security
- No RLS changes. The table already has anon+authenticated CRUD policies.
- Realtime respects RLS: clients only receive events for rows they can SELECT.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE animateurs;
