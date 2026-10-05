# Migraciones

SQL versionado y numerado (`001_nombre.sql`, `002_nombre.sql`…).

**Regla:** nada se aplica en Supabase que no exista antes como archivo aquí.
Se aplican en Supabase en orden, y el número no se reutiliza aunque una
migración se quede corta: el arreglo va en la siguiente.
