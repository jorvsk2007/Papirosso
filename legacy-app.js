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
let clientesLocalesPanel = []; // Almacén para el buscador de la pestaña de clientes

// Función auxiliar para garantizar que todas las consultas apunten al prefijo /api correctamente
function obtenerUrlBaseAPI() {
    let urlBase = API_URL.replace(/\/+$/, ""); 
    if (!urlBase.endsWith('/api')) {
        urlBase += '/api';
    }
    return urlBase;
}

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

// Control del menú desplegable de usuario
function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function abrirBuscador() {
    const modalBusqueda = document.getElementById('modal-busqueda');
    if (modalBusqueda) {
        modalBusqueda.classList.remove('hidden');
        document.getElementById('search-input').value = '';
        filtrarProductos(''); 
    }
}

function cerrarBuscador() {
    const modalBusqueda = document.getElementById('modal-busqueda');
    if (modalBusqueda) modalBusqueda.classList.add('hidden');
}

// ==========================================
// 3. LÓGICA DE AUTENTICACIÓN (LOGIN) - LIMPIA Y CORREGIDA
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

    const urlBase = obtenerUrlBaseAPI();

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
        
        // Redirección condicionada según el rol
        if (data.rol.toLowerCase().trim() === 'cliente') {
            window.location.href = "cliente-publico.html";
        } else {
            window.location.href = "panel.html";
        }

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

    // CONTROL VISUAL POR ROLES AL ENTRAR Y ASIGNACIÓN DE PESTAÑA INICIAL
    if (rol === 'administrador' || rol === 'admin') {
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    } 
    else if (rol === 'cajero') {
        ocultarElemento('nav-productos');
        ocultarElemento('nav-clientes');
        ocultarElemento('nav-text-registro'); 
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    } 
    else if (rol === 'almacenista') {
        ocultarElemento('nav-ventas');
        ocultarElemento('nav-clientes');
        ocultarElemento('nav-reportes');
        ocultarElemento('nav-text-registro'); 
        switchTab('section-productos', document.getElementById('nav-productos'));
    }
}

function ocultarElemento(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function switchTab(tabId, botonActivado) {
    const rolActual = usuarioActual && usuarioActual.rol ? usuarioActual.rol.toLowerCase().trim() : '';

    // PROTECCIÓN DE SEGURIDAD EN NAVEGACIÓN SEGÚN EL ROL DE LA BD
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

    // Estilo visual de enlaces activos en el Navbar
    document.querySelectorAll('.hero-nav a').forEach(btn => { if (btn) btn.classList.remove('active'); });
    if (botonActivado) botonActivado.classList.add('active');

    // Ocultar y mostrar la pestaña correspondiente
    const contenidos = document.querySelectorAll('.tab-content');
    contenidos.forEach(c => c.classList.add('hidden'));

    const pestañaActiva = document.getElementById(tabId);
    if (pestañaActiva) pestañaActiva.classList.remove('hidden');

    // DISPARAR CONSULTAS AL BACKEND CORRESPONDIENTES A CADA MÓDULO
    if (tabId === 'section-ventas') {
        const contenedorVentas = document.getElementById('section-ventas');
        contenedorVentas.innerHTML = `
            <h2 class="text-2xl font-extrabold tracking-tight mb-2">🛒 Punto de Venta (Módulo de Cobro)</h2>
            <p class="text-sm text-slate-500 mb-6">Genera un nuevo ticket de compra asociando artículos de la tienda.</p>
            <div class="ventas-view style="display: grid;" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="ticket-section lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div class="bg-slate-50 p-4 rounded-xl mb-6 flex justify-between items-center border border-slate-200">
                        <div>
                            <small class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente asignado:</small>
                            <span id="cliente-info-display" class="font-bold text-slate-800">
                                ${clienteSeleccionado ? clienteSeleccionado : 'Público General'}
                            </span>
                        </div>
                        <button class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition" onclick="abrirModalCliente()">
                            🔍 Cambiar Cliente
                        </button>
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-slate-800 text-lg">Artículos en la venta en curso</h3>
                        <button class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition" onclick="abrirBuscador()">+ Agregar Producto</button>
                    </div>
                    <table class="w-full text-sm text-left border-collapse">
                        <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                                <th class="py-3 px-2">Producto</th>
                                <th class="py-3 px-2">Cant.</th>
                                <th class="py-3 px-2">Precio</th>
                                <th class="py-3 px-2">Subtotal</th>
                                <th class="py-3 px-2 text-center">Remover</th>
                            </tr>
                        </thead>
                        <tbody id="ticket-body" class="divide-y divide-slate-100 text-slate-700"></tbody>
                    </table>
                </div>
                <div class="totals-section bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between min-height-[280px] shadow-lg">
                    <div class="last-sale text-slate-400 text-xs font-semibold">Última venta procesada: $${totalVentaAnterior.toFixed(2)}</div>
                    <div class="current-total my-6">
                        <label class="block text-[11px] font-bold tracking-widest text-slate-400 uppercase">TOTAL A LIQUIDAR</label>
                        <span id="display-total" class="text-4xl font-black text-emerald-400 block mt-1">$0.00</span>
                    </div>
                    <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 px-4 rounded-xl tracking-wide text-center transition" onclick="registrarVenta()">
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
    const urlBase = obtenerUrlBaseAPI();
    
    try {
        const respuesta = await fetch(`${urlBase}/productos`);
        const data = await respuesta.json();

        if (tablaBody) {
            const rol = usuarioActual ? usuarioActual.rol.toLowerCase() : '';
            const puedeAgregar = (rol === 'admin' || rol === 'administrador' || rol === 'almacenista');

            if (btnContainer) {
                btnContainer.innerHTML = puedeAgregar ? `<button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition" onclick="abrirModalProducto()">+ Nuevo Producto</button>` : '';
            }

            tablaBody.innerHTML = data.map(p => `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="px-6 py-4"><span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-mono font-bold text-xs">${p.id_producto}</span></td>
                    <td class="px-6 py-4 font-semibold text-slate-800">${p.nombre}</td>
                    <td class="px-6 py-4 font-medium text-slate-600">$${parseFloat(p.precio).toFixed(2)}</td>
                    <td class="px-6 py-4"><span class="font-bold ${p.cant_exist <= 5 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded' : 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded'}">${p.cant_exist} pzas</span></td>
                    <td class="px-6 py-4"><span class="font-bold ${p.cant_exist <= 5 ? 'text-rose-600' : 'text-emerald-600'}">${p.cant_exist} pzas</span>
                    <button onclick="reabastecerProducto('${p.id_producto}')" 
                    class="ml-2 px-2 py-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-xs font-semibold">
                    Agregar Stock
                    </button>
                    </td>
                </tr>`).join('');
        }
    } catch (e) { 
        console.error("Error al cargar productos", e); 
        if (tablaBody) tablaBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error al conectar con el servidor.</td></tr>';
    }
}

