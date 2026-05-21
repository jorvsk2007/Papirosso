import { showElement, hideElement, setText } from './utils.js';
import { getTrabajadorPorCURP } from './supabaseClient.js';

const form = document.getElementById('login-form');
const curpInput = document.getElementById('login-curp');
const passwordInput = document.getElementById('login-password');
const errorMessage = document.getElementById('login-error');

function validarCURP(curp) {
    return typeof curp === 'string' && curp.trim().length >= 4;
}

function validarContrasena(password) {
    return typeof password === 'string' && password.trim().length >= 4;
}

function mostrarError(text) {
    if (!errorMessage) return;
    setText(errorMessage, text);
    showElement(errorMessage);
}

function cerrarError() {
    if (!errorMessage) return;
    setText(errorMessage, '');
    hideElement(errorMessage);
}

async function ejecutarLogin(event) {
    event.preventDefault();
    cerrarError();

    const curp = curpInput.value.trim();
    const password = passwordInput.value.trim();

    if (!validarCURP(curp)) {
        mostrarError('Ingresa una CURP válida de al menos 4 caracteres.');
        return;
    }

    if (!validarContrasena(password)) {
        mostrarError('La contraseña debe tener al menos 4 caracteres.');
        return;
    }

    const loginData = {
        curp,
        password
    };

    try {
        const { data, error } = await getTrabajadorPorCURP(curp);
        console.debug('Auth result', { data, error });

        if (error || !data) {
            mostrarError('CURP o contraseña incorrectos. Verifica tu cuenta.');
            return;
        }

        if (!data.activo) {
            mostrarError('La cuenta de este trabajador no está activa.');
            return;
        }

        if (data.password !== password) {
            mostrarError('CURP o contraseña incorrectos.');
            return;
        }

        sessionStorage.setItem('trabajador', JSON.stringify({ curp: data.curp, nombre: data.nombre, rol: data.rol }));
        window.location.href = 'cliente-publico.html';
    } catch (error) {
        mostrarError('Error de conexión. Revisa tu red o la API.');
        console.error(error);
    }
}

if (form) {
    form.addEventListener('submit', ejecutarLogin);
}
