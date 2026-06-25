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
let productosGlobal = []; // <--- Agrega esto en la parte superior

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

        // 1. Guardamos el estado y la sesión una sola vez
        usuarioActual = data;
        if (errorMsg) errorMsg.classList.add('hidden');
        localStorage.setItem('usuario', JSON.stringify(data));
        
        alert(`¡Bienvenido! Has ingresado como: ${data.rol}`);
        
        // 2. REDIRECCIÓN INTELIGENTE (Usa la instrucción que viene del servidor)
        if (data.redirect) {
            window.location.href = data.redirect;
        } else {
            // Fallback por si acaso el servidor no envía el redirect
            window.location.href = data.tipo === 'cliente' ? "cliente-publico.html" : "panel.html";
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

    // --- CONTROL DE ACCESO Y PESTAÑA INICIAL ---
    
    // 1. Caso Administrador
    if (rol === 'administrador' || rol === 'admin') {
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    } 
    // 2. Caso Cajero
    else if (rol === 'cajero') {
        ocultarElemento('nav-productos');
        ocultarElemento('nav-clientes');
        ocultarElemento('nav-text-registro'); 
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    } 
    // 3. Caso Almacenista
    else if (rol === 'almacenista') {
        ocultarElemento('nav-ventas');
        ocultarElemento('nav-clientes');
        ocultarElemento('nav-reportes');
        ocultarElemento('nav-text-registro'); 
        switchTab('section-productos', document.getElementById('nav-productos'));
    }
    // 4. NUEVO: Caso Visitante
    else if (rol === 'visitante') {
        // Ocultamos las pestañas que no queremos que vea
        ocultarElemento('nav-text-registro'); 
        switchTab('section-ventas', document.getElementById('nav-ventas'));
    }
}