async function filtrarProductos(termino) {
    const urlBase = obtenerUrlBaseAPI();
    try {
        const respuesta = await fetch(`${urlBase}/productos`);
        let data = await respuesta.json();

        if (termino) {
            data = data.filter(p => p.nombre.toLowerCase().includes(termino.toLowerCase()));
        }

        const body = document.getElementById('search-results-body');
        if (body) {
            if (data.length === 0) {
                body.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Sin coincidencias en catálogo</td></tr>';
                return;
            }
            body.innerHTML = data.map(p => `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="p-3 font-mono text-xs font-bold text-slate-500">${p.id_producto}</td>
                    <td class="p-3 font-semibold text-slate-800">${p.nombre}</td>
                    <td class="p-3 font-medium text-slate-600">$${parseFloat(p.precio).toFixed(2)}</td>
                    <td class="p-3 font-bold ${p.cant_exist <= 5 ? 'text-red-500' : 'text-emerald-600'}">${p.cant_exist}</td>
                    <td class="p-3"><button class="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition" onclick="añadirAlCarrito('${p.id_producto}', '${p.nombre}', ${p.precio}, ${p.cant_exist})">Añadir</button></td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error("Error al filtrar productos:", e); }
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
    const urlBase = obtenerUrlBaseAPI();

    if (!nombre || isNaN(precio) || isNaN(stock)) {
        return alert("Por favor, llena todos los campos correctamente.");
    }

    const idManual = "P-" + Math.floor(Math.random() * 999);

    try {
        const respuesta = await fetch(`${urlBase}/productos`, {
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
function añadirAlCarrito(id, nombre, precio, stockDisponible) {
    const index = carrito.findIndex(item => item.id === id);
    if (index !== -1) {
        if (carrito[index].cantidad >= stockDisponible) {
            alert(`No puedes agregar más unidades de "${nombre}". Stock máximo disponible: ${stockDisponible}`);
            return;
        }
        carrito[index].cantidad++;
    } else {
        if (stockDisponible <= 0) {
            alert(`"${nombre}" se encuentra totalmente agotado.`);
            return;
        }
        // Guardamos el stock maximo dentro del objeto del carrito para usarlo en los botones + y -
        carrito.push({ id, nombre, precio, cantidad: 1, stockMax: stockDisponible });
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
        // Validamos contra el stockMax guardado en el paso anterior
        if (delta > 0 && nuevoValor > carrito[idx].stockMax) {
            alert(`Límite alcanzado. Solo hay ${carrito[idx].stockMax} unidades disponibles en inventario.`);
            return;
        }
        carrito[idx].cantidad = nuevoValor;
        actualizarVistaTicket();
    }
}

function actualizarVistaTicket() {
    const body = document.getElementById('ticket-body');
    const displayTotal = document.getElementById('display-total');
    if (!body) return;

    if (carrito.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-400 font-medium">El ticket de cobro está vacío. Adiciona un artículo.</td></tr>';
        if (displayTotal) displayTotal.innerText = "$0.00";
        return;
    }

    let sumaTotal = 0;
    body.innerHTML = carrito.map((item, idx) => {
        const subtotal = item.precio * item.cantidad;
        sumaTotal += subtotal;
        return `
            <tr class="border-b border-slate-100">
                <td class="py-3 px-2 font-semibold text-slate-800">${item.nombre}</td>
                <td class="py-3 px-2">
                    <div class="flex items-center gap-2">
                        <button onclick="cambiarCantidad(${idx}, -1)" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 transition">-</button>
                        <span class="font-bold text-slate-800 text-sm w-4 text-center">${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${idx}, 1)" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 transition">+</button>
                    </div>
                </td>
                <td class="py-3 px-2 font-medium text-slate-500">$${parseFloat(item.precio).toFixed(2)}</td>
                <td class="py-3 px-2 font-bold text-slate-800">$${subtotal.toFixed(2)}</td>
                <td class="py-3 px-2 text-center"><button onclick="quitarDelCarrito(${idx})" class="text-rose-500 hover:text-rose-700 font-bold transition">✖</button></td>
            </tr>
        `;
    }).join('');

    if (displayTotal) {
        displayTotal.innerText = `$${sumaTotal.toFixed(2)}`;
    }
}

async function registrarVenta() {
    if (carrito.length === 0) return alert("El ticket está vacío.");
    const urlBase = obtenerUrlBaseAPI();

    try {
        const totalVenta = parseFloat(document.getElementById('display-total').innerText.replace('$', ''));
        
        // Mapeamos el carrito asegurando que viaje tanto "id" como "id_producto" de forma segura
        const detallesFormateados = carrito.map(item => ({
            id: item.id,
            id_producto: item.id,
            nombre: item.nombre,
            precio: parseFloat(item.precio),
            cantidad: parseInt(item.cantidad)
        }));

        const ventaData = {
            precio_total: totalVenta,
            curp_cliente: clienteSeleccionado,
            curp_trabajador: usuarioActual.curp,
            detalles: detallesFormateados
        };

        const respuesta = await fetch(`${urlBase}/ventas`, {
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

async function reabastecerProducto(id_producto) {
    const cantidad = prompt("¿Cuántas piezas vas a agregar al inventario?");
    if (!cantidad || isNaN(cantidad)) return;

    const urlBase = obtenerUrlBaseAPI();
    
    const respuesta = await fetch(`${urlBase}/productos/reabastecer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_producto, cantidad_a_sumar: cantidad })
    });

    if (respuesta.ok) {
        alert("Inventario actualizado.");
        irAProductos(); // Recarga la tabla para ver el nuevo stock
    } else {
        alert("Error al actualizar.");
    }
}

