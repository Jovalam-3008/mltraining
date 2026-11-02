# MLTraining

Centro de formación intensiva de José Luis Valderrama Ampuero.

Esta versión estática se publica con GitHub Pages y guarda el avance en Supabase: solo el propietario autenticado puede editar el estado completo, y los visitantes ven un resumen sin notas personales. La configuración inicial está en [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

La copia local y la exportación JSON siguen disponibles como respaldo. El avance anterior no se sube automáticamente: el propietario decide cuándo migrarlo.

## Vista local

Abre `index.html` mediante un servidor HTTP local, por ejemplo `python -m http.server 8000`, y visita `http://localhost:8000/`.

Para regenerar el cliente estático tras editar `src/`, ejecuta `npm ci`, `npm test` y `npm run build:cloud`.
