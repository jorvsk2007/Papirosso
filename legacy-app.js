// ==========================================
// 1. CONFIGURACIÓN GLOBAL Y VARIABLES DE ESTADO
// ==========================================
const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://jorvsk2007-github-io.onrender.com";

let usuarioActual = null;
let carrito = [];
let totalVentaAnterior = 0;
let clienteSeleccionado = null; 
let clientesLocalesPanel = []; // Almacén para el buscador del panel de clientes

// ==========================================
// 2. FUNCIONES DE INTERFAZ (MODALES Y MENÚS)
// ==========================================
function abrirLogin() {
    document.getElementById('modal-login').classList.remove('hidden');
    document.getElementById('input-curp').focus();
}

function cerrarLogin() {
    document.getElementById('modal-login').classList.add('hidden');
    document.getElementById('login-error-msg').classList.add('hidden');
}

function toggleDropdown() {
    document.getElementById('user-dropdown').classList.toggle('hidden');
}

function abrirBuscador() {
    document.getElementById('modal-busqueda').classList.remove('hidden');
    document.getElementById('search-input').value = '';
    filtrarProductos(''); 
}

function cerrarBuscador() {
    document.getElementById('modal-busqueda').classList.add('hidden');
}

// ==========================================
// 3. LÓGICA DE AUTENTICACIÓN (LOGIN)
// ==========================================
async function ejecutarLogin() {
    const curpInput = document.getElementById('login-curp');
    const passwordInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error');
    
    const valorCurp = curpInput ? curpInput.value.trim() : '';
    const valorPassword = passwordInput ? passwordInput.value.trim() : '';
    
    if (!valorCurp || !valorPassword) {
        alert("Por favor, ingresa tu CURP y contraseña.");
        return;
    }

    let urlBase = API_URL.replace(/\/+$/, ""); 
    if (!urlBase.endsWith('/api')) {
        urlBase += '/api';
    }

    try {
        const respuesta = await fetch(`${urlBase}/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                curp: valorCurp,
                password: valorPassword
            })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            if (errorMsg) {
                errorMsg.innerText = data.error || "Error en las credenciales.";
                errorMsg.classList.remove('hidden');
            }
            alert(data.error || "Error en las credenciales.");
            return;
        }

        usuarioActual = data;
        if (errorMsg) errorMsg.classList.add('hidden');
        
        alert(`¡Bienvenido! Has ingresado como: ${data.rol}`);
        localStorage.setItem('usuario', JSON.stringify(data));
        window.location.href = "panel.html";

    } catch (e) {
        console.error("Error de comunicación:", e);
        alert("Error de conexión con el servidor: " + e.message);
    }
}

function cerrarSesion() {
    usuarioActual = null;
    localStorage.removeItem('usuario');
    window.location.href = "login.html";
}

// ==========================================
// 4. NAVEGACIÓN, CONTROL DE ROLES Y PESTAÑAS
// ==========================================
function verificarPermisosPanel() {
    const sesion = localStorage.getItem('usuario');
    
    if (!sesion) {
        alert("No has iniciado sesión. Redirigiendo al login...");
        window.location.href = "login.html";
        return;
    }

    usuarioActual = JSON.parse(sesion);
    const rol = usuarioActual.rol.toLowerCase().trim();
    
    const nombreCompleto = usuarioActual.persona ? `${usuarioActual.persona.nombre} ${usuarioActual.persona.apellidos}` : "Empleado";
    const userDisplay = document.getElementById('user-display-name');
    if (userDisplay) {
        userDisplay.innerText = `${usuarioActual.rol}: ${nombreCompleto}`;
    }

    // CONTROL VISUAL POR ROLES AL ENTRAR
    if (rol === 'administrador' || rol === 'admin') {
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    } 
    else if (rol === 'cajero') {
        ocultarElemento('nav-productos');
        ocultarElemento('nav-clientes');
        ocultarElemento('nav-registro'); 
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    } 
    else if (rol === 'almacenista') {
        ocultarElemento('nav-ventas');
        ocultarElemento('nav-clientes');
        ocultarElemento('nav-reportes');
        ocultarElemento('nav-registro'); 
        switchTab('section-productos', document.getElementById('nav-productos'));
    }
}

function ocultarElemento(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function switchTab(tabId, botonActivado) {
    const rolActual = usuarioActual && usuarioActual.rol ? usuarioActual.rol.toLowerCase().trim() : '';

    // PROTECCIÓN DE SEGURIDAD EN NAVEGACIÓN
    if (tabId === 'section-reportes' && rolActual !== 'admin' && rolActual !== 'administrador') {
        alert("Acceso Denegado. Módulo reservado para Administradores.");
        return;
    }
    if (tabId === 'section-registro' && rolActual !== 'admin' && rolActual !== 'administrador') {
        alert("Acceso Denegado. Solo los administradores pueden dar de alta personal.");
        return;
    }
    if (tabId === 'section-ventas' && rolActual === 'almacenista') {
        alert("Los almacenistas no operan la caja de cobro.");
        return;
    }

    // Estilo de enlaces activos
    document.querySelectorAll('.hero-nav a').forEach(btn => { if (btn) btn.classList.remove('active'); });
    if (botonActivado) botonActivado.classList.add('active');

    // Cambiar de pestaña
    const contenidos = document.querySelectorAll('.tab-content');
    contenidos.forEach(c => c.classList.add('hidden'));

    const pestañaActiva = document.getElementById(tabId);
    if (pestañaActiva) pestañaActiva.classList.remove('hidden');

    // CARGA DE DATOS DINÁMICOS SEGÚN LA PESTAÑA ACTIVA
    if (tabId === 'section-ventas') {
        const contenedorVentas = document.getElementById('section-ventas');
        contenedorVentas.innerHTML = `
            <h2>🛒 Punto de Venta (Módulo de Cobro)</h2>
            <div class="ventas-view" style="display: grid; grid-template-columns: 1fr 320px; gap: 20px; margin-top: 20px;">
                <div class="ticket-section" style="background: white; padding: 24px; border-radius: 16px; border: 1px solid var(--border);">
                    <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);">
                        <div>
                            <small style="display:block; color:var(--text-muted); text-transform:uppercase; font-size:10px; font-weight:bold;">Cliente asignado:</small>
                            <span id="cliente-info-display" style="font-weight: 600; color: var(--text-main);">
                                ${clienteSeleccionado ? clienteSeleccionado : 'Público General'}
                            </span>
                        </div>
                        <button class="btn-confirm" onclick="abrirModalCliente()" style="background: var(--text-muted); font-size: 13px; padding: 8px 14px;">
                            🔍 Cambiar Cliente
                        </button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h3 style="margin:0;">Venta en curso</h3>
                        <button class="btn-confirm" onclick="abrirBuscador()">+ Agregar Producto</button>
                    </div>
                    <table class="ticket-table" style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align:left; border-bottom: 1px solid var(--border);">
                                <th style="padding:10px 5px;">Producto</th>
                                <th>Cant.</th>
                                <th>Precio</th>
                                <th>Subtotal</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="ticket-body"></tbody>
                    </table>
                </div>
                <div class="totals-section" style="background: var(--header-bg); color: white; padding: 24px; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; min-height: 280px;">
                    <div class="last-sale" style="opacity: 0.7; font-size: 14px;">Última venta: $${totalVentaAnterior.toFixed(2)}</div>
                    <div class="current-total" style="margin: 20px 0;">
                        <label style="display:block; font-size: 11px; opacity:0.6; font-weight:800; letter-spacing:1px;">TOTAL A COBRAR</label>
                        <span id="display-total" style="font-size: 36px; font-weight: 800; display:block; margin-top:5px;">$0.00</span>
                    </div>
                    <button class="btn-vender" onclick="registrarVenta()" style="background: var(--accent); color: white; width: 100%; padding: 16px; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 16px;">
                        🎰 REGISTRAR VENTA
                    </button>
                </div>
            </div>
        `;
        actualizarVistaTicket();
    }
    else if (tabId === 'section-productos') {
        irAProductos();
    }
    else if (tabId === 'section-clientes') {
        cargarClientesPanel();
    }
    else if (tabId === 'section-reportes') {
        irAReportes();
    }
}

// ==========================================
// 5. GESTIÓN DE PRODUCTOS E INVENTARIO
// ==========================================
async function irAProductos() {
    const tablaBody = document.getElementById('inventario-tabla-body');
    const btnContainer = document.getElementById('btn-nuevo-producto-container');
    const gridPublico = document.getElementById('product-grid');
    
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        const data = await respuesta.json();

        if (gridPublico) {
            if (!data || data.length === 0) {
                gridPublico.innerHTML = '<p class="no-products">No hay productos disponibles.</p>';
                return;
            }
            gridPublico.innerHTML = data.map(p => `
                <article class="product-card">
                    <div class="product-info">
                        <span class="product-id">ID: ${p.id_producto}</span>
                        <h3>${p.nombre}</h3>
                        <p class="price">$${p.precio.toFixed(2)}</p>
                        <p class="stock ${p.cant_exist <= 5 ? 'low-stock' : ''}">Disponibles: ${p.cant_exist}</p>
                    </div>
                    <button class="btn-confirm" onclick="añadirAlCarrito('${p.id_producto}', '${p.nombre}', ${p.precio})">Añadir al carrito</button>
                </article>`).join('');
            return;
        }

        if (tablaBody) {
            const rol = usuarioActual ? usuarioActual.rol.toLowerCase() : '';
            const puedeAgregar = (rol === 'admin' || rol === 'administrador' || rol === 'almacenista');

            if (btnContainer) {
                btnContainer.innerHTML = puedeAgregar ? `<button class="btn-confirm" onclick="abrirModalProducto()">+ Nuevo Producto</button>` : '';
            }

            tablaBody.innerHTML = data.map(p => `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding:12px 10px;"><mark style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:bold;">${p.id_producto}</mark></td>
                    <td><strong>${p.nombre}</strong></td>
                    <td>$${p.precio.toFixed(2)}</td>
                    <td><span style="font-weight:bold; color:${p.cant_exist <= 5 ? 'red' : 'green'}">${p.cant_exist} pzas</span></td>
                </tr>`).join('');
        }
    } catch (e) { 
        console.error("Error al cargar productos", e); 
    }
}

async function filtrarProductos(termino) {
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        let data = await respuesta.json();

        if (termino) {
            data = data.filter(p => p.nombre.toLowerCase().includes(termino.toLowerCase()));
        }

        const body = document.getElementById('search-results-body');
        if (body) {
            body.innerHTML = data.map(p => `
                <tr>
                    <td>${p.id_producto}</td>
                    <td><strong>${p.nombre}</strong></td>
                    <td>$${p.precio}</td>
                    <td>${p.cant_exist}</td>
                    <td><button class="btn-confirm" onclick="añadirAlCarrito('${p.id_producto}', '${p.nombre}', ${p.precio})">Añadir</button></td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error(e); }
}