function ocultarElemento(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function switchTab(tabId, botonActivado) {
    const rolActual = usuarioActual && usuarioActual.rol ? usuarioActual.rol.toLowerCase().trim() : '';

    // PROTECCIÓN DE SEGURIDAD EN NAVEGACIÓN SEGÚN EL ROL DE LA BD
    if (tabId === 'section-reportes' && rolActual !== 'admin' && rolActual !== 'administrador' && rolActual !== 'visitante') {
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
    const tablaBody = document.getElementById('inventario-tabla-body'); // Panel Admin
    const productGrid = document.getElementById('product-grid');        // Tienda Pública
    const btnContainer = document.getElementById('btn-nuevo-producto-container');
    const urlBase = obtenerUrlBaseAPI();
    
    try {
        const respuesta = await fetch(`${urlBase}/productos`);
        const data = await respuesta.json();

        // 1. SI ESTÁ EN EL PANEL DE ADMINISTRACIÓN
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
                    <td class="px-6 py-4">
                        <button onclick="reabastecerProducto('${p.id_producto}')" 
                        class="ml-2 px-2 py-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-xs font-semibold">
                        Agregar Stock
                        </button>
                    </td>
                </tr>`).join('');
        }

        // 2. SI ESTÁ EN LA TIENDA PÚBLICA
        if (productGrid) {
            if (!data || data.length === 0) {
                productGrid.innerHTML = '<p class="text-slate-400 text-center col-span-full">No hay productos disponibles por el momento.</p>';
                return;
            }

            productGrid.innerHTML = data.map(p => {
                const sinStock = p.cant_exist <= 0;
                // Escapamos el nombre para el onclick
                const nombreSeguro = p.nombre.replace(/'/g, "\\'");
                
                return `
                <div class="product-card ${sinStock ? 'opacity-60' : ''}" style="background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-direction: column; display: flex; justify-content: space-between;">
                    <div>
                        <span style="font-size: 0.75rem; color: #94a3b8; font-family: monospace; font-weight: bold;">${p.id_producto}</span>
                        <h3 style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #1e293b;">${p.nombre}</h3>
                        <p style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 8px 0;">$${parseFloat(p.precio).toFixed(2)}</p>
                    </div>
                    <div style="margin-top: 12px;">
                        <p style="font-size: 0.8rem; margin-bottom: 8px; font-weight: 600; color: ${sinStock ? '#ef4444' : '#16a34a'}">
                            ${sinStock ? '❌ Agotado' : `📦 Stock: ${p.cant_exist} pzas`}
                        </p>
                        <button onclick="añadirAlCarritoPublico('${p.id_producto}', '${nombreSeguro}', ${p.precio}, ${p.cant_exist})"
                            ${sinStock ? 'disabled' : ''}
                            class="btn-confirm" 
                            style="width: 100%; padding: 10px; font-size: 0.85rem; cursor: ${sinStock ? 'not-allowed' : 'pointer'}; background: ${sinStock ? '#cbd5e1' : ''}; color: ${sinStock ? '#64748b' : ''}; border: none; border-radius: 8px; font-weight: bold;">
                            ${sinStock ? 'Sin existencias' : '🛒 Añadir al carrito'}
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

    } catch (e) { 
        console.error("Error al cargar productos", e); 
        if (tablaBody) tablaBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error al conectar con el servidor.</td></tr>';
        if (productGrid) productGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Error al cargar el catálogo de productos.</p>';
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
    // 1. Usamos id_producto, que es el campo real de tu BD
    const index = carrito.findIndex(item => item.id_producto === id);
    
    if (index !== -1) {
        // Validamos stock si existe la variable
        if (stockDisponible !== undefined && carrito[index].cantidad >= stockDisponible) {
            alert("No hay suficiente stock.");
            return;
        }
        carrito[index].cantidad++;
    } else {
        // 2. IMPORTANTE: Guardamos el ID correcto aquí
        carrito.push({ 
            id_producto: id, 
            nombre: nombre, 
            precio: parseFloat(precio), 
            cantidad: 1, 
            stockMax: stockDisponible 
        });
    }

    // 3. Ejecución segura de interfaces
    // Si estamos en el Admin (Caja), intentamos actualizar el ticket
    if (typeof cerrarBuscador === "function") {
        cerrarBuscador();
    }
    
    if (typeof actualizarVistaTicket === "function") {
        actualizarVistaTicket();
    } 
    
    // Si estamos en Público, actualizamos la interfaz de tienda
    if (typeof actualizarInterfazCarritoPublico === "function") {
        actualizarInterfazCarritoPublico();
    }
}

function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    if (typeof actualizarTablaTicket === "function") {
        actualizarTablaTicket();
    }
}

function cambiarCantidad(idx, delta) {
    if (!carrito[idx]) return;
    const nuevoValor = carrito[idx].cantidad + delta;
    if (nuevoValor <= 0) {
        quitarDelCarrito(idx);
    } else {
        carrito[idx].cantidad = nuevoValor;
        if (typeof actualizarTablaTicket === "function") {
            actualizarTablaTicket();
        }
    }
}

function limpiarCarritoCliente() {
    carrito = [];
    if (typeof actualizarTablaTicket === "function") {
        actualizarTablaTicket();
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
        const totalVenta = parseFloat(document.getElementById('display-total').innerText.replace('$', '').replace(',', ''));
        
        // Mapeo corregido: el backend espera id_producto para los detalles
        const detallesFormateados = carrito.map(item => ({
            id_producto: item.id_producto, // Aseguramos que sea este ID
            nombre: item.nombre,
            precio: parseFloat(item.precio),
            cantidad: parseInt(item.cantidad)
        }));

        const ventaData = {
            precio_total: totalVenta,
            curp_cliente: clienteSeleccionado,
            curp_trabajador: usuarioActual ? usuarioActual.curp : 'ADMIN',
            detalles: detallesFormateados,
            rol_usuario: usuarioActual.rol

        };

        const respuesta = await fetch(`${urlBase}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert("✅ Venta registrada: " + (resultado.id_venta || ""));
            carrito = []; 
            actualizarVistaTicket();
        } else {
            // El backend responde con el error específico aquí
            throw new Error(resultado.error || "Error al registrar la venta");
        }
    } catch (err) {
        console.error("Error completo:", err);
        alert("No se pudo registrar: " + err.message);
    }
}

async function reabastecerProducto(id_producto) {
    const cantidad = prompt("¿Cuántas piezas vas a agregar al inventario?");
    if (!cantidad || isNaN(cantidad)) return;

    // Obtenemos el usuario del localStorage (donde guardaste el rol al loguear)
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    const urlBase = obtenerUrlBaseAPI();
    
    const respuesta = await fetch(`${urlBase}/productos/reabastecer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            id_producto, 
            cantidad_a_sumar: cantidad,
            rol_usuario: usuario ? usuario.rol : null // 👈 ENVIAMOS EL ROL
        })
    });

    const resultado = await respuesta.json();

    if (respuesta.ok) {
        alert("Inventario actualizado.");
        irAProductos();
    } else {
        // Mostramos el error real que viene del servidor (403 Acceso denegado)
        alert(resultado.error || "Error al actualizar.");
    }
}

