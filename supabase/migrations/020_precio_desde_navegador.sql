-- Precios leídos desde el navegador del usuario (botón «Guardar en Vigía»,
-- backlog B21, src/lib/browserImport.js).
--
-- price_history separa lo leído ('auto') de lo tecleado ('manual') para no
-- mezclarlos (docs/TIENDAS.md). El botón no es ninguna de las dos: el precio
-- se lee de la página, pero de la que el usuario tiene abierta, no del pase
-- automático. Se le da su propio valor para que el histórico diga de dónde
-- salió cada punto.

alter table vigia.price_history
  drop constraint price_history_ph_source_check;

alter table vigia.price_history
  add constraint price_history_ph_source_check
  check (ph_source in ('auto', 'manual', 'browser'));
