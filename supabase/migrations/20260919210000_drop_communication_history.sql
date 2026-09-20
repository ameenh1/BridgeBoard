-- Removes the communication history feature.
--
-- BridgeBoard no longer records what someone selected. Keeping a log of a
-- disabled person's communication is not something to do by default, and
-- nothing in the product needed it: the board is for saying things now, not
-- for producing a record of them afterwards.
--
-- `cascade` also drops the RLS policies, the user/created index and the
-- grants that hung off this table. Any rows already written are removed with
-- it, which is the point.
--
-- Deliberately untouched:
--   public.profiles        caregiver settings, still used
--   public.ai_asset_cache  generated-image cache, a completely separate thing
--                          that stores artwork, never anything a person said

drop table if exists public.communication_history cascade;