function abrirModalProducto() {
    document.getElementById('modal-nuevo-producto').classList.remove('hidden');
}

function cerrarModalProducto() {
    document.getElementById('modal-nuevo-producto').classList.add('hidden');
    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-precio').value = '';
    document.getElementById('reg-stock').value = '';
}

async function guardarProductoBD() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const precio = parseFloat(document.getElementById('reg-precio').value);
    const stock = parseInt(document.getElementById('reg-stock').value);

    if (!nombre || isNaN(precio) || isNaN(stock)) {
        return alert("Por favor, llena todos los campos correctamente.");
    }

    const idManual = "P-" + Math.floor(Math.random() * 999);

    try {
        const respuesta = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id_producto: idManual, 
                nombre: nombre, 
                precio: precio, 
                cant_exist: stock 
            })
        });

        if (!respuesta.ok) throw new Error("Error al guardar en API");

        alert("Producto registrado exitosamente con ID: " + idManual);
        cerrarModalProducto();
        irAProductos(); 

    } catch (err) {
        alert("Error al guardar: " + err.message);
    }
}

// ==========================================
// 6. LÓGICA DE PUNTO DE VENTA Y CARRITO (TICKET)
// ==========================================
function añadirAlCarrito(id, nombre, precio) {
    const index = carrito.findIndex(item => item.id === id);
    if (index !== -1) {
        carrito[index].cantidad++;
    } else {
        carrito.push({ id, nombre, precio, presidential: 1, cantidad: 1 });
    }
    cerrarBuscador();
    actualizarVistaTicket();
}

