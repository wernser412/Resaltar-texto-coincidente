// ==UserScript==
// @name         Resaltar texto coincidente
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Resalta en rojo palabras específicas en hentaitk.net con un botón para ingresar palabras, incluyendo hipervínculos
// @author       wernser412
// @match        *://hentaitk.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Recuperar palabras guardadas o inicializar como un array vacío
    let palabrasGuardadas = JSON.parse(localStorage.getItem('palabrasResaltadas')) || [];

    // Crear un contenedor para el botón
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'highlight-button-container';
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.top = '10px';
    buttonContainer.style.right = '10px';
    buttonContainer.style.zIndex = '1000';
    buttonContainer.style.backgroundColor = '#f9f9f9';
    buttonContainer.style.padding = '5px';
    buttonContainer.style.borderRadius = '8px';
    buttonContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    buttonContainer.style.cursor = 'move';
    buttonContainer.style.width = '160px';  // Ancho fijo
    buttonContainer.style.height = '50px';  // Alto fijo
    buttonContainer.style.display = 'flex';  // Usar Flexbox para centrar el contenido
    buttonContainer.style.justifyContent = 'center';  // Centrar horizontalmente
    buttonContainer.style.alignItems = 'center';  // Centrar verticalmente

    // Crear un botón para ingresar palabras
    const boton = document.createElement('button');
    boton.textContent = 'Ingresar palabras';
    boton.style.cursor = 'pointer';
    boton.style.padding = '10px';
    boton.style.border = 'none';
    boton.style.borderRadius = '5px';
    boton.style.backgroundColor = '#4CAF50'; // Verde
    boton.style.color = 'white';
    boton.style.fontSize = '14px';
    boton.style.width = '150px'; // Ancho fijo
    boton.style.textAlign = 'center'; // Centrar el texto

    boton.onclick = () => modal.style.display = 'block';

    buttonContainer.appendChild(boton);
    document.body.appendChild(buttonContainer);

    // Crear un contenedor modal para el textarea
    const modal = document.createElement('div');
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

    const textarea = document.createElement('textarea');
    textarea.style.width = '300px';
    textarea.style.height = '200px';
    textarea.style.resize = 'none';
    textarea.placeholder = 'Ingrese las palabras, una por línea...';
    textarea.value = palabrasGuardadas.join('\n');

    const guardarBoton = document.createElement('button');
    guardarBoton.textContent = 'Guardar';
    guardarBoton.style.marginTop = '10px';
    guardarBoton.style.padding = '10px';
    guardarBoton.style.backgroundColor = '#4CAF50'; // Verde
    guardarBoton.style.color = 'white';
    guardarBoton.style.border = 'none';
    guardarBoton.style.borderRadius = '5px';
    guardarBoton.style.cursor = 'pointer';
    guardarBoton.onclick = () => {
        palabrasGuardadas = textarea.value.split('\n').map(p => p.trim()).filter(Boolean);
        localStorage.setItem('palabrasResaltadas', JSON.stringify(palabrasGuardadas));
        resaltarTexto(document.body, palabrasGuardadas);
        modal.style.display = 'none';
    };

    const cerrarBoton = document.createElement('button');
    cerrarBoton.textContent = 'Cerrar';
    cerrarBoton.style.marginLeft = '10px';
    cerrarBoton.style.padding = '10px';
    cerrarBoton.style.backgroundColor = '#DC3545'; // Rojo
    cerrarBoton.style.color = 'white';
    cerrarBoton.style.border = 'none';
    cerrarBoton.style.borderRadius = '5px';
    cerrarBoton.style.cursor = 'pointer';
    cerrarBoton.onclick = () => modal.style.display = 'none';

    modal.appendChild(textarea);
    modal.appendChild(guardarBoton);
    modal.appendChild(cerrarBoton);
    document.body.appendChild(modal);

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

    // Hacer el contenedor arrastrable
    makeDraggable(buttonContainer);

    function makeDraggable(element) {
        let posX = 0, posY = 0, initialX = 0, initialY = 0;

        element.onmousedown = function (event) {
            event.preventDefault();
            initialX = event.clientX;
            initialY = event.clientY;

            document.onmousemove = function (event) {
                event.preventDefault();

                posX = initialX - event.clientX;
                posY = initialY - event.clientY;
                initialX = event.clientX;
                initialY = event.clientY;

                element.style.top = (element.offsetTop - posY) + "px";
                element.style.left = (element.offsetLeft - posX) + "px";
            };

            document.onmouseup = function () {
                document.onmousemove = null;
                document.onmouseup = null;

                // Guardar la posición final del botón en almacenamiento local
                localStorage.setItem('buttonPosition', JSON.stringify({
                    top: element.style.top,
                    left: element.style.left
                }));
            };
        };

        // Restaurar posición guardada al recargar la página
        const savedPosition = JSON.parse(localStorage.getItem('buttonPosition'));
        if (savedPosition) {
            element.style.top = savedPosition.top;
            element.style.left = savedPosition.left;
        }
    }
})();
