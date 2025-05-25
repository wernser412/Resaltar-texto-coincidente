// ==UserScript==
// @name         Resaltar texto coincidente mejorado
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Resalta palabras específicas en hentaitk.net con opciones configurables, color y funciones de importación/exportación JSON integradas en el menú de Tampermonkey.
// @author       wernser412
// @icon         https://raw.githubusercontent.com/wernser412/Resaltar-texto-coincidente/refs/heads/main/icono.png
// @downloadURL  https://github.com/wernser412/Resaltar-texto-coincidente/raw/refs/heads/main/Resaltar%20texto%20coincidente.user.js
// @match        *://hentaitk.net/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    let config = JSON.parse(localStorage.getItem('resaltarConfig')) || {
        palabras: [],
        color: '#FF0000'
    };

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function resaltarTexto(node) {
        if (node.nodeType !== 3 || !config.palabras.length) return;
        if (node.parentNode.closest('span[data-resaltado]')) return;

        const texto = node.nodeValue;
        const regex = new RegExp(`\\b(${config.palabras.map(escapeRegExp).join('|')})`, 'gi');
        if (!regex.test(texto)) return;

        const fragment = document.createDocumentFragment();
        const nuevoHTML = texto.replace(regex, `<span style="color: ${config.color}; font-weight: bold;" data-resaltado="true">$1</span>`);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nuevoHTML;

        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }

        node.parentNode.replaceChild(fragment, node);
    }

    function recorrerNodos(node) {
        if (node.nodeType === 3) {
            resaltarTexto(node);
        } else if (node.nodeType === 1 && !['SCRIPT', 'STYLE'].includes(node.nodeName)) {
            node.childNodes.forEach(recorrerNodos);
        }
    }

    function observarCambios() {
        const observer = new MutationObserver(mutations => {
            observer.disconnect();
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => recorrerNodos(node));
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    recorrerNodos(document.body);
    observarCambios();

    // Modal
    const modal = document.createElement('div');
    Object.assign(modal.style, {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: 'white', border: '1px solid #ccc', padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: '1001', display: 'none',
        width: '500px', height: '400px', resize: 'both', overflow: 'hidden',
        transition: 'opacity 0.3s ease', opacity: '0'
    });
    modal.setAttribute('tabindex', '-1');

    const modalHeader = document.createElement('div');
    Object.assign(modalHeader.style, {
        width: '100%', height: '30px', cursor: 'move', background: '#ddd',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fontSize: '16px'
    });
    modalHeader.textContent = 'Mover formulario';
    modal.appendChild(modalHeader);

    let isDragging = false, offsetX, offsetY;
    modalHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - modal.offsetLeft;
        offsetY = e.clientY - modal.offsetTop;
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            requestAnimationFrame(() => {
                modal.style.left = `${e.clientX - offsetX}px`;
                modal.style.top = `${e.clientY - offsetY}px`;
            });
        }
    });
    document.addEventListener('mouseup', () => isDragging = false);

    const colorInput = document.createElement('input');
    Object.assign(colorInput.style, { width: '100%', margin: '10px 0' });
    colorInput.type = 'color';
    colorInput.value = config.color;
    modal.appendChild(colorInput);

    const textarea = document.createElement('textarea');
    Object.assign(textarea.style, {
        width: '100%', height: 'calc(100% - 120px)', resize: 'none'
    });
    textarea.placeholder = 'Ingrese las palabras a resaltar, una por línea...';
    textarea.value = config.palabras.join('\n');
    modal.appendChild(textarea);

    const saveButton = document.createElement('button');
    Object.assign(saveButton.style, {
        position: 'absolute', bottom: '10px', left: '10px',
        backgroundColor: '#28a745', color: 'white',
        border: 'none', borderRadius: '5px', cursor: 'pointer', padding: '5px 10px'
    });
    saveButton.textContent = 'Guardar';
    saveButton.onclick = () => {
        config.palabras = textarea.value.split('\n').map(p => p.trim()).filter(Boolean);
        config.color = colorInput.value;
        localStorage.setItem('resaltarConfig', JSON.stringify(config));

        document.querySelectorAll('span[data-resaltado]').forEach(span => {
            span.replaceWith(document.createTextNode(span.textContent));
        });

        requestAnimationFrame(() => {
            document.querySelectorAll('body *:not(script):not(style)').forEach(el => {
                el.childNodes.forEach(resaltarTexto);
            });
        });

        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    };
    modal.appendChild(saveButton);

    const cancelButton = document.createElement('button');
    Object.assign(cancelButton.style, {
        position: 'absolute', bottom: '10px', right: '10px',
        backgroundColor: '#6c757d', color: 'white',
        border: 'none', borderRadius: '5px', cursor: 'pointer', padding: '5px 10px'
    });
    cancelButton.textContent = 'Cancelar';
    cancelButton.onclick = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    };
    modal.appendChild(cancelButton);

    const closeButton = document.createElement('button');
    Object.assign(closeButton.style, {
        position: 'absolute', top: '5px', right: '10px', backgroundColor: '#DC3545',
        color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'
    });
    closeButton.textContent = 'X';
    closeButton.onclick = cancelButton.onclick;
    modal.appendChild(closeButton);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancelButton.onclick();
    });

    document.body.appendChild(modal);

    // Menú Tampermonkey
    GM_registerMenuCommand("🛠️ Configurar palabras resaltadas", () => {
        textarea.value = config.palabras.join('\n');
        colorInput.value = config.color;
        modal.style.display = 'block';
        requestAnimationFrame(() => modal.style.opacity = '1');
        modal.focus();
    });

    GM_registerMenuCommand("📤 Exportar configuración", () => {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resaltar-config.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    GM_registerMenuCommand("📥 Importar configuración", () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data.palabras) || typeof data.color !== 'string') {
                        alert('Archivo no válido.');
                        return;
                    }
                    config = data;
                    localStorage.setItem('resaltarConfig', JSON.stringify(config));
                    alert('Configuración importada correctamente.');
                    recorrerNodos(document.body); // aplicar resaltado nuevo
                } catch (err) {
                    alert('Error al leer el archivo.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

})();