// ==========================================
// 7. HISTORIAL Y REPORTES FINANCIEROS
// ==========================================
async function irAReportes() {
    const tablaBody = document.getElementById('reportes-tabla-body');
    if (!tablaBody) return;
    const urlBase = obtenerUrlBaseAPI();
    
    try {
        const respuesta = await fetch(`${urlBase}/reportes`);
        const data = await respuesta.json();

        if (data.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 font-medium">No se registran transacciones en el historial.</td></tr>';
            return;
        }

        tablaBody.innerHTML = data.map(v => `
            <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                <td class="px-6 py-4 font-bold text-blue-600">#${v.id_venta}</td>
                <td class="px-6 py-4 text-slate-500">${new Date(v.fecha).toLocaleDateString()} ${new Date(v.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td class="px-6 py-4 font-extrabold text-emerald-600">$${parseFloat(v.precio_total).toFixed(2)}</td>
                <td class="px-6 py-4"><code class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">${v.curp_trabajador}</code></td>
            </tr>`).join('');
    } catch (e) { 
        console.error("Error al cargar reportes", e); 
        tablaBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error al consultar el historial de ventas.</td></tr>';
    }
}

// ==========================================
// 8. CONTROL DE CLIENTES (PUNTO DE VENTA Y PANEL)
// ==========================================
async function abrirModalCliente() {
    const urlBase = obtenerUrlBaseAPI();
    document.getElementById('modal-cliente').classList.remove('hidden');
    try {
        const respuesta = await fetch(`${urlBase}/clientes`);
        const clientes = await respuesta.json();
        renderizarListaClientesModal(clientes);
    } catch (e) { console.error("Error al traer clientes", e); }
}

