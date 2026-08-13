// ==UserScript==
// @name         Resaltar texto coincidente
// @namespace    http://tampermonkey.net/
// @version      2026.08.12
// @description  Resalta palabras con menú flotante moderno
// @author       wernser412
// @icon         https://raw.githubusercontent.com/wernser412/Resaltar-texto-coincidente/refs/heads/main/ICONO.png
// @downloadURL  https://github.com/wernser412/Resaltar-texto-coincidente/raw/refs/heads/main/Resaltar%20texto%20coincidente.user.js
// @match        *://hentaitk.net/*
// @match        *://hentaila.com/*
// @match        *://*.hentaila.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';

    /* ============================ CONFIG ============================ */

    const dominio = location.hostname;
    const MENU_VISIBLE_KEY = 'rh_menu_visible';
    const STORAGE_KEY = 'resaltarPorSitio';
    const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

    function normalizarConfig(obj) {
        const palabras = Array.isArray(obj?.palabras)
            ? [...new Set(obj.palabras.map(String).map(p => p.trim()).filter(Boolean))]
            : [];

        const color = (typeof obj?.color === 'string' && /^#[0-9a-f]{6}$/i.test(obj.color))
            ? obj.color
            : '#ff3366';

        return { palabras, color };
    }

    async function obtenerBase() {
        try {
            const data = JSON.parse(await GM_getValue(STORAGE_KEY, '{}'));
            return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
        } catch {
            return {};
        }
    }

    async function guardarBase(base) {
        await GM_setValue(STORAGE_KEY, JSON.stringify(base));
    }

    const TEXTAREA_HEIGHT_KEY = 'rh_textarea_height';

    let base = await obtenerBase();
    let config = normalizarConfig(base[dominio]);
    let alturaGuardada = await GM_getValue(TEXTAREA_HEIGHT_KEY, null);

    let regexActual = null;

    /* ============================ UTILS ============================ */

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // NUEVO: convierte una palabra/frase en un fragmento de patrón donde
    // cualquier espacio (o secuencia de espacios/tabs/saltos de línea) se
    // trata como "uno o más espacios en blanco" en vez de un espacio literal.
    // Esto es necesario porque muchos sitios insertan espacios dobles,
    // saltos de línea o indentación entre palabras que en pantalla se ven
    // pegadas con un solo espacio (p. ej. "Tsuma  Tsuma" con doble espacio).
    function palabraAFragmentoPatron(palabra) {
        return escapeRegExp(palabra).replace(/\s+/g, '\\s+');
    }

    function construirRegex() {
        if (!config.palabras.length) return null;

        const patron = config.palabras
            .slice()
            .sort((a, b) => b.length - a.length)
            .map(palabraAFragmentoPatron)
            .join('|');

        return new RegExp(`(?<![\\p{L}\\p{N}])(${patron})(?![\\p{L}\\p{N}])`, 'giu');
    }

    function perteneceAlPanel(node) {
        return !!node.parentNode?.closest?.('.rh-ui');
    }

    /* ============================ RESALTAR (cross-node) ============================ */

    // A diferencia de la versión anterior (que solo buscaba coincidencias
    // dentro de un mismo nodo de texto), esta versión junta todo el texto
    // "visible" de un contenedor en una sola cadena, busca ahí las
    // coincidencias, y luego envuelve el resultado usando splitText/Range
    // aunque la coincidencia esté repartida entre varios nodos de texto
    // (p. ej. cuando el sitio mete un <span>, un <br> o comentarios HTML
    // entre dos palabras que en pantalla se ven pegadas). Esto es lo que
    // fallaba en hentaila.com con frases de varias palabras.

    function nodoElegible(node) {
        const p = node.parentNode;
        if (!p) return false;
        if (EXCLUDED_TAGS.has(p.nodeName)) return false;
        if (p.closest('span[data-resaltado]')) return false;
        if (p.isContentEditable) return false;
        if (perteneceAlPanel(node)) return false;
        if (p.closest?.('.rh-ui')) return false;
        return true;
    }

    function resaltarEnContenedor(root) {
        if (!regexActual) return;
        if (root.nodeType === 3) root = root.parentNode; // por si nos pasan un nodo de texto
        if (!root || root.nodeType !== 1) return;
        if (EXCLUDED_TAGS.has(root.nodeName)) return;
        if (root.classList?.contains('rh-ui')) return;
        if (root.closest?.('.rh-ui')) return;

        const nodos = [];
        let texto = '';

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!nodoElegible(node)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        // Si el propio root es un nodo de texto elegible (el TreeWalker no lo
        // incluye a menos que se lo pasemos como raíz de un fragmento), lo
        // agregamos manualmente cuando corresponda.
        let n;
        while ((n = walker.nextNode())) {
            if (!n.nodeValue) continue;
            nodos.push({ node: n, start: texto.length, end: texto.length + n.nodeValue.length });
            texto += n.nodeValue;
        }

        if (!texto.trim()) return;

        regexActual.lastIndex = 0;
        const matches = [];
        let m;
        while ((m = regexActual.exec(texto))) {
            matches.push({ start: m.index, end: m.index + m[0].length });
            if (m[0].length === 0) regexActual.lastIndex++; // seguridad anti bucle infinito
        }
        if (!matches.length) return;

        // Se procesa en orden inverso (de la última coincidencia a la
        // primera, y dentro de cada una de los nodos afectados al revés)
        // para que los splitText no invaliden los índices ya calculados.
        for (let i = matches.length - 1; i >= 0; i--) {
            const { start, end } = matches[i];

            for (let j = nodos.length - 1; j >= 0; j--) {
                const entry = nodos[j];
                const segStart = Math.max(start, entry.start);
                const segEnd = Math.min(end, entry.end);
                if (segStart >= segEnd) continue;
                if (!entry.node.parentNode) continue; // ya no está en el DOM

                const localStart = segStart - entry.start;
                const localEnd = segEnd - entry.start;

                let nodoAResaltar = entry.node;
                if (localEnd < nodoAResaltar.nodeValue.length) {
                    nodoAResaltar.splitText(localEnd);
                }
                if (localStart > 0) {
                    nodoAResaltar = nodoAResaltar.splitText(localStart);
                }

                if (!nodoAResaltar.parentNode) continue;
                const span = document.createElement('span');
                span.className = 'rh-highlight';
                span.dataset.resaltado = 'true';
                nodoAResaltar.parentNode.insertBefore(span, nodoAResaltar);
                span.appendChild(nodoAResaltar);
            }
        }
    }

    function limpiarResaltados() {
        document.querySelectorAll('span[data-resaltado]').forEach(span => {
            span.replaceWith(document.createTextNode(span.textContent));
            // normaliza para que los textos vecinos se fusionen en un solo
            // nodo y no queden fragmentados de resaltados anteriores.
        });
        document.body.normalize();
    }

    function refresh() {
        regexActual = construirRegex();
        limpiarResaltados();
        if (regexActual) resaltarEnContenedor(document.body);
    }

    /* ============================ OBSERVER (con debounce) ============================ */

    let pendingNodes = [];
    let debounceTimer = null;

    function procesarPendientes() {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        const nodes = pendingNodes;
        pendingNodes = [];
        nodes.forEach(n => resaltarEnContenedor(n.nodeType === 3 ? n.parentNode : n));
    }

    const observer = new MutationObserver(muts => {
        if (!regexActual) return;
        for (const m of muts) m.addedNodes.forEach(n => pendingNodes.push(n));

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(procesarPendientes, 120);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Red de seguridad: si vuelves de una pestaña en segundo plano, procesa lo
    // pendiente y reescanea (es barato, los nodos ya resaltados se descartan al instante).
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || !regexActual) return;
        if (debounceTimer) procesarPendientes();
        resaltarEnContenedor(document.body);
    });

    /* ============================ OVERLAY ============================ */

    let overlay;

    function showOverlay(text) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'rh-ui';
            overlay.style.cssText = `
                position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
                z-index:999999; pointer-events:none;
            `;
            const box = document.createElement('div');
            box.style.cssText = `
                width:min(440px, 82vw);
                background:rgba(15,23,42,.92);
                backdrop-filter:blur(10px);
                color:#fff;
                border:1px solid rgba(255,255,255,.12);
                border-radius:16px;
                padding:18px 22px;
                font:600 17px/1.35 system-ui, -apple-system, sans-serif;
                text-align:center;
                box-shadow:0 16px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03) inset;
            `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        }

        overlay.firstChild.textContent = text;
        overlay.style.display = 'block';
        overlay.style.opacity = '1';
        overlay.style.transition = 'none';

        clearTimeout(overlay._timer);
        overlay._timer = setTimeout(() => {
            overlay.style.transition = 'opacity .35s ease';
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 350);
        }, 1600);
    }

    /* ============================ FUNCIONES ============================ */

    function palabrasDesdeTextarea() {
        const crudas = textarea.value.split('\n').map(x => x.trim()).filter(Boolean);
        return [...new Set(crudas)];
    }

    function updateWordCount() {
        if (!contador) return;
        const n = palabrasDesdeTextarea().length;
        contador.textContent = `${n} palabra${n === 1 ? '' : 's'} · ${dominio}`;
    }

    async function guardar() {
        config.palabras = palabrasDesdeTextarea();
        config.color = colorInput.value;

        base = await obtenerBase();
        base[dominio] = config;
        await guardarBase(base);

        updateHighlightStyle();
        refresh();
        updateWordCount();
        actualizarSwatch();

        showOverlay(`💾 Guardado — ${config.palabras.length} palabra${config.palabras.length === 1 ? '' : 's'}`);
    }

    function limpiarLista() {
        if (!config.palabras.length && !textarea.value.trim()) return;
        if (!confirm(`¿Vaciar la lista de palabras para ${dominio}?`)) return;

        textarea.value = '';
        updateWordCount();
        showOverlay('🗑️ Lista vaciada (pulsa Guardar para confirmar)');
    }

    async function exportarSitio() {
        const datos = { [dominio]: config };
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const fecha = new Date().toISOString().slice(0, 10);

        GM_download({
            url: URL.createObjectURL(blob),
            name: `resaltar-${dominio}-${fecha}.json`,
            saveAs: true
        });

        showOverlay(`📤 Exportado (solo ${dominio})`);
    }

    async function exportarTodo() {
        const datos = await obtenerBase();
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const fecha = new Date().toISOString().slice(0, 10);

        GM_download({
            url: URL.createObjectURL(blob),
            name: `resaltar-global-${fecha}.json`,
            saveAs: true
        });

        showOverlay('📦 Exportado (todos los sitios)');
    }

    function importar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) { input.remove(); return; }

            try {
                const nuevos = JSON.parse(await file.text());

                if (typeof nuevos !== 'object' || nuevos === null || Array.isArray(nuevos)) {
                    alert('Archivo inválido: se esperaba un objeto { "dominio": { palabras, color } }.');
                    input.remove();
                    return;
                }

                const actuales = await obtenerBase();
                const fusionados = { ...actuales };
                for (const [dom, val] of Object.entries(nuevos)) {
                    fusionados[dom] = normalizarConfig(val);
                }

                await guardarBase(fusionados);

                base = fusionados;
                config = normalizarConfig(base[dominio]);

                textarea.value = config.palabras.join('\n');
                colorInput.value = config.color;
                updateWordCount();
                actualizarSwatch();
                actualizarSeleccionPreset();

                refresh();
                updateHighlightStyle();

                showOverlay('📥 Importado');
            } catch {
                alert('Error al importar: el archivo no es un JSON válido.');
            }

            input.remove();
        };

        input.click();
    }

    /* ============================ ESTILOS DE RESALTADO ============================ */

    let styleTag;

    function updateHighlightStyle() {
        styleTag?.remove();
        styleTag = document.createElement('style');
        styleTag.textContent = `
            .rh-highlight {
                color:${config.color} !important;
                font-weight:bold !important;
                text-shadow:0 0 8px ${config.color};
                border-radius:4px;
            }
        `;
        document.head.appendChild(styleTag);
    }

    GM_addStyle(`::selection { background:#ff006e; color:white; }`);

    /* ============================ PANEL ============================ */

    let rhPanel, rhFab, textarea, colorInput, contador, swatch, hexLabel, expandirBtn, presetsWrap;
    let colorBtn, colorBtnDot, colorBtnLabel, colorPopover, colorWrap;
    let panelAbierto = false;
    let colorPopoverAbierto = false;
    let textareaExpandida = false;

    const COLORES_PRESET = ['#ff3366', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#818cf8', '#f472b6'];

    function toggleMenu(forzarEstado) {
        const abrir = forzarEstado ?? !panelAbierto;
        panelAbierto = abrir;

        if (abrir) {
            rhPanel.style.visibility = 'visible';
            rhPanel.style.pointerEvents = 'auto';
            setTimeout(() => {
                rhPanel.style.opacity = '1';
                rhPanel.style.transform = 'translateY(0) scale(1)';
            }, 10);
        } else {
            rhPanel.style.opacity = '0';
            rhPanel.style.transform = 'translateY(14px) scale(.96)';
            rhPanel.style.pointerEvents = 'none';
            setTimeout(() => { if (!panelAbierto) rhPanel.style.visibility = 'hidden'; }, 220);
            if (colorPopoverAbierto) toggleColorPopover(false);
        }

        rhFab.setAttribute('aria-expanded', String(abrir));
        rhFab.style.transform = abrir ? 'rotate(90deg)' : 'rotate(0deg)';
    }

    async function applyFloatingMenuVisibility() {
        const visible = await GM_getValue(MENU_VISIBLE_KEY, true);
        rhFab.style.display = visible ? 'flex' : 'none';
        if (!visible) toggleMenu(false);
    }

    async function toggleFloatingMenuVisibility() {
        const visible = await GM_getValue(MENU_VISIBLE_KEY, true);
        await GM_setValue(MENU_VISIBLE_KEY, !visible);
        applyFloatingMenuVisibility();
    }

    function actualizarSwatch() {
        if (!swatch) return;
        swatch.style.background = colorInput.value;
        hexLabel.textContent = colorInput.value.toUpperCase();

        if (colorBtnDot && colorBtnLabel) {
            colorBtnDot.style.background = colorInput.value;
            colorBtnDot.style.color = colorInput.value;
            colorBtnLabel.textContent = colorInput.value.toUpperCase();
        }
        if (colorBtn) {
            colorBtn.style.borderColor = `${colorInput.value}88`;
            colorBtn.style.background = `linear-gradient(135deg, ${colorInput.value}30, ${colorInput.value}10)`;
        }
    }

    function toggleColorPopover(forzarEstado) {
        const abrir = forzarEstado ?? !colorPopoverAbierto;
        colorPopoverAbierto = abrir;

        if (abrir) {
            colorPopover.style.visibility = 'visible';
            colorPopover.style.pointerEvents = 'auto';
            setTimeout(() => {
                colorPopover.style.opacity = '1';
                colorPopover.style.transform = 'translateY(0) scale(1)';
            }, 10);
        } else {
            colorPopover.style.opacity = '0';
            colorPopover.style.transform = 'translateY(8px) scale(.96)';
            colorPopover.style.pointerEvents = 'none';
            setTimeout(() => { if (!colorPopoverAbierto) colorPopover.style.visibility = 'hidden'; }, 180);
        }
    }

    function actualizarSeleccionPreset() {
        if (!presetsWrap) return;
        const actual = colorInput.value.toLowerCase();
        presetsWrap.querySelectorAll('button').forEach(chip => {
            const coincide = chip.dataset.color.toLowerCase() === actual;
            chip.style.borderColor = coincide ? '#ffffff' : 'transparent';
        });
    }

    let alturaPreviaAExpandir = null;

    function toggleExpandirTextarea() {
        textareaExpandida = !textareaExpandida;

        if (textareaExpandida) {
            alturaPreviaAExpandir = getComputedStyle(textarea).height;
            textarea.style.height = '70vh';
        } else {
            textarea.style.height = alturaPreviaAExpandir || '140px';
        }

        expandirBtn.textContent = textareaExpandida ? '🗗' : '🗖';
    }

    function etiqueta(texto) {
        const l = document.createElement('label');
        l.textContent = texto;
        l.style.cssText = `
            color:#8b96ad; font-size:9.5px; font-weight:700;
            text-transform:uppercase; letter-spacing:.05em;
        `;
        return l;
    }

    function crearBoton(container, text, gradient, action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = text;
        btn.onclick = action;
        btn.style.cssText = `
            width:100%; border:none; border-radius:8px; padding:6px 8px;
            background:${gradient}; color:white;
            font:600 11px system-ui, -apple-system, sans-serif; cursor:pointer;
            letter-spacing:.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
            box-shadow:0 2px 6px rgba(0,0,0,.3);
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 5px 14px rgba(0,0,0,.4)';
            btn.style.filter = 'brightness(1.1)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
            btn.style.filter = 'none';
        };
        container.appendChild(btn);
        return btn;
    }

    function createFloatingMenu() {
        if (rhPanel) return;

        rhPanel = document.createElement('div');
        rhPanel.className = 'rh-ui';
        rhPanel.style.cssText = `
            position:fixed; right:16px; bottom:64px;
            width:min(330px, 92vw);
            max-height:85vh;
            overflow-y:auto;
            background:linear-gradient(165deg, rgba(24,29,48,.97), rgba(10,13,24,.97));
            backdrop-filter:blur(14px);
            border:1px solid rgba(255,255,255,.08);
            border-radius:14px;
            padding:12px;
            display:flex; flex-direction:column; gap:7px;
            z-index:999999;
            box-shadow:0 18px 44px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.02) inset;
            font-family:system-ui, -apple-system, sans-serif;
            opacity:0; visibility:hidden; pointer-events:none;
            transform:translateY(14px) scale(.96);
            transition:opacity .22s ease, transform .22s ease;
        `;
        document.body.appendChild(rhPanel);

        /* HEADER */
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';

        const tituloWrap = document.createElement('div');
        tituloWrap.style.cssText = 'display:flex; align-items:center; gap:7px; min-width:0;';

        const iconoTitulo = document.createElement('div');
        iconoTitulo.textContent = '✨';
        iconoTitulo.style.cssText = 'font-size:14px; flex-shrink:0;';
        tituloWrap.appendChild(iconoTitulo);

        const tituloTextos = document.createElement('div');
        tituloTextos.style.cssText = 'min-width:0; overflow:hidden;';

        const titulo = document.createElement('div');
        titulo.textContent = 'Resaltador';
        titulo.style.cssText = `
            color:white; font-size:13.5px; font-weight:700; letter-spacing:-.01em;
            line-height:1.2;
        `;
        tituloTextos.appendChild(titulo);

        const subtitulo = document.createElement('div');
        subtitulo.textContent = dominio;
        subtitulo.style.cssText = `
            color:#64748b; font-size:10px; font-family:monospace;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        `;
        tituloTextos.appendChild(subtitulo);

        tituloWrap.appendChild(tituloTextos);
        header.appendChild(tituloWrap);

        const cerrarBtn = document.createElement('button');
        cerrarBtn.type = 'button';
        cerrarBtn.textContent = '✕';
        cerrarBtn.title = 'Cerrar';
        cerrarBtn.style.cssText = `
            background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
            color:#94a3b8; font-size:12px; width:22px; height:22px; flex-shrink:0;
            cursor:pointer; line-height:1; border-radius:7px;
            display:flex; align-items:center; justify-content:center;
            transition:background .15s ease, color .15s ease, transform .15s ease;
        `;
        cerrarBtn.onmouseenter = () => {
            cerrarBtn.style.background = 'rgba(255,255,255,.12)';
            cerrarBtn.style.color = 'white';
            cerrarBtn.style.transform = 'rotate(90deg)';
        };
        cerrarBtn.onmouseleave = () => {
            cerrarBtn.style.background = 'rgba(255,255,255,.05)';
            cerrarBtn.style.color = '#94a3b8';
            cerrarBtn.style.transform = 'rotate(0deg)';
        };
        cerrarBtn.onclick = () => toggleMenu(false);
        header.appendChild(cerrarBtn);

        rhPanel.appendChild(header);

        /* TEXTAREA */
        const filaPalabrasHeader = document.createElement('div');
        filaPalabrasHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
        filaPalabrasHeader.appendChild(etiqueta('Palabras a resaltar (una por línea)'));

        expandirBtn = document.createElement('button');
        expandirBtn.type = 'button';
        expandirBtn.textContent = '🗖';
        expandirBtn.title = 'Expandir/Reducir';
        expandirBtn.style.cssText = `
            font-size:11px; font-weight:600; padding:3px 7px; border-radius:6px;
            border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04);
            color:#cbd5e1; cursor:pointer; transition:background .15s ease; flex-shrink:0;
        `;
        expandirBtn.onmouseenter = () => { expandirBtn.style.background = 'rgba(255,255,255,.1)'; };
        expandirBtn.onmouseleave = () => { expandirBtn.style.background = 'rgba(255,255,255,.04)'; };
        expandirBtn.onclick = toggleExpandirTextarea;
        filaPalabrasHeader.appendChild(expandirBtn);

        rhPanel.appendChild(filaPalabrasHeader);

        textarea = document.createElement('textarea');
        textarea.placeholder = 'palabra1\npalabra2\npalabra3...';
        textarea.value = config.palabras.join('\n');
        textarea.spellcheck = false;
        textarea.wrap = 'off';
        textarea.style.cssText = `
            width:100%; height:${alturaGuardada || '140px'};
            background:rgba(0,0,0,.35); color:#e5e9f0;
            border:1px solid rgba(255,255,255,.09); border-radius:9px;
            padding:8px 9px; resize:vertical;
            font-size:12.5px; line-height:1.5; font-family:'SFMono-Regular', Menlo, monospace;
            box-sizing:border-box; outline:none;
            white-space:pre; overflow-x:auto;
            transition:border-color .15s ease, box-shadow .15s ease;
        `;
        textarea.onfocus = () => {
            textarea.style.borderColor = '#4fc3ff';
            textarea.style.boxShadow = '0 0 0 3px rgba(79,195,255,.15)';
        };
        textarea.onblur = () => {
            textarea.style.borderColor = 'rgba(255,255,255,.09)';
            textarea.style.boxShadow = 'none';
        };
        textarea.oninput = updateWordCount;
        rhPanel.appendChild(textarea);

        // Persiste el alto del textarea (ya sea arrastrado a mano o vía el
        // botón Expandir/Reducir) para que sobreviva a recargas de la página.
        let alturaSaveTimer = null;
        new ResizeObserver(() => {
            clearTimeout(alturaSaveTimer);
            alturaSaveTimer = setTimeout(() => {
                GM_setValue(TEXTAREA_HEIGHT_KEY, getComputedStyle(textarea).height);
            }, 400);
        }).observe(textarea);

        contador = document.createElement('div');
        contador.style.cssText = 'color:#64748b; font-size:10px; margin-top:-3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
        rhPanel.appendChild(contador);
        updateWordCount();

        /* SEPARADOR */
        const separador1 = document.createElement('div');
        separador1.style.cssText = 'height:1px; background:rgba(255,255,255,.08); margin:1px 0;';
        rhPanel.appendChild(separador1);

        /* BOTONES */
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
        rhPanel.appendChild(buttonContainer);

        /* Fila: Guardar + botón de color (con popover) */
        const filaGuardarColor = document.createElement('div');
        filaGuardarColor.style.cssText = 'display:flex; gap:6px;';
        buttonContainer.appendChild(filaGuardarColor);

        const wrapGuardar = document.createElement('div');
        wrapGuardar.style.cssText = 'flex:2;';
        crearBoton(wrapGuardar, '💾 Guardar', 'linear-gradient(135deg,#34d399,#059669)', guardar);
        filaGuardarColor.appendChild(wrapGuardar);

        colorWrap = document.createElement('div');
        colorWrap.style.cssText = 'flex:1; position:relative;';
        filaGuardarColor.appendChild(colorWrap);

        colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.title = 'Color de resaltado';
        colorBtn.style.cssText = `
            width:100%; height:100%; min-height:26px; min-width:0; box-sizing:border-box;
            border-radius:8px; cursor:pointer; overflow:hidden;
            border:1px solid rgba(255,255,255,.14);
            display:flex; align-items:center; justify-content:center; gap:4px;
            font:600 10px system-ui, -apple-system, sans-serif; color:white;
            transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease, filter .15s ease;
            box-shadow:0 2px 6px rgba(0,0,0,.3);
        `;
        colorBtn.onmouseenter = () => {
            colorBtn.style.transform = 'translateY(-1px)';
            colorBtn.style.boxShadow = '0 5px 14px rgba(0,0,0,.4)';
            colorBtn.style.filter = 'brightness(1.15)';
        };
        colorBtn.onmouseleave = () => {
            colorBtn.style.transform = 'translateY(0)';
            colorBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
            colorBtn.style.filter = 'none';
        };
        colorBtn.onclick = e => { e.stopPropagation(); toggleColorPopover(); };
        colorWrap.appendChild(colorBtn);

        colorBtnDot = document.createElement('span');
        colorBtnDot.style.cssText = `
            width:10px; height:10px; border-radius:50%; flex-shrink:0;
            box-shadow:0 0 0 2px rgba(255,255,255,.25), 0 0 6px 1px currentColor;
        `;
        colorBtn.appendChild(colorBtnDot);

        colorBtnLabel = document.createElement('span');
        colorBtnLabel.style.cssText = 'font-family:monospace; letter-spacing:.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;';
        colorBtn.appendChild(colorBtnLabel);

        /* Popover flotante con el selector real y los presets */
        colorPopover = document.createElement('div');
        colorPopover.className = 'rh-ui';
        colorPopover.style.cssText = `
            position:absolute; bottom:calc(100% + 8px); right:0; width:176px;
            background:linear-gradient(165deg, rgba(30,35,56,.98), rgba(12,15,26,.98));
            border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:10px;
            display:flex; flex-direction:column; gap:8px;
            box-shadow:0 16px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03) inset;
            opacity:0; visibility:hidden; pointer-events:none;
            transform:translateY(8px) scale(.96);
            transition:opacity .18s ease, transform .18s ease;
            z-index:1000000;
        `;
        colorWrap.appendChild(colorPopover);

        colorPopover.appendChild(etiqueta('Color de resaltado'));

        const filaSwatchHex = document.createElement('div');
        filaSwatchHex.style.cssText = 'display:flex; align-items:center; gap:12px;';

        const swatchWrap = document.createElement('div');
        swatchWrap.style.cssText = `
            position:relative; width:28px; height:28px; flex-shrink:0;
            border-radius:8px; cursor:pointer;
        `;

        swatch = document.createElement('div');
        swatch.style.cssText = `
            width:100%; height:100%; border-radius:10px;
            box-shadow:0 0 0 2px rgba(255,255,255,.12), inset 0 0 0 1px rgba(0,0,0,.15);
            transition:transform .15s ease, box-shadow .15s ease;
        `;
        swatchWrap.appendChild(swatch);

        colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = config.color;
        colorInput.style.cssText = `
            position:absolute; inset:0; width:100%; height:100%;
            opacity:0; cursor:pointer; border:none; padding:0;
        `;
        colorInput.oninput = () => { actualizarSwatch(); actualizarSeleccionPreset(); };
        swatchWrap.appendChild(colorInput);

        swatchWrap.onmouseenter = () => { swatch.style.transform = 'scale(1.06)'; };
        swatchWrap.onmouseleave = () => { swatch.style.transform = 'scale(1)'; };

        filaSwatchHex.appendChild(swatchWrap);

        hexLabel = document.createElement('div');
        hexLabel.style.cssText = `
            color:#cbd5e1; font-size:11px; font-family:monospace; letter-spacing:.03em;
        `;
        filaSwatchHex.appendChild(hexLabel);

        colorPopover.appendChild(filaSwatchHex);

        presetsWrap = document.createElement('div');
        presetsWrap.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';

        COLORES_PRESET.forEach(c => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.dataset.color = c;
            chip.title = c;
            chip.style.cssText = `
                width:17px; height:17px; border-radius:50%; background:${c};
                border:2px solid transparent; cursor:pointer; padding:0;
                transition:transform .12s ease, border-color .12s ease;
            `;
            chip.onmouseenter = () => { chip.style.transform = 'scale(1.15)'; };
            chip.onmouseleave = () => { chip.style.transform = 'scale(1)'; };
            chip.onclick = () => {
                colorInput.value = c;
                actualizarSwatch();
                actualizarSeleccionPreset();
            };
            presetsWrap.appendChild(chip);
        });

        colorPopover.appendChild(presetsWrap);
        actualizarSwatch();
        actualizarSeleccionPreset();

        const grillaSecundaria = document.createElement('div');
        grillaSecundaria.style.cssText = 'display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:6px;';
        buttonContainer.appendChild(grillaSecundaria);

        crearBoton(grillaSecundaria, '📥 Importar', 'linear-gradient(135deg,#60a5fa,#2563eb)', importar);
        crearBoton(grillaSecundaria, '📤 Sitio', 'linear-gradient(135deg,#c084fc,#9333ea)', exportarSitio);
        crearBoton(grillaSecundaria, '📦 Todo', 'linear-gradient(135deg,#a78bfa,#6d28d9)', exportarTodo);
        crearBoton(grillaSecundaria, '🗑️ Limpiar', 'linear-gradient(135deg,#fb7185,#e11d48)', limpiarLista);

        /* FAB */
        rhFab = document.createElement('button');
        rhFab.type = 'button';
        rhFab.className = 'rh-ui';
        rhFab.textContent = '☰';
        rhFab.title = 'Menú de resaltado';
        rhFab.setAttribute('aria-expanded', 'false');
        rhFab.style.cssText = `
            position:fixed; right:20px; bottom:20px; width:44px; height:44px;
            border:none; border-radius:50%;
            background:linear-gradient(140deg,#ff5fa2,#ff006e 60%,#c2007a);
            color:white; font-size:18px; font-weight:bold; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            z-index:999999;
            box-shadow:0 6px 18px rgba(255,0,110,.4), 0 0 0 1px rgba(255,255,255,.08) inset;
            transition:transform .2s ease, box-shadow .2s ease;
        `;
        rhFab.onmouseenter = () => {
            rhFab.style.boxShadow = '0 10px 30px rgba(255,0,110,.6), 0 0 0 1px rgba(255,255,255,.08) inset';
        };
        rhFab.onmouseleave = () => {
            rhFab.style.boxShadow = '0 8px 24px rgba(255,0,110,.45), 0 0 0 1px rgba(255,255,255,.08) inset';
        };
        rhFab.onclick = () => toggleMenu();
        document.body.appendChild(rhFab);

        /* CERRAR CON CLIC AFUERA / ESCAPE */
        document.addEventListener('click', e => {
            if (colorPopoverAbierto && !colorWrap.contains(e.target)) toggleColorPopover(false);

            if (!panelAbierto) return;
            if (rhPanel.contains(e.target) || rhFab.contains(e.target)) return;
            toggleMenu(false);
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (colorPopoverAbierto) { toggleColorPopover(false); return; }
            if (panelAbierto) toggleMenu(false);
        });

        applyFloatingMenuVisibility();
    }

    /* ============================ INIT ============================ */

    // Importante: NO se usa el evento 'load', porque ese evento espera a que
    // TODAS las imágenes de la página terminen de descargar. En pestañas en
    // segundo plano el navegador frena esas descargas, así que 'load' podía
    // tardar muchísimo (o no llegar) y el resaltado/botón nunca aparecían.
    // 'document-idle' (el @run-at de este script) ya garantiza que el DOM
    // esté listo, así que arrancamos de inmediato.
    function init() {
        updateHighlightStyle();
        refresh();
        createFloatingMenu();
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    }

    GM_registerMenuCommand('☰ Mostrar/Ocultar botón flotante', toggleFloatingMenuVisibility);

})();
