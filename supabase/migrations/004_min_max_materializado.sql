-- Fase 5: minimo y maximo historico materializados en items (cierra backlog B3).
-- Decision 2026-09-06 en docs/DECISIONES.md: se materializa en vez de calcular
-- en consulta, porque el pase de refresco necesita el minimo antes de escribir
-- el precio nuevo para decidir si avisa (backlog B4).

alter table vigia.items
  add column itm_min_price numeric,
  add column itm_max_price numeric;

comment on column vigia.items.itm_min_price is
  'Minimo historico de ph_price para este articulo. Lo mantiene el trigger '
  'trg_price_history_min_max; no escribir a mano.';
comment on column vigia.items.itm_max_price is
  'Maximo historico de ph_price para este articulo. Lo mantiene el trigger '
  'trg_price_history_min_max; no escribir a mano.';

-- ============================================================
-- Trigger: mantiene itm_min_price / itm_max_price al insertar en price_history
-- ============================================================

create or replace function vigia.sync_item_min_max()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ph_price is null then
    return null;
  end if;

  update vigia.items
  set itm_min_price = least(coalesce(itm_min_price, new.ph_price), new.ph_price),
      itm_max_price = greatest(coalesce(itm_max_price, new.ph_price), new.ph_price)
  where itm_id = new.ph_itm_id;

  return null;
exception
  when others then
    return null;
end;
$$;

revoke execute on function vigia.sync_item_min_max() from anon, public;

-- AFTER INSERT: el trigger nunca puede impedir que se guarde el historico,
-- que es el dato que de verdad importa. Se dispara igual si el precio entra
-- por el pase automatico, por el boton manual o por una edicion a mano.
create trigger trg_price_history_min_max
  after insert on vigia.price_history
  for each row
  execute function vigia.sync_item_min_max();

-- ============================================================
-- Backfill de las filas existentes
-- ============================================================

update vigia.items i
set itm_min_price = agg.min_p,
    itm_max_price = agg.max_p
from (
  select ph_itm_id, min(ph_price) as min_p, max(ph_price) as max_p
  from vigia.price_history
  where ph_price is not null
  group by ph_itm_id
) agg
where i.itm_id = agg.ph_itm_id;

-- Verificacion (ejecutar a mano tras aplicar):
--   select itm_id, itm_min_price, itm_max_price from vigia.items;
--   select ph_itm_id, min(ph_price), max(ph_price) from vigia.price_history
--     where ph_price is not null group by ph_itm_id;
--   -- ambas consultas deben coincidir por articulo.
