# Activación segura de Supabase para MLTraining

El sitio de GitHub Pages es público, pero **solo el usuario de Supabase Auth indicado en `supabase/001_progress.sql` puede modificar el avance**. Los visitantes solo leen un resumen de niveles de competencia, horas registradas y títulos/estado/porcentaje de proyectos. Notas, respuestas de recall, energía y demás datos personales permanecen en la tabla privada.

## Pasos del propietario

1. En Supabase → **Database → Settings**, cambia la contraseña de la base de datos compartida anteriormente. No la copies a la página, a GitHub ni a ningún chat.
2. En **Authentication → Users**, confirma que el usuario con UID `18eea104-0317-4152-af5a-ce7cf047a921` es el tuyo y que su correo está confirmado. Si recibiste una invitación, acéptala desde tu correo.
3. En **Authentication → URL Configuration**, establece el Site URL como `https://jovalam-3008.github.io/mltraining/` y añade esa misma URL a Redirect URLs. Esto permite que los enlaces de acceso regresen a la página correcta.
4. En **SQL Editor → New query**, pega el contenido de [`supabase/001_progress.sql`](./supabase/001_progress.sql) y ejecuta **Run**. El script crea las tablas, el único usuario autorizado, las políticas de lectura y el guardado atómico. No requiere la contraseña de la base de datos.
5. Comprueba que el SQL Editor muestra ejecución correcta. Ejecuta después [`supabase/verify.sql`](./supabase/verify.sql): todas las filas de la columna `pass` deben indicar `true`. Antes de publicar, también comprobaremos desde el navegador que un visitante puede leer `mltraining_public` pero no `mltraining_private`.
6. Abre la versión anterior de GitHub Pages y descarga un JSON con **Exportar**. Cuando el nuevo frontend esté publicado, inicia sesión con tu usuario de Supabase Auth. Si aparece «Subir copia local», descarga primero una copia y después pulsa ese botón para migrar el avance de ese navegador.
7. Para reducir intentos de registro innecesarios, en **Authentication → Settings** puedes desactivar **Allow new users to sign up** una vez creado tu usuario. La protección real del guardado sigue estando en la base de datos y verifica el UID en cada operación.

La versión de `chatgpt.site` y la de GitHub Pages usan dominios distintos: el progreso local de una no aparece automáticamente en la otra. Si el avance está solo en `chatgpt.site`, expórtalo allí e impórtalo en GitHub Pages después de iniciar sesión.

## Respaldos y límites

La aplicación conserva copia local y marca los cambios pendientes si falla la red. La base de datos mantiene una instantánea privada diaria de la versión anterior a la primera edición del día. Descarga además un JSON al menos una vez por semana y consérvalo fuera del navegador.

En el plan gratuito Supabase puede pausar un proyecto con poca actividad y no ofrece descarga de sus backups gestionados. Una pausa no equivale a borrado, pero el JSON externo sigue siendo importante: <https://supabase.com/docs/guides/deployment/going-into-prod>.
