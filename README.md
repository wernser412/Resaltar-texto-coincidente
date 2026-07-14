# Resaltar texto coincidente

**Última Actualización:** 14 de julio de 2026

Resalta automáticamente palabras o expresiones en cualquier página compatible mediante listas personalizadas, con un menú flotante moderno, selección de color e importación/exportación de configuraciones.

![GUI](GUI.png)

## 📖 Descripción

**Resaltar texto coincidente** es un UserScript para **Tampermonkey** que permite resaltar automáticamente palabras o frases dentro de las páginas web.

Cada sitio web mantiene su propia lista de palabras y su propio color de resaltado, permitiendo personalizar el contenido visualizado sin modificar la página original.

El script también incorpora herramientas para importar, exportar y administrar fácilmente todas las configuraciones desde un panel flotante moderno.

---

# 📥 Instalación

1. Instala la extensión **Tampermonkey** para tu navegador.

2. Instala el script desde GitHub:

**➡️ [Instalar Script](https://github.com/wernser412/Resaltar-texto-coincidente/raw/refs/heads/main/Resaltar%20texto%20coincidente.user.js)**

---

# ✨ Características

- ✨ Resaltado automático de palabras.
- 🌐 Configuración independiente para cada sitio web.
- 🎨 Color de resaltado personalizable.
- 🎯 Selector visual de color con colores predefinidos.
- ⚡ Procesamiento automático del contenido cargado dinámicamente.
- 🔄 Reaplicación automática del resaltado al volver a la pestaña.
- 🎨 Panel flotante moderno.
- 📝 Editor integrado para administrar palabras.
- 📏 Área de edición redimensionable.
- 💾 Guarda automáticamente la configuración por dominio.
- 📥 Importar configuraciones desde archivos JSON.
- 📤 Exportar la configuración del sitio actual.
- 📦 Exportar todas las configuraciones de todos los sitios.
- 📊 Contador de palabras configuradas.
- 🔔 Mensajes visuales para confirmar las acciones.
- ⌨️ Cierre rápido del panel con la tecla **Esc**.

---

# 📝 Lista de palabras

Cada palabra debe escribirse en una línea independiente.

Ejemplo:

```text
gato
perro
matemáticas
historia
```

El script resaltará automáticamente todas las coincidencias encontradas en la página.

---

# 🖥️ Uso

1. Abre una página compatible.
2. Pulsa el botón flotante ☰.
3. Escribe las palabras que deseas resaltar.
4. Selecciona el color de resaltado.
5. Guarda los cambios.
6. Las palabras aparecerán resaltadas automáticamente.

---

# 💾 Información almacenada

El script recuerda automáticamente:

- Lista de palabras por cada dominio.
- Color de resaltado de cada sitio.
- Altura del editor de palabras.
- Visibilidad del botón flotante.

---

# 📤 Importación y exportación

El panel permite:

- 📥 Importar configuraciones desde un archivo JSON.
- 📤 Exportar únicamente la configuración del sitio actual.
- 📦 Exportar todas las configuraciones almacenadas en un único archivo.

Esto facilita crear copias de seguridad o compartir configuraciones entre equipos.

---

# 📄 Sitios compatibles

Actualmente el script está configurado para funcionar en:

- HentaiTK
- HentaiLA

Es posible ampliar fácilmente la lista añadiendo nuevos dominios en el UserScript.

---

# 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.

Consulta el archivo **LICENSE** para más información.