function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarVistaTicket();
}

function cambiarCantidad(idx, delta) {
    const nuevoValor = carrito[idx].cantidad + delta;
    if (nuevoValor <= 0) {
        quitarDelCarrito(idx);
    } else {
        carrito[idx].cantidad = nuevoValor;
        actualizarVistaTicket();
    }
}

function actualizarVistaTicket() {
    const body = document.getElementById('ticket-body');
    const displayTotal = document.getElementById('display-total');
    if (!body) return;

    let sumaTotal = 0;
    body.innerHTML = carrito.map((item, idx) => {
        const subtotal = item.precio * item.cantidad;
        sumaTotal += subtotal;
        return `
            <tr>
                <td style="padding:10px 5px;">${item.nombre}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="cambiarCantidad(${idx}, -1)" style="width:25px; cursor:pointer;">-</button>
                        <span>${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${idx}, 1)" style="width:25px; cursor:pointer;">+</button>
                    </div>
                </td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${subtotal.toFixed(2)}</td>
                <td><button onclick="quitarDelCarrito(${idx})" style="color:red; border:none; background:none; cursor:pointer;">✖</button></td>
            </tr>
        `;
    }).join('');

    if (displayTotal) {
        displayTotal.innerText = `$${sumaTotal.toFixed(2)}`;
    }
}