function renderizarListaClientesModal(clientes) {
    const body = document.getElementById('lista-clientes-body');
    if (!body) return;
    
    if (!clientes || clientes.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">No hay clientes dados de alta</td></tr>';
        return;
    }

    body.innerHTML = clientes.map(c => {
        const nombreDisplay = c.persona ? `${c.persona.nombre} ${c.persona.apellidos}` : "Sin nombre";
        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="p-3 font-semibold text-slate-800">${nombreDisplay}</td>
                <td class="p-3 font-mono text-xs text-slate-500">${c.curp}</td> 
                <td class="p-3 text-right"><button class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition" onclick="fijarCliente('${c.curp}', '${c.persona?.nombre || 'Cliente'}')">Elegir</button></td>
            </tr>
        `;
    }).join('');
}

function fijarCliente(curp, nombre) {
    clienteSeleccionado = curp;
    const infoDisplay = document.getElementById('cliente-info-display');
    if (infoDisplay) infoDisplay.innerText = `Cliente: ${nombre} (${curp})`;
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
    const urlBase = obtenerUrlBaseAPI();
    try {
        const respuesta = await fetch(`${urlBase}/clientes`);
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
    const urlBase = obtenerUrlBaseAPI();

    try {
        const respuesta = await fetch(`${urlBase}/clientes`);
        clientesLocalesPanel = await respuesta.json();

        console.log("Datos de clientes recibidos de la BD:", clientesLocalesPanel);
        
        renderizarClientesEnPanel(clientesLocalesPanel);
    } catch (e) {
        console.error("Error cargando clientes del panel", e);
        tablaBody.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-red-500">Error al consultar el directorio de clientes.</td></tr>';
    }
}

function renderizarClientesEnPanel(lista) {
    const tablaBody = document.getElementById('clientes-tabla-body');
    if (!tablaBody) return;

    if (!lista || lista.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="3" style="padding:20px; text-align:center;" class="text-slate-400">No se encontraron clientes registrados</td></tr>';
        return;
    }
    tablaBody.innerHTML = lista.map(c => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="px-6 py-4 font-semibold text-slate-800">${c.persona ? c.persona.nombre + ' ' + c.persona.apellidos : 'Sin Nombre'}</td>
            <td class="px-6 py-4"><code class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">${c.curp}</code></td>
            <!-- NUEVO: Celda que renderiza la contraseña del cliente -->
            <td class="px-6 py-4 text-slate-500 font-mono text-sm">${c.password || c.contrasena || '—'}</td>
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
    
    document.getElementById('alta-password').required = true;
    
    if (tipo === 'trabajador') {
        camposTrabajador.classList.remove('hidden');
        document.getElementById('alta-rol').required = true;
        document.getElementById('alta-sueldo').required = true;
    } else {
        camposTrabajador.classList.add('hidden');
        document.getElementById('alta-rol').required = false;
        document.getElementById('alta-sueldo').required = false;
    }
}

async function guardarNuevoUsuario(event) {
    event.preventDefault();
    const urlBase = obtenerUrlBaseAPI();

    const tipo = document.getElementById('alta-tipo').value;
    const curp = document.getElementById('alta-curp').value.trim().toUpperCase();
    const nombre = document.getElementById('alta-nombre').value.trim();
    const apellidos = document.getElementById('alta-apellidos').value.trim();
    const password = document.getElementById('alta-password').value; 

    if (curp.length !== 18) {
        return alert("La CURP debe tener exactamente 18 caracteres.");
    }

    const payload = {
        tipo: tipo,
        curp: curp,
        nombre: nombre,
        apellidos: apellidos,
        password: password 
    };

    if (tipo === 'trabajador') {
        payload.rol = document.getElementById('alta-rol').value;
        payload.sueldo = parseFloat(document.getElementById('alta-sueldo').value);
    }

    try {
        const respuesta = await fetch(`${urlBase}/usuarios/registro`, {
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


//=======No compras si no ha iniciado sesion=====//
function verificarSesionPublica() {
    const sesion = localStorage.getItem('usuario');
    const loginLink = document.getElementById('nav-login-text');
    const userDisplay = document.getElementById('nav-user-curp');
    const btnSalir = document.getElementById('btn-cerrar-sesion-publico');
    const checkoutBtn = document.getElementById('checkout-button');

    if (sesion) {
        const usuario = JSON.parse(sesion);
        
        if (loginLink) loginLink.classList.add('hidden');
        if (userDisplay) {
            userDisplay.innerText = `👤 ${usuario.curp}`;
            userDisplay.classList.remove('hidden');
        }
        if (btnSalir) btnSalir.classList.remove('hidden');
    }

    if (checkoutBtn) {
        checkoutBtn.onclick = function() {
            const sesionActiva = localStorage.getItem('usuario');
            if (!sesionActiva) {
                alert("🚫 Acción denegada: Debes iniciar sesión con tu CURP para poder finalizar una compra.");
                window.location.href = "login.html";
            } else {
                registrarVentaPublica(); 
            }
        };
    }
}


async function registrarVentaPublica() {
    if (carrito.length === 0) return alert("El carrito está vacío.");
    const urlBase = obtenerUrlBaseAPI();
    const sesion = localStorage.getItem('usuario');
    if (!sesion) return;
    
    const usuarioCliente = JSON.parse(sesion);

    try {
        const totalTexto = document.getElementById('cart-total').innerText;
        const totalVenta = parseFloat(totalTexto.replace('$', '').replace('Total: ', '').trim());
        
        const detallesFormateados = carrito.map(item => ({
            id: item.id,
            id_producto: item.id,
            nombre: item.nombre,
            precio: parseFloat(item.precio),
            cantidad: parseInt(item.cantidad)
        }));

        const ventaData = {
            precio_total: totalVenta,
            curp_cliente: usuarioCliente.curp, 
            curp_trabajador: null,             
            detalles: detallesFormateados
        };

        const respuesta = await fetch(`${urlBase}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // NUEVO: En lugar de alert, inyecta el folio y abre tu modal personalizado del HTML
            const modalFolio = document.getElementById('modal-folio');
            const modalExito = document.getElementById('modal-compra-exitosa');
            
            if (modalFolio) modalFolio.textContent = `Folio: ${resultado.id_venta || "OK"}`;
            if (modalExito) modalExito.style.display = 'flex';
        
            // Limpiamos los datos globales
            carrito = [];
            actualizarVistaTicket(); // Llama a la renderización para vaciar la barra lateral
            irAProductos();         // Refresca el stock real en la tabla de productos
            
        } else {
            throw new Error(resultado.error);
        }
    } catch (err) {
        alert("No se pudo procesar la compra: " + err.message);
    }
}


