-- Denormaliza el nombre de la carpeta en folder_shares. El invitado no
-- puede leer vigia.folders para una invitacion todavia pendiente (la RLS de
-- folders_select solo da acceso via visible_folder_ids(), que exige
-- shr_status = 'accepted'), asi que sin esto no hay forma de mostrarle que
-- carpeta le estan compartiendo antes de que decida aceptar. Guardar el
-- nombre en el momento de invitar no expone nada mas del dueno.

alter table vigia.folder_shares
  add column shr_fld_name text not null default '';

comment on column vigia.folder_shares.shr_fld_name is
  'Nombre de la carpeta en el momento de invitar, copiado por la Edge '
  'Function invite-to-folder. Permite al invitado ver que se le comparte '
  'antes de aceptar, sin darle acceso de lectura a vigia.folders todavia.';

alter table vigia.folder_shares alter column shr_fld_name drop default;