async function registrarVenta() {
    if (carrito.length === 0) return alert("El ticket está vacío.");

    try {
        const totalVenta = parseFloat(document.getElementById('display-total').innerText.replace('$', ''));
        
        const ventaData = {
            precio_total: totalVenta,
            curp_cliente: clienteSeleccionado,
            curp_trabajador: usuarioActual.curp,
            detalles: carrito 
        };

        const respuesta = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert("Venta registrada con éxito: " + (resultado.id_venta || "OK"));
            totalVentaAnterior = totalVenta;
            carrito = [];
            switchTab('section-ventas', document.getElementById('nav-ventas'));
        } else {
            throw new Error(resultado.error);
        }
    } catch (err) {
        alert("No se pudo registrar: " + err.message);
    }
}

// ==========================================
// 7. HISTORIAL Y REPORTES FINANCIEROS
// ==========================================
async function irAReportes() {
    const tablaBody = document.getElementById('reportes-tabla-body');
    if (!tablaBody) return;
    
    try {
        const respuesta = await fetch(`${API_URL}/reportes`);
        const data = await respuesta.json();

        tablaBody.innerHTML = data.map(v => `
            <tr style="border-bottom:1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding:15px 10px; font-weight:600; color:var(--primary);">#${v.id_venta}</td>
                <td>${new Date(v.fecha).toLocaleDateString()} ${new Date(v.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td style="font-weight:800; color:var(--accent);">$${parseFloat(v.precio_total).toFixed(2)}</td>
                <td><small style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-family:monospace;">${v.curp_trabajador}</small></td>
            </tr>`).join('');
    } catch (e) { 
        console.error("Error al cargar reportes", e); 
    }
}

// ==========================================
// 8. CONTROL DE CLIENTES (PUNTO DE VENTA Y PANEL)
// ==========================================
async function abrirModalCliente() {
    document.getElementById('modal-cliente').classList.remove('hidden');
    try {
        const respuesta = await fetch(`${API_URL}/clientes`);
        const clientes = await respuesta.json();
        renderizarListaClientesModal(clientes);
    } catch (e) { console.error("Error al traer clientes", e); }
}

function renderizarListaClientesModal(clientes) {
    const body = document.getElementById('lista-clientes-body');
    if (!body) return;
    
    if (!clientes || clientes.length === 0) {
        body.innerHTML = '<tr><td colspan="3">No hay datos</td></tr>';
        return;
    }

    body.innerHTML = clientes.map(c => {
        const nombreDisplay = c.persona ? `${c.persona.nombre} ${c.persona.apellidos}` : "Sin nombre";
        return `
            <tr>
                <td>${nombreDisplay}</td>
                <td><small>${c.curp}</small></td> 
                <td><button class="btn-confirm" onclick="fijarCliente('${c.curp}', '${c.persona?.nombre || 'Cliente'}')">Elegir</button></td>
            </tr>
        `;
    }).join('');
}

function fijarCliente(curp, nombre) {
    clienteSeleccionado = curp;
    const infoDisplay = document.getElementById('cliente-info-display');
    if (infoDisplay) infoDisplay.innerText = `Cliente: ${nombre}`;
    cerrarModalCliente();
}

function seleccionarClienteNull() {
    clienteSeleccionado = null;
    const infoDisplay = document.getElementById('cliente-info-display');
    if (infoDisplay) infoDisplay.innerText = "Público General";
    cerrarModalCliente();
}

