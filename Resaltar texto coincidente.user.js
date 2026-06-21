// ==UserScript==
// @name         Resaltar texto coincidente
// @namespace    http://tampermonkey.net/
// @version      2026.06.20
// @description  Resalta palabras con menú flotante moderno
// @author       wernser412
// @icon         https://raw.githubusercontent.com/wernser412/Resaltar-texto-coincidente/refs/heads/main/ICONO.png
// @downloadURL  https://github.com/wernser412/Resaltar-texto-coincidente/raw/refs/heads/main/Resaltar%20texto%20coincidente.user.js
// @match        *://hentaitk.net/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(async function () {

'use strict';

/* ============================ CONFIG */

const MENU_VISIBLE_KEY =
    "rh_menu_visible";

let config =
    JSON.parse(
        await GM_getValue(
            "resaltarConfig",
            JSON.stringify({
                palabras: [],
                color: "#ff0000"
            })
        )
    );

/* ============================ UTILS */

function escapeRegExp(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
    );
}

/* ============================ RESALTAR */

function resaltarTexto(node) {

    if (
        node.nodeType !== 3 ||
        !config.palabras.length
    ) return;

    if (
        node.parentNode?.closest(
            'span[data-resaltado]'
        )
    ) return;

    const texto =
        node.nodeValue;

    const regex = new RegExp(

    `\\b(${
        config.palabras
            .slice()
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp)
            .join('|')
    })\\b`,

    'gi'
);

    if (!regex.test(texto))
        return;

    const fragment =
        document.createDocumentFragment();

    const nuevoHTML =
        texto.replace(

            regex,

            `<span
                class="rh-highlight"
                data-resaltado="true"
            >$1</span>`
        );

    const tempDiv =
        document.createElement(
            'div'
        );

    tempDiv.innerHTML =
        nuevoHTML;

    while (
        tempDiv.firstChild
    ) {

        fragment.appendChild(
            tempDiv.firstChild
        );
    }

    node.parentNode.replaceChild(
        fragment,
        node
    );
}

function recorrerNodos(node) {

    if (
        node.nodeType === 3
    ) {

        resaltarTexto(node);

    } else if (

        node.nodeType === 1 &&

        ![
            'SCRIPT',
            'STYLE',
            'TEXTAREA',
            'INPUT',
            'CODE',
            'PRE'
        ].includes(node.nodeName)

    ) {

        node.childNodes.forEach(
            recorrerNodos
        );
    }
}

function limpiarResaltados() {

    document.querySelectorAll(
        'span[data-resaltado]'
    ).forEach(span => {

        span.replaceWith(
            document.createTextNode(
                span.textContent
            )
        );
    });
}

function refresh() {

    limpiarResaltados();

    recorrerNodos(
        document.body
    );
}

/* ============================ OBSERVER */

new MutationObserver(muts => {

    muts.forEach(m => {

        m.addedNodes.forEach(
            recorrerNodos
        );
    });

}).observe(document.body, {

    childList: true,

    subtree: true
});

/* ============================ OVERLAY */

let overlay;

function showOverlay(text) {

    if (!overlay) {

        overlay =
            document.createElement("div");

        overlay.style.cssText = `
            position:fixed;

            top:50%;
            left:50%;

            transform:
                translate(-50%,-50%);

            z-index:999999;
        `;

        const box =
            document.createElement("div");

        box.style.cssText = `
            width:420px;

            background:#0b1220;

            color:#fff;

            border:4px solid #4fc3ff;

            border-radius:20px;

            padding:20px;

            font-size:20px;
            font-weight:bold;

            text-align:center;
        `;

        overlay.appendChild(box);

        document.body.appendChild(
            overlay
        );
    }

    overlay.firstChild.textContent =
        text;

    overlay.style.display =
        "block";

    setTimeout(() => {

        overlay.style.display =
            "none";

    }, 1800);
}

/* ============================ FUNCIONES */

async function guardar() {

    config.palabras =

        textarea.value
            .split('\n')
            .map(x => x.trim())
            .filter(Boolean);

    config.color =
        colorInput.value;

    await GM_setValue(

        "resaltarConfig",

        JSON.stringify(config)
    );

    refresh();

    updateHighlightStyle();

    showOverlay(
        "💾 Guardado"
    );
}

async function exportar() {

    const blob =
        new Blob(

            [
                JSON.stringify(
                    config,
                    null,
                    2
                )
            ],

            {
                type:
                    'application/json'
            }
        );

    GM_download({

        url:
            URL.createObjectURL(
                blob
            ),

        name:
            'resaltar-config.json',

        saveAs: true
    });

    showOverlay(
        "📤 Exportado"
    );
}

function importar() {

    const input =
        document.createElement(
            'input'
        );

    input.type = 'file';

    input.accept =
        '.json';

    input.style.display =
        'none';

    document.body.appendChild(
        input
    );

    input.onchange =
        async e => {

            const file =
                e.target.files[0];

            if (!file)
                return;

            const text =
                await file.text();

            try {

                const data =
                    JSON.parse(text);

                if (
                    !Array.isArray(
                        data.palabras
                    )
                ) {

                    alert(
                        "Archivo inválido"
                    );

                    return;
                }

                config =
                    data;

                await GM_setValue(

                    "resaltarConfig",

                    JSON.stringify(config)
                );

                textarea.value =
                    config.palabras.join(
                        '\n'
                    );

                colorInput.value =
                    config.color;

                refresh();

                updateHighlightStyle();

                showOverlay(
                    "📥 Importado"
                );

            } catch {

                alert(
                    "Error al importar"
                );
            }

            input.remove();
        };

    input.click();
}