// ==========================================
// 7. HISTORIAL Y REPORTES FINANCIEROS
// ==========================================
async function irAReportes() {
    const tablaBody = document.getElementById('reportes-tabla-body');
    if (!tablaBody) return;
    
    // Obtenemos el rol del usuario que ya tienes en el estado
    const rolUsuario = usuarioActual ? usuarioActual.rol : '';
    const urlBase = obtenerUrlBaseAPI();
    
    try {
        // Pasamos el rol en la URL: /api/reportes?rol=Admin
        const respuesta = await fetch(`${urlBase}/reportes?rol=${rolUsuario}`);
        
        if (!respuesta.ok) {
            if (respuesta.status === 403) throw new Error("No tienes autorización para ver reportes.");
            throw new Error("Error al consultar el historial.");
        }

        const data = await respuesta.json();

        if (data.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 font-medium">No hay ventas registradas.</td></tr>';
            return;
        }

        tablaBody.innerHTML = data.map(v => `
            <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                <td class="px-6 py-4 font-bold text-blue-600">#${v.id_venta}</td>
                <td class="px-6 py-4 text-slate-500">${new Date(v.fecha).toLocaleDateString()}</td>
                <td class="px-6 py-4 font-extrabold text-emerald-600">$${parseFloat(v.precio_total).toFixed(2)}</td>
                <td class="px-6 py-4"><code class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">${v.curp_trabajador}</code></td>
            </tr>`).join('');
    } catch (e) { 
        console.error("Error al cargar reportes", e); 
        tablaBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">${e.message}</td></tr>`;
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
    const correo = document.getElementById('alta-correo').value.trim(); // 👈 Capturamos el correo nuevo

    if (curp.length !== 18) {
        return alert("La CURP debe tener exactamente 18 caracteres.");
    }

    // Incorporamos el correo al objeto de datos
    const payload = {
        tipo: tipo,
        curp: curp,
        nombre: nombre,
        apellidos: apellidos,
        password: password,
        correo: correo 
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
    // 🔥 CANDADO DE SOLO LECTURA CLIENTE ONLINE
    const sesion = localStorage.getItem('usuario');
    if (sesion) {
        const usuarioCliente = JSON.parse(sesion);
        if (usuarioCliente.curp === 'CHOC000101HDFRRR99') {
            alert("🚫 Modo Demostración: Este usuario administrador chocolate solo tiene permisos de LECTURA. No puede realizar compras.");
            return;
        }
    }

    if (carrito.length === 0) return alert("El carrito está vacío.");
    const urlBase = obtenerUrlBaseAPI();
    if (!sesion) return;
    
    const usuarioCliente = JSON.parse(sesion);

    try {
        const detallesFormateados = carrito.map(item => ({
            id: item.id_producto,          
            id_producto: item.id_producto, 
            nombre: item.nombre,
            precio: parseFloat(item.precio),
            cantidad: parseInt(item.cantidad)
        }));

        const totalTexto = document.getElementById('cart-total').innerText;
        const totalVenta = parseFloat(totalTexto.replace('$', '').replace('Total: ', '').trim());

        const ventaData = {
            precio_total: totalVenta,
            curp_cliente: usuarioCliente.curp, 
            curp_trabajador: null,             
            detalles: detallesFormateados,
            rol_usuario: usuarioCliente.rol
        };

        const respuesta = await fetch(`${urlBase}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert("🛒 ¡Compra en línea registrada con éxito! Folio: " + (resultado.id_venta || "OK"));
            
            // Vaciamos el carrito en memoria y en pantalla
            carrito = [];
            const cartItemsContainer = document.getElementById('cart-items');
            if (cartItemsContainer) cartItemsContainer.innerHTML = "Tu carrito está vacío";
            
            const cartTotalContainer = document.getElementById('cart-total');
            if (cartTotalContainer) cartTotalContainer.innerText = "$0.00";

            // Refrescamos el stock
            irAProductos();
            
            // 🔥 LA SOLUCIÓN MÁGICA: Esperamos 2 segundos y recargamos el historial
            setTimeout(async () => {
                await cargarHistorialComprasPublico();
                
                // Le damos clic automático a la tarjeta más nueva para que pinte el detalle derecho
                const listaCards = document.getElementById('compras-cliente-lista-cards');
                if (listaCards) {
                    const primerBoton = listaCards.querySelector('button');
                    if (primerBoton) {
                        primerBoton.click();
                    }
                }
            }, 2000); // 2 segundos para que Supabase en Render termine de guardar
            
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

const musicaSans = new Audio('musicaeaster/toby fox - UNDERTALE Soundtrack - 72 Song That Might Play When You Fight Sans.mp3');
musicaSans.loop = true;

document.addEventListener('DOMContentLoaded', () => {
    const buscadorPublico = document.getElementById('public-search');
    const easterEggBtn = document.getElementById('easter-egg-trigger');
    const modalSans = document.getElementById('easter-egg-modal');
    const btnCerrarSans = document.getElementById('close-easter-egg');

    if (buscadorPublico) {
        buscadorPublico.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();
            
            if (texto === 'mortadela') {
                if (easterEggBtn) easterEggBtn.classList.remove('hidden');
            } else {
                if (easterEggBtn) easterEggBtn.classList.add('hidden');
                if (modalSans) modalSans.classList.add('hidden');
                musicaSans.pause();
                musicaSans.currentTime = 0;
            }
        });
    }

    // AL DAR CLIC EN EL HUESO 🦴
    if (easterEggBtn) {
        easterEggBtn.addEventListener('click', () => {
            if (modalSans) {
                modalSans.classList.remove('hidden'); // Remueve el hidden y el CSS lo posiciona fixed al centro
            }
            musicaSans.play().catch(error => console.log("Audio bloqueado:", error));
        });
    }

    // AL CERRAR EL MODAL
    if (btnCerrarSans) {
        btnCerrarSans.addEventListener('click', () => {
            if (modalSans) {
                modalSans.classList.add('hidden'); // Lo vuelve a ocultar por completo
            }
            musicaSans.pause();
            musicaSans.currentTime = 0;
        });
    }
});



// =======================================================
// 6. LÓGICA DE PUNTO DE VENTA Y CARRITO (VERSION RESTAURADA)
// =======================================================

function añadirAlCarrito(id, nombre, precio, stockDisponible) {
    // 1. Validar existencia antes de tocar el carrito
    const stockMax = parseInt(stockDisponible);
    if (stockMax <= 0) {
        alert("❌ Este producto no tiene existencias.");
        return;
    }

    const index = carrito.findIndex(item => item.id_producto === id);
    
    // 2. Validar si al agregar una unidad más superamos el stock
    if (index !== -1) {
        if (carrito[index].cantidad + 1 > stockMax) {
            alert("⚠️ No puedes exceder el stock disponible.");
            return;
        }
        carrito[index].cantidad++;
    } else {
        // 3. Agregar nuevo producto
        carrito.push({ 
            id_producto: id, 
            nombre: nombre, 
            precio: parseFloat(precio), 
            cantidad: 1, 
            stockMax: stockMax 
        });
    }

    // Cerrar modales y refrescar
    const modal = document.getElementById('modal-busqueda');
    if (modal) modal.classList.add('hidden');
    actualizarVistaTicket();
}

function actualizarVistaTicket() {
    const body = document.getElementById('ticket-body');
    const displayTotal = document.getElementById('display-total');
    
    // Si no existe el cuerpo de la tabla en esta vista, no lanzamos error, solo salimos
    if (!body) return;

    if (carrito.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-400 font-medium">🛒 El ticket está vacío.</td></tr>';
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
                        <button onclick="cambiarCantidad(${idx}, -1)" class="bg-slate-100 hover:bg-slate-200 w-6 h-6 rounded font-bold">-</button>
                        <span class="w-4 text-center font-bold">${item.cantidad}</span>
                        <button onclick="cambiarCantidad(${idx}, 1)" class="bg-slate-100 hover:bg-slate-200 w-6 h-6 rounded font-bold">+</button>
                    </div>
                </td>
                <td class="py-3 px-2 text-slate-500">$${parseFloat(item.precio).toFixed(2)}</td>
                <td class="py-3 px-2 font-bold text-slate-800">$${subtotal.toFixed(2)}</td>
                <td class="py-3 px-2 text-center">
                    <button onclick="quitarDelCarrito(${idx})" class="text-rose-500 hover:text-rose-700 font-bold">✖</button>
                </td>
            </tr>
        `;
    }).join('');

    if (displayTotal) displayTotal.innerText = `$${sumaTotal.toFixed(2)}`;
}

function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarVistaTicket();
}

function cambiarCantidad(idx, delta) {
    if (!carrito[idx]) return;
    const nuevoValor = carrito[idx].cantidad + delta;
    if (nuevoValor <= 0) {
        quitarDelCarrito(idx);
    } else {
        carrito[idx].cantidad = nuevoValor;
        actualizarVistaTicket();
    }
}

// 2. Función para redibujar la barra lateral del carrito
function actualizarInterfazCarritoPublico() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalContainer = document.getElementById('cart-total');

    if (!cartItemsContainer) return; // Protección si no estamos en la vista cliente

    if (carrito.length === 0) {
        cartItemsContainer.innerHTML = 'Tu carrito está vacío';
        if (cartTotalContainer) cartTotalContainer.textContent = '$0.00';
        return;
    }

    let totalAcumulado = 0;

    cartItemsContainer.innerHTML = carrito.map((item, index) => {
        const subtotal = item.precio * item.cantidad;
        totalAcumulado += subtotal;

        return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-b: 1px solid #f1f5f9; font-size: 0.9rem;">
            <div style="flex: 1; padding-right: 8px;">
                <p style="font-weight: 600; margin: 0; color: #1e293b;">${item.nombre}</p>
                <p style="font-size: 0.75rem; color: #64748b; margin: 2px 0;">$${item.precio.toFixed(2)} c/u</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: bold; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; color: #334155;">x${item.cantidad}</span>
                <span style="font-weight: 700; color: #0f172a; min-width: 60px; text-align: right;">$${subtotal.toFixed(2)}</span>
                <button onclick="eliminarDelCarritoPublico(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 4px;">✕</button>
            </div>
        </div>`;
    }).join('');

    if (cartTotalContainer) {
        cartTotalContainer.textContent = `$${totalAcumulado.toFixed(2)}`;
    }
}

// 3. Quitar unidades o eliminar un producto del carrito
function eliminarDelCarritoPublico(index) {
    if (carrito[index].cantidad > 1) {
        carrito[index].cantidad--;
    } else {
        carrito.splice(index, 1);
    }
    actualizarInterfazCarritoPublico();
}

// 4. Limpiar el carrito completo al finalizar compra
function limpiarCarritoCliente() {
    carrito = [];
    actualizarInterfazCarritoPublico();
}

// =======================================================
// FUNCIONES EXCLUSIVAS PARA INTERFAZ PÚBLICA (NO TOCAR EL PANEL)
// =======================================================

// 1. Agregar producto desde el catálogo público (usa la lógica base, pero refresca el carrito público)
function añadirAlCarritoPublico(id, nombre, precio, stock) {
    // Reutilizamos la lógica de validación que ya existe
    añadirAlCarrito(id, nombre, precio, stock); 
    // Refrescamos solo la interfaz pública
    actualizarInterfazCarritoPublico();
}

// 2. Pintar el carrito en la barra lateral del cliente
function actualizarInterfazCarritoPublico() {
    const contenedor = document.getElementById('cart-items');
    const displayTotal = document.getElementById('cart-total');
    
    if (!contenedor) return;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p style="color: #94a3b8; text-align: center; margin-top: 20px;">Tu carrito está vacío</p>';
        if (displayTotal) displayTotal.innerText = "$0.00";
        return;
    }

    let total = 0;
    contenedor.innerHTML = carrito.map((item, index) => {
        total += (item.precio * item.cantidad);
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; padding: 12px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b;">${item.nombre}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">$${item.precio} c/u</div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 4px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <button onclick="cambiarCantidadCarritoPublico(${index}, -1)" style="border: none; background: white; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; box-shadow: 0 1px 1px rgba(0,0,0,0.1);">-</button>
                    
                    <span style="font-weight: 800; font-size: 0.9rem; min-width: 24px; text-align: center; color: #0f172a;">
                        ${item.cantidad}
                    </span>
                    
                    <button onclick="cambiarCantidadCarritoPublico(${index}, 1)" style="border: none; background: white; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; box-shadow: 0 1px 1px rgba(0,0,0,0.1);">+</button>
                </div>
                
                <button onclick="quitarProductoPublico(${index})" style="margin-left: 10px; color: #ef4444; cursor: pointer; border:none; background:none; font-size: 0.8rem;">✖</button>
            </div>
        `;
    }).join('');

    if (displayTotal) displayTotal.innerText = `$${total.toFixed(2)}`;
}

