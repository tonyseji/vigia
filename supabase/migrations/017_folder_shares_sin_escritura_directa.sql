-- Cierra una escalada de permisos en folder_shares (2026-09-29).
--
-- folder_shares_insert solo comprobaba shr_owner_usr_id = yo, no que la
-- carpeta fuera mia: cualquiera podia insertarse una invitacion ACEPTADA a
-- una carpeta ajena (poniendose como dueno e invitado a la vez) y pasar a
-- verla entera via visible_folder_ids(). folder_shares_update dejaba al
-- invitado cambiar shr_fld_id de su invitacion a otra carpeta. En ambos
-- casos hacia falta el UUID de la carpeta. Reproducido en produccion con
-- rollback: de 0 a 2 articulos ajenos visibles.
--
-- El frontend nunca escribe en la tabla: invitar va por la Edge Function
-- invite-to-folder (service_role) y aceptar/rechazar/revocar por RPCs
-- SECURITY DEFINER. Asi que se quitan las politicas y los grants de
-- INSERT/UPDATE para authenticated. SELECT y DELETE (del dueno) se quedan.

drop policy folder_shares_insert on vigia.folder_shares;
drop policy folder_shares_update on vigia.folder_shares;

revoke insert, update on vigia.folder_shares from authenticated;