/* ============================ PANEL */

let rhPanel;

let rhFab;

let textarea;

let colorInput;

function toggleMenu() {

    rhPanel.style.display =

        rhPanel.style.display === "flex"

            ? "none"

            : "flex";
}

async function applyFloatingMenuVisibility() {

    const visible =
        await GM_getValue(
            MENU_VISIBLE_KEY,
            true
        );

    rhFab.style.display =
        visible
            ? "block"
            : "none";

    if (!visible) {

        rhPanel.style.display =
            "none";
    }
}

async function toggleFloatingMenuVisibility() {

    const visible =
        await GM_getValue(
            MENU_VISIBLE_KEY,
            true
        );

    await GM_setValue(
        MENU_VISIBLE_KEY,
        !visible
    );

    applyFloatingMenuVisibility();
}

async function createFloatingMenu() {

    if (rhPanel)
        return;

    rhPanel =
        document.createElement(
            "div"
        );

    rhPanel.style.cssText = `
        position:fixed;

        right:20px;
        bottom:90px;

        width:420px;

        background:#0f172a;

        border:2px solid #334155;

        border-radius:18px;

        padding:16px;

        display:none;

        flex-direction:column;

        gap:12px;

        z-index:999999;

        box-shadow:
            0 10px 30px rgba(0,0,0,.45);
    `;

    document.body.appendChild(
        rhPanel
    );

    /* HEADER */

    const header =
        document.createElement(
            "div"
        );

    header.textContent =
        "✨ Resaltador";

    header.style.cssText = `
        color:white;

        font-size:18px;

        font-weight:bold;
    `;

    rhPanel.appendChild(
        header
    );

    /* COLOR */

    colorInput =
        document.createElement(
            "input"
        );

    colorInput.type =
        "color";

    colorInput.value =
        config.color;

    colorInput.style.cssText = `
        width:100%;

        height:50px;

        border:none;

        border-radius:10px;

        cursor:pointer;

        background:none;
    `;

    rhPanel.appendChild(
        colorInput
    );

    /* TEXTAREA */

    textarea =
        document.createElement(
            "textarea"
        );

    textarea.placeholder =
        "palabra1\npalabra2";

    textarea.value =
        config.palabras.join(
            '\n'
        );

    textarea.style.cssText = `
        width:100%;

        height:220px;

        background:#111827;

        color:white;

        border:1px solid #334155;

        border-radius:12px;

        padding:12px;

        resize:vertical;

        font-size:14px;

        font-family:monospace;

        box-sizing:border-box;
    `;

    rhPanel.appendChild(
        textarea
    );

    /* BOTONES */

    const buttonContainer =
        document.createElement(
            "div"
        );

    buttonContainer.style.cssText = `
        display:flex;

        flex-direction:column;

        gap:10px;
    `;

    rhPanel.appendChild(
        buttonContainer
    );

    function createBtn(
        text,
        color,
        action
    ) {

        const btn =
            document.createElement(
                "button"
            );

        btn.textContent =
            text;

        btn.onclick =
            action;

        btn.style.cssText = `
            width:100%;

            border:none;

            border-radius:12px;

            padding:12px;

            background:${color};

            color:white;

            font-size:14px;

            font-weight:600;

            cursor:pointer;
        `;

        buttonContainer.appendChild(
            btn
        );
    }

    createBtn(
        "💾 Guardar",
        "#16a34a",
        guardar
    );

    createBtn(
        "📥 Importar",
        "#2563eb",
        importar
    );

    createBtn(
        "📤 Exportar",
        "#9333ea",
        exportar
    );

    /* FAB */

    rhFab =
        document.createElement(
            "button"
        );

    rhFab.textContent =
        "☰";

    rhFab.title =
        "Menú";

    rhFab.style.cssText = `
        position:fixed;

        right:20px;
        bottom:20px;

        width:60px;
        height:60px;

        border:none;

        border-radius:50%;

        background:#ff006e;

        color:white;

        font-size:28px;

        font-weight:bold;

        cursor:pointer;

        z-index:999999;

        box-shadow:
            0 4px 12px rgba(0,0,0,.4);
    `;

    rhFab.onclick =
        toggleMenu;

    document.body.appendChild(
        rhFab
    );

    applyFloatingMenuVisibility();
}

/* ============================ ESTILOS */

let styleTag;

function updateHighlightStyle() {

    styleTag?.remove();

    styleTag =
        document.createElement(
            "style"
        );

    styleTag.textContent = `
        .rh-highlight{

            color:${config.color} !important;

            font-weight:bold !important;

            text-shadow:
                0 0 8px ${config.color};

            border-radius:4px;
        }
    `;

    document.head.appendChild(
        styleTag
    );
}

GM_addStyle(`

::selection{

    background:#ff006e;

    color:white;
}

`);

/* ============================ INIT */

window.addEventListener(
    "load",
    async () => {

        updateHighlightStyle();

        refresh();

        createFloatingMenu();
    }
);

/* ============================ MENU */

GM_registerMenuCommand(

    "☰ Mostrar/Ocultar botón flotante",

    toggleFloatingMenuVisibility
);

})();
