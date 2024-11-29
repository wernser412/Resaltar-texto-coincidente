# Resaltar Texto Coincidente

**Última Actualización:** 28 de Noviembre de 2024

![Interfaz Gráfica del Script](GUI.png)

Un script de Tampermonkey que permite resaltar palabras específicas en rojo en el sitio web [hentaitk.net](https://hentaitk.net). Los usuarios pueden gestionar las palabras a resaltar a través de un cuadro de texto interactivo, que guarda las palabras ingresadas para futuras visitas.

## Características

- Resalta palabras específicas en el contenido de la página.
- Administra las palabras a resaltar mediante un botón flotante que muestra un cuadro de texto.
- Las palabras se ingresan una por línea.
- Guarda automáticamente las palabras en `localStorage` para persistencia.
- Excluye etiquetas `<script>` y `<style>` para evitar conflictos.

## Instalación

1. Instala la extensión **[Tampermonkey](https://www.tampermonkey.net/)** en tu navegador (compatible con Chrome, Firefox, Edge, y otros).
2. Abre Tampermonkey y selecciona la opción **"Crear un nuevo script"**.
3. Copia y pega el contenido del archivo [`script.js`](https://github.com/wernser412/Resaltar-texto-coincidente/raw/refs/heads/main/Resaltar%20texto%20coincidente.user.js) en el editor de Tampermonkey.
4. Guarda el script y asegúrate de que esté habilitado.
5. Ve a [hentaitk.net](https://hentaitk.net) y haz clic en el botón "Ingresar palabras" para comenzar.

## Uso

1. **Abrir el editor de palabras**:
   - Haz clic en el botón flotante "Ingresar palabras" en la parte superior derecha de la página.
2. **Ingresar palabras**:
   - Escribe cada palabra en una línea separada dentro del cuadro de texto.
3. **Guardar cambios**:
   - Presiona el botón "Guardar" para aplicar los resaltados.
4. **Cerrar sin guardar**:
   - Usa el botón "Cerrar" para salir sin guardar los cambios.

## Ejemplo de resaltado

- Palabras ingresadas:

ejemplo

texto

resaltar

- Resultado: Todas las ocurrencias de `ejemplo`, `texto` y `resaltar` se resaltarán en rojo en la página.
