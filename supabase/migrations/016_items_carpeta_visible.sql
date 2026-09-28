-- Cierra un hueco de items_all encontrado al probar la 015 (2026-09-28).
--
-- El WITH CHECK aceptaba cualquier fila con itm_usr_id = yo, sin mirar la
-- carpeta: un usuario podia crear (o mover) un articulo suyo con
-- itm_fld_id apuntando a una carpeta AJENA no compartida, y ese articulo
-- aparecia dentro de la carpeta del otro. Hacia falta conocer el UUID de
-- la carpeta (no adivinable), pero no deberia depender de eso. Reproducido
-- en produccion con rollback: insert permitido.
--
-- Ahora la carpeta de destino tiene que ser null o una que yo pueda ver
-- (mia o compartida y aceptada). El USING no cambia: sigo pudiendo ver y
-- editar mis articulos y los de carpetas compartidas conmigo.

drop policy items_all on vigia.items;

create policy items_all on vigia.items
  for all
  to authenticated
  using (
    (select auth.uid()) = itm_usr_id
    or itm_fld_id in (select vigia.visible_folder_ids())
  )
  with check (
    (itm_fld_id is null or itm_fld_id in (select vigia.visible_folder_ids()))
    and (
      (select auth.uid()) = itm_usr_id
      or itm_fld_id in (select vigia.visible_folder_ids())
    )
  );
