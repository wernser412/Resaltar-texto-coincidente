// ==UserScript==
// @name         Resaltar texto coincidente
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Resalta en rojo palabras específicas en hentaitk.net con un botón para ingresar palabras, incluyendo hipervínculos
// @author       wernser412
// @match        *://hentaitk.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Recuperar palabras guardadas o inicializar como un array vacío
    let palabrasGuardadas = JSON.parse(localStorage.getItem('palabrasResaltadas')) || [];

    // Crear un botón para ingresar palabras
    let boton = document.createElement('button');
    boton.textContent = 'Ingresar palabras';
    boton.style.position = 'fixed';
    boton.style.top = '10px';
    boton.style.right = '10px';
    boton.style.zIndex = '1000';
    boton.style.padding = '10px';
    boton.style.backgroundColor = '#007BFF';
    boton.style.color = 'white';
    boton.style.border = 'none';
    boton.style.borderRadius = '5px';
    boton.style.cursor = 'pointer';

    document.body.appendChild(boton);

    // Crear un contenedor modal para el textarea
    let modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.border = '1px solid #ccc';
    modal.style.padding = '20px';
    modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    modal.style.zIndex = '1001';
    modal.style.display = 'none';

    let textarea = document.createElement('textarea');
    textarea.style.width = '300px';
    textarea.style.height = '200px';
    textarea.style.resize = 'none';
    textarea.placeholder = 'Ingrese las palabras, una por línea...';
    textarea.value = palabrasGuardadas.join('\n');

    let guardarBoton = document.createElement('button');
    guardarBoton.textContent = 'Guardar';
    guardarBoton.style.marginTop = '10px';
    guardarBoton.style.padding = '10px';
    guardarBoton.style.backgroundColor = '#007BFF';
    guardarBoton.style.color = 'white';
    guardarBoton.style.border = 'none';
    guardarBoton.style.borderRadius = '5px';
    guardarBoton.style.cursor = 'pointer';

    let cerrarBoton = document.createElement('button');
    cerrarBoton.textContent = 'Cerrar';
    cerrarBoton.style.marginLeft = '10px';
    cerrarBoton.style.padding = '10px';
    cerrarBoton.style.backgroundColor = '#DC3545';
    cerrarBoton.style.color = 'white';
    cerrarBoton.style.border = 'none';
    cerrarBoton.style.borderRadius = '5px';
    cerrarBoton.style.cursor = 'pointer';

    modal.appendChild(textarea);
    modal.appendChild(guardarBoton);
    modal.appendChild(cerrarBoton);
    document.body.appendChild(modal);

    boton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    cerrarBoton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    guardarBoton.addEventListener('click', () => {
        palabrasGuardadas = textarea.value.split('\n').map(p => p.trim()).filter(Boolean);
        localStorage.setItem('palabrasResaltadas', JSON.stringify(palabrasGuardadas));
        resaltarTexto(document.body, palabrasGuardadas);
        modal.style.display = 'none';
    });

    // Función para envolver las palabras coincidentes en un span con estilo
    function resaltarTexto(nodo, palabras) {
        if (nodo.nodeType === 3) { // Nodo de texto
            let texto = nodo.nodeValue;
            let expresion = new RegExp(`(${palabras.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
            if (expresion.test(texto)) {
                let span = document.createElement('span');
                span.innerHTML = texto.replace(expresion, '<span style="color: red;">$1</span>');
                nodo.parentNode.replaceChild(span, nodo);
            }
        } else if (nodo.nodeType === 1 && nodo.nodeName !== 'SCRIPT' && nodo.nodeName !== 'STYLE') {
            for (let i = 0; i < nodo.childNodes.length; i++) {
                resaltarTexto(nodo.childNodes[i], palabras);
            }
        }
    }

    // Resaltar automáticamente al cargar la página si hay palabras guardadas
    if (palabrasGuardadas.length > 0) {
        resaltarTexto(document.body, palabrasGuardadas);
    }
})();