function cambiarCantidadCarritoPublico(index, delta) {
    const item = carrito[index];
    if (!item) return;

    const nuevaCantidad = item.cantidad + delta;

    // Si llega a 0, eliminamos el ítem
    if (nuevaCantidad <= 0) {
        carrito.splice(index, 1);
    } else {
        // Validamos contra el stockMax (si es que lo guardaste al añadir al carrito)
        // Si no tienes 'stockMax' guardado, simplemente actualiza
        if (item.stockMax && nuevaCantidad > item.stockMax) {
            alert("No hay más existencias disponibles.");
            return;
        }
        carrito[index].cantidad = nuevaCantidad;
    }
    
    // Refrescamos SOLO la interfaz pública
    actualizarInterfazCarritoPublico();
}
// 3. Eliminar producto solo de la vista pública
function quitarProductoPublico(index) {
    carrito.splice(index, 1);
    actualizarInterfazCarritoPublico();
}

// 4. Finalizar compra desde el cliente (Envío al servidor)
async function procesarCompraPublica() {
    if (carrito.length === 0) return alert("El carrito está vacío.");
    
    const urlBase = obtenerUrlBaseAPI();
    const curpCliente = document.getElementById('nav-user-curp')?.innerText || "INVITADO";
    const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    const datosVenta = {
        precio_total: total,
        curp_cliente: curpCliente,
        curp_trabajador: 'VENTA_WEB',
        detalles: carrito.map(item => ({
            id_producto: item.id_producto,
            nombre: item.nombre,
            precio: parseFloat(item.precio),
            cantidad: parseInt(item.cantidad)
        }))
    };

    try {
        const res = await fetch(`${urlBase}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosVenta)
        });

        if (res.ok) {
            // Guardamos la respuesta por si la necesitamos
            const resultado = await res.json();
            
            alert("¡Compra exitosa!");

            // 1. Limpiamos el carrito local e interfaz inmediatamente
            carrito = [];
            actualizarInterfazCarritoPublico();

            // 2. Pintamos el panel derecho EN CALIENTE con un mensaje temporal 
            // para que el usuario sepa que se está procesando en la base de datos
            const bodyDetalle = document.getElementById('panel-detalle-productos-body');
            const totalGrisDisplay = document.getElementById('panel-detalle-total');
            
            if (bodyDetalle) {
                bodyDetalle.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 20px; color: #64748b;">
                            🔄 Actualizando tu historial con Supabase...
                        </td>
                    </tr>
                `;
            }
            if (totalGrisDisplay) totalGrisDisplay.innerHTML = "$0.00";

            // 🔥 3. LA CLAVE: Esperamos 3.5 segundos completos y re-ejecutamos la sincronización inicial
            setTimeout(async () => {
                console.log("📡 Re-ejecutando peticiones de actualización...");
                
                // Forzamos a la variable global a actualizarse con el localStorage real
                if (typeof verificarSesionPublica === 'function') {
                    verificarSesionPublica(); 
                }
                
                // Ejecutamos la función exacta que pinta al iniciar la página
                await cargarHistorialComprasPublico();

                // Damos un clic automático a la tarjeta más nueva si es que ya apareció
                const listaCards = document.getElementById('compras-cliente-lista-cards');
                if (listaCards) {
                    const primerBoton = listaCards.querySelector('button');
                    if (primerBoton) {
                        primerBoton.click();
                    }
                }

                // Refrescamos los productos del catálogo por si cambió el stock
                if (typeof irAProductos === 'function') irAProductos();

            }, 3500); // 3.5 segundos es el tiempo promedio que tarda Render free tier en procesar e indexar en Supabase

        } else {
            const err = await res.json();
            alert("Error: " + (err.error || "No se pudo registrar la venta"));
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
    }
}

