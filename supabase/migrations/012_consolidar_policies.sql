-- Consolida las politicas permisivas duplicadas detectadas por el advisor de
-- rendimiento tras la 011 (multiple_permissive_policies): folders, items y
-- folder_shares tenian dos politicas separadas para la misma accion, que
-- Postgres evalua ambas por fila. Se combinan en una condicion OR dentro de
-- una sola politica por accion, sin cambiar el comportamiento.

drop policy folders_own on vigia.folders;
drop policy folders_shared_read on vigia.folders;

create policy folders_select on vigia.folders
  for select
  to authenticated
  using (
    (select auth.uid()) = fld_usr_id
    or fld_id in (select vigia.visible_folder_ids())
  );

create policy folders_insert on vigia.folders
  for insert
  to authenticated
  with check ((select auth.uid()) = fld_usr_id);

create policy folders_update on vigia.folders
  for update
  to authenticated
  using ((select auth.uid()) = fld_usr_id)
  with check ((select auth.uid()) = fld_usr_id);

create policy folders_delete on vigia.folders
  for delete
  to authenticated
  using ((select auth.uid()) = fld_usr_id);

drop policy items_own on vigia.items;
drop policy items_shared on vigia.items;

create policy items_all on vigia.items
  for all
  to authenticated
  using (
    (select auth.uid()) = itm_usr_id
    or itm_fld_id in (select vigia.visible_folder_ids())
  )
  with check (
    (select auth.uid()) = itm_usr_id
    or itm_fld_id in (select vigia.visible_folder_ids())
  );

drop policy folder_shares_owner on vigia.folder_shares;
drop policy folder_shares_invited_read on vigia.folder_shares;
drop policy folder_shares_invited_respond on vigia.folder_shares;

create policy folder_shares_select on vigia.folder_shares
  for select
  to authenticated
  using (
    (select auth.uid()) = shr_owner_usr_id
    or (select auth.uid()) = shr_invited_usr_id
  );

create policy folder_shares_insert on vigia.folder_shares
  for insert
  to authenticated
  with check ((select auth.uid()) = shr_owner_usr_id);

create policy folder_shares_update on vigia.folder_shares
  for update
  to authenticated
  using (
    (select auth.uid()) = shr_owner_usr_id
    or (select auth.uid()) = shr_invited_usr_id
  )
  with check (
    (select auth.uid()) = shr_owner_usr_id
    or (select auth.uid()) = shr_invited_usr_id
  );

create policy folder_shares_delete on vigia.folder_shares
  for delete
  to authenticated
  using ((select auth.uid()) = shr_owner_usr_id);

-- Indice que faltaba segun el advisor (unindexed_foreign_keys).
create index folder_shares_owner_idx on vigia.folder_shares (shr_owner_usr_id);
