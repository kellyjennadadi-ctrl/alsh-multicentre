/*
# Enable realtime on pointages and clotures

1. Changes
- Adds `pointages` and `clotures` tables to the `supabase_realtime` publication.
- This enables live presence sync: when someone points a child present/absent,
  or when a slot is clôturé, all connected devices update instantly.
2. Security
- No RLS changes. Both tables already have anon+authenticated CRUD policies.
- Realtime respects RLS: clients only receive events for rows they can SELECT.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE pointages;
ALTER PUBLICATION supabase_realtime ADD TABLE clotures;