// ==========================================
// 10. EASTER EGG - SANS (MORTADELA)
// ==========================================

// 1. Declaramos el archivo de audio de Qumu de forma global en el script
const musicaSans = new Audio('megalovania.mp3');
musicaSans.loop = true;

// 2. Escuchamos cuando el HTML termine de cargar los elementos de la página
document.addEventListener('DOMContentLoaded', () => {
    const buscadorPublico = document.getElementById('public-search');
    const easterEggBtn = document.getElementById('easter-egg-trigger');
    const modalSans = document.getElementById('easter-egg-modal');
    const btnCerrarSans = document.getElementById('close-easter-egg');

    // Control en tiempo real de lo que se escribe en el buscador
    if (buscadorPublico) {
        buscadorPublico.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();
            
            // Si el texto es exactamente "mortadela", activamos la sorpresa
            if (texto === 'mortadela') {
                if (easterEggBtn) easterEggBtn.classList.remove('hidden');
                if (modalSans) modalSans.classList.remove('hidden');
                
                // Intentamos reproducir la música de Qumu
                musicaSans.play().catch(error => {
                    console.log("El navegador bloqueó el autoplay hasta que interactúes:", error);
                });
            } else {
                // SI EL TEXTO CAMBIA O SE BORRA: Desaparece el botón, el modal y se apaga la música
                if (easterEggBtn) easterEggBtn.classList.add('hidden');
                if (modalSans) modalSans.classList.add('hidden');
                
                musicaSans.pause();
                musicaSans.currentTime = 0; // Reinicia la canción al segundo cero
            }
        });
    }

    // Funcionalidad para el botón "Cerrar" del propio modal de Sans
    if (btnCerrarSans) {
        btnCerrarSans.addEventListener('click', () => {
            // Ocultamos el modal visualmente
            if (modalSans) modalSans.classList.add('hidden');
            
            // Apagamos y reiniciamos la música al dar clic en cerrar
            musicaSans.pause();
            musicaSans.currentTime = 0;
        });
    }
});