function cerrarModalCliente() {
    document.getElementById('modal-cliente').classList.add('hidden');
}

async function filtrarClientes(termino) {
    try {
        const respuesta = await fetch(`${API_URL}/clientes`);
        const todosLosClientes = await respuesta.json();

        if (!termino.trim()) {
            renderizarListaClientesModal(todosLosClientes);
            return;
        }

        const busqueda = termino.toLowerCase();
        const clientesFiltrados = todosLosClientes.filter(c => {
            const nombre = (c.persona?.nombre || "").toLowerCase();
            const apellidos = (c.persona?.apellidos || "").toLowerCase();
            const curp = (c.curp || "").toLowerCase();
            return nombre.includes(busqueda) || apellidos.includes(busqueda) || curp.includes(busqueda);
        });

        renderizarListaClientesModal(clientesFiltrados);
    } catch (e) { console.error(e); }
}

// --- VISTA DIRECTA DE LA PESTAÑA DEL DIRECTORIO DE CLIENTES ---
async function cargarClientesPanel() {
    const tablaBody = document.getElementById('clientes-tabla-body');
    if (!tablaBody) return;

    try {
        const respuesta = await fetch(`${API_URL}/clientes`);
        clientesLocalesPanel = await respuesta.json();
        renderizarClientesEnPanel(clientesLocalesPanel);
    } catch (e) {
        console.error("Error cargando clientes del panel", e);
    }
}

function renderizarClientesEnPanel(lista) {
    const tablaBody = document.getElementById('clientes-tabla-body');
    if (!tablaBody) return;

    if (!lista || lista.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="2" style="padding:20px; text-align:center;">No se encontraron clientes</td></tr>';
        return;
    }
    tablaBody.innerHTML = lista.map(c => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding:12px 10px;"><strong>${c.persona ? c.persona.nombre + ' ' + c.persona.apellidos : 'Sin Nombre'}</strong></td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${c.curp}</code></td>
        </tr>`).join('');
}

function filtrarClientesPanel(termino) {
    const busqueda = termino.toLowerCase().trim();
    const filtrados = clientesLocalesPanel.filter(c => {
        const nombreStr = c.persona ? `${c.persona.nombre} ${c.persona.apellidos}`.toLowerCase() : '';
        return nombreStr.includes(busqueda) || c.curp.toLowerCase().includes(busqueda);
    });
    renderizarClientesEnPanel(filtrados);
}

// ==========================================
// 9. FORMULARIO DE ALTA (TRABAJADORES Y CLIENTES)
// ==========================================
function toggleCamposRegistro() {
    const tipo = document.getElementById('alta-tipo').value;
    const camposTrabajador = document.getElementById('campos-trabajador');
    
    if (tipo === 'trabajador') {
        camposTrabajador.classList.remove('hidden');
        document.getElementById('alta-rol').required = true;
        document.getElementById('alta-sueldo').required = true;
        document.getElementById('alta-password').required = true;
    } else {
        camposTrabajador.classList.add('hidden');
        document.getElementById('alta-rol').required = false;
        document.getElementById('alta-sueldo').required = false;
        document.getElementById('alta-password').required = false;
    }
}

async function guardarNuevoUsuario(event) {
    event.preventDefault();

    const tipo = document.getElementById('alta-tipo').value;
    const curp = document.getElementById('alta-curp').value.trim().toUpperCase();
    const nombre = document.getElementById('alta-nombre').value.trim();
    const apellidos = document.getElementById('alta-apellidos').value.trim();

    if (curp.length !== 18) {
        return alert("La CURP debe tener exactamente 18 caracteres.");
    }

    const payload = {
        tipo: tipo,
        curp: curp,
        nombre: nombre,
        apellidos: apellidos
    };

    if (tipo === 'trabajador') {
        payload.rol = document.getElementById('alta-rol').value;
        payload.sueldo = parseFloat(document.getElementById('alta-sueldo').value);
        payload.password = document.getElementById('alta-password').value;
    }

    try {
        const respuesta = await fetch(`${API_URL}/usuarios/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await respuesta.json();

        if (!respuesta.ok) throw new Error(data.error || "Error al procesar registro.");

        alert(`¡Éxito! Nuevo ${tipo} registrado correctamente.`);
        document.getElementById('form-alta-usuario').reset();
        toggleCamposRegistro();
    } catch (err) {
        alert("No se pudo registrar: " + err.message);
    }
}
