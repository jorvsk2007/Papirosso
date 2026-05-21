function inicializarInicio() {
    const btnLogin = document.getElementById('go-login');
    const btnPublic = document.getElementById('go-public');

    if (btnLogin) btnLogin.addEventListener('click', () => {
        window.location.href = 'login.html';
    });

    if (btnPublic) btnPublic.addEventListener('click', () => {
        window.location.href = 'cliente-publico.html';
    });
}

window.addEventListener('DOMContentLoaded', inicializarInicio);
