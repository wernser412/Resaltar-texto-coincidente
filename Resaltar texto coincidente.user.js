// ==UserScript==
// @name         Resaltar texto coincidente
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Resalta palabras específicas en hentaitk.net con menú en Tampermonkey sin congelar la página.
// @author       wernser412
// @match        *://hentaitk.net/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    let palabrasGuardadas = JSON.parse(localStorage.getItem('palabrasResaltadas')) || [];

    function resaltarTexto(node) {
        if (node.nodeType !== 3 || !palabrasGuardadas.length) return;

        let texto = node.nodeValue;
        let regex = new RegExp(`\\b(${palabrasGuardadas.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

        if (regex.test(texto)) {
            let fragment = document.createDocumentFragment();
            let nuevoHTML = texto.replace(regex, '<span style="color: red; font-weight: bold;">$1</span>');
            let tempDiv = document.createElement('div');
            tempDiv.innerHTML = nuevoHTML;

            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }

            node.parentNode.replaceChild(fragment, node);
        }
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

    // Crear modal flotante
    const modal = document.createElement('div');
    Object.assign(modal.style, {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: 'white', border: '1px solid #ccc', padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: '1001', display: 'none',
        width: '500px', height: '400px', resize: 'both', overflow: 'hidden'
    });

    const modalHeader = document.createElement('div');
    Object.assign(modalHeader.style, {
        width: '100%', height: '30px', cursor: 'move', background: '#ddd',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fontSize: '16px'
    });
    modalHeader.textContent = 'Mover formulario';
    modal.appendChild(modalHeader);

    let isDragging = false, offsetX, offsetY;
    modalHeader.addEventListener('mousedown', (event) => {
        isDragging = true;
        offsetX = event.clientX - modal.offsetLeft;
        offsetY = event.clientY - modal.offsetTop;
    });

    function handleMouseMove(event) {
        if (isDragging) {
            requestAnimationFrame(() => {
                modal.style.left = `${event.clientX - offsetX}px`;
                modal.style.top = `${event.clientY - offsetY}px`;
            });
        }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => isDragging = false);

    const closeButton = document.createElement('button');
    Object.assign(closeButton.style, {
        position: 'absolute', top: '5px', right: '10px', backgroundColor: '#DC3545',
        color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'
    });
    closeButton.textContent = 'X';

    closeButton.onclick = () => {
        palabrasGuardadas = textarea.value.split('\n').map(p => p.trim()).filter(Boolean);
        localStorage.setItem('palabrasResaltadas', JSON.stringify(palabrasGuardadas));

        requestAnimationFrame(() => recorrerNodos(document.body));

        modal.style.display = 'none';
    };

    modal.appendChild(closeButton);

    const textarea = document.createElement('textarea');
    Object.assign(textarea.style, { width: '100%', height: 'calc(100% - 40px)', resize: 'none' });
    textarea.placeholder = 'Ingrese las palabras a resaltar, una por línea...';
    textarea.value = palabrasGuardadas.join('\n');
    modal.appendChild(textarea);

    document.body.appendChild(modal);
    GM_registerMenuCommand("Configurar palabras resaltadas", () => {
        modal.style.display = 'block';
        textarea.focus();
    });

})();
