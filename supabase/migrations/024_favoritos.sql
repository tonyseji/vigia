-- Favoritos: una estrella por articulo y por persona (sesion 43).
-- Ver docs/DECISIONES.md 2026-10-16, "Favoritos: una estrella por articulo...".
--
-- Tabla propia y no una columna en items: en una carpeta compartida el
-- articulo es de una sola persona, y con una columna la estrella seria la
-- misma para todos (quitarla se la quitaria tambien al otro). Aqui cada
-- estrella es de quien la pone.

create table vigia.favorites (
  fav_usr_id uuid not null references auth.users(id) on delete cascade,
  fav_itm_id uuid not null references vigia.items(itm_id) on delete cascade,
  fav_created_at timestamptz not null default now(),
  primary key (fav_usr_id, fav_itm_id)
);

-- La clave primaria ya cubre las consultas por usuario; este indice cubre
-- el ON DELETE CASCADE al borrar un articulo.
create index favorites_itm_idx on vigia.favorites (fav_itm_id);

alter table vigia.favorites enable row level security;

-- Solo las propias. Al marcar, el articulo tiene que ser uno que ves (tuyo o
-- de una carpeta compartida contigo): la subconsulta pasa por la RLS de items.
create policy favorites_own on vigia.favorites
  for all
  to authenticated
  using ((select auth.uid()) = fav_usr_id)
  with check (
    (select auth.uid()) = fav_usr_id
    and exists (select 1 from vigia.items where itm_id = fav_itm_id)
  );

grant select, insert, update, delete on vigia.favorites to authenticated;
grant all on vigia.favorites to service_role;