// Función principal que el cliente llamará al cargar la página
async function cargarHistorialComprasPublico() {
    const listaCards = document.getElementById('compras-cliente-lista-cards');
    if (!listaCards) return; 

    // Obtención segura de CURP
    const curpElement = document.getElementById('nav-user-curp');
    let rawCurp = (usuarioActual && usuarioActual.curp) ? usuarioActual.curp : (curpElement ? curpElement.innerText : "");
    let rawCurpLimpio = rawCurp.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!rawCurpLimpio || rawCurpLimpio === "INVITADO") {
        listaCards.innerHTML = '<p>Inicia sesión para ver tus compras.</p>';
        return;
    }

    try {
        const urlBase = obtenerUrlBaseAPI();
        
        // 🔥 AGREGA ESTO: Rompe la caché agregando el timestamp al final de la URL
        const res = await fetch(`${urlBase}/clientes/${encodeURIComponent(rawCurpLimpio)}/compras?_=${Date.now()}`);
        
        if (!res.ok) throw new Error("Error al obtener ventas");
        
        const ventas = await res.json();

        if (!ventas || ventas.length === 0) {
            listaCards.innerHTML = '<p>No tienes compras registradas.</p>';
            return;
        }

        listaCards.innerHTML = ventas.map(v => {
            const totalNumero = Number(v.precio_total);
            return `
                <button onclick="verDetalleCompraPublica('${encodeURIComponent(v.id_venta)}')" 
                    style="width: 100%; text-align: left; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 8px; cursor: pointer;">
                    <div style="font-weight: 800;">Folio: ${v.id_venta}</div>
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: bold;">$${totalNumero.toFixed(2)}</div>
                </button>
            `;
        }).join('');

    } catch (e) {
        console.error("Error al cargar:", e);
        listaCards.innerHTML = '<p style="color:red;">Error al cargar historial.</p>';
    }
}

// Función para ver el detalle de una compra específica
async function verDetalleCompraPublica(idVentaCodificado) {
    const bodyDetalle = document.getElementById('panel-detalle-productos-body');
    // 🔥 1. CAPTURAMOS EL SPAN DEL TOTAL GRANDE
    const totalGrisDisplay = document.getElementById('panel-detalle-total');

    try {
        const urlBase = obtenerUrlBaseAPI();
        const res = await fetch(`${urlBase}/ventas/${idVentaCodificado}/detalles`);
        if (!res.ok) throw new Error("Error en el servidor");
        
        const detalles = await res.json();
        
        // 🔥 2. VARIABLE PARA IR SUMANDO TODOS LOS PRODUCTOS
        let sumaTotalAcumulada = 0;
        
        bodyDetalle.innerHTML = detalles.map(d => {
            // Buscamos el producto en la lista que ya cargamos al inicio
            const prod = productosGlobal.find(p => p.id_producto === d.id_producto);
            const nombreMostrar = prod ? prod.nombre : d.id_producto;
            
            // 🔥 3. CALCULO SEGURO EN CALIENTE POR SI SUPABASE NO TRAE EL SUBTOTAL YA MULTIPLICADO
            const precioUnitario = prod ? parseFloat(prod.precio || 0) : parseFloat(d.precio_unitario || d.precio || 0);
            const cantidad = parseInt(d.cantidad || 0);
            const subtotalReal = d.subtotal ? parseFloat(d.subtotal) : (precioUnitario * cantidad);
            
            // 🔥 4. SUMAMOS AL TOTAL GENERAL DE ESTA COMPRA
            sumaTotalAcumulada += subtotalReal;
            
            return `
                <tr>
                    <td style="padding: 6px 8px;">${nombreMostrar}</td>
                    <td style="padding: 6px 8px; text-align: center;">${cantidad}</td>
                    <td style="padding: 6px 8px; text-align: right;">$${subtotalReal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
        
        // 🔥 5. ACTUALIZAMOS EL SPAN CON EL TOTAL REAL QUE CALCULAMOS
        if (totalGrisDisplay) {
            totalGrisDisplay.innerHTML = `$${sumaTotalAcumulada.toFixed(2)}`;
        }
        
    } catch (e) {
        console.error(e);
        alert("No se pudo cargar el detalle.");
    }
}

// Agrega esta función si no la tienes o úsala para cargar los datos
async function cargarProductosGlobal() {
    try {
        const urlBase = obtenerUrlBaseAPI();
        const res = await fetch(`${urlBase}/productos`);
        productosGlobal = await res.json();
    } catch (e) {
        console.error("Error al cargar catálogo global:", e);
    }
}

// =======================================================
// LÓGICA DE INICIALIZACIÓN Y BUSCADOR
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    
    cargarProductosGlobal();

    // 2. INICIALIZACIÓN DE LA VISTA
    if (typeof verificarSesionPublica === 'function') verificarSesionPublica();
    if (typeof cargarHistorialComprasPublico === 'function') cargarHistorialComprasPublico();

    // 3. LÓGICA DEL BUSCADOR DE PRODUCTOS
    const publicSearchInput = document.getElementById('public-search');
    if (publicSearchInput) {
        publicSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const tarjetas = document.querySelectorAll('#product-grid > div');

            tarjetas.forEach(tarjeta => {
                const nombreProducto = tarjeta.querySelector('h3').textContent.toLowerCase();
                const idProducto = tarjeta.querySelector('span').textContent.toLowerCase();

                if (nombreProducto.includes(query) || idProducto.includes(query)) {
                    tarjeta.style.display = 'flex'; 
                } else {
                    tarjeta.style.display = 'none'; 
                }
            });
        });
    }
});
