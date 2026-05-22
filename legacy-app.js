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
let listaProductosGlobal = [];

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
    const tablaBody = document.getElementById('inventario-tabla-body'); // Panel Admin
    const productGrid = document.getElementById('product-grid');        // Tienda Pública
    const btnContainer = document.getElementById('btn-nuevo-producto-container');
    const urlBase = obtenerUrlBaseAPI();
    
    try {
        const respuesta = await fetch(`${urlBase}/productos`);
        const data = await respuesta.json();

        // RESPALDO GLOBAL: Almacenamos el catálogo completo en memoria
        listaProductosGlobal = data || [];

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
                        class="px-2 py-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-xs font-semibold">
                        Agregar Stock
                        </button>
                    </td>
                </tr>`).join('');
        }

        // 2. SI ESTÁ EN LA TIENDA PÚBLICA (Calcula descuento en tiempo real por el carrito)
        if (productGrid) {
            if (!data || data.length === 0) {
                productGrid.innerHTML = '<p class="text-slate-400 text-center col-span-full">No hay productos disponibles por el momento.</p>';
                return;
            }
            productGrid.innerHTML = data.map(p => {
                // Buscamos si el usuario ya tiene este producto en el carrito temporal
                const itemEnCarrito = carrito.find(item => item.id === p.id_producto);
                const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
                
                // Restamos dinámicamente lo que está agarrando temporalmente
                const stockDisponibleReal = p.cant_exist - cantidadEnCarrito;
                const sinStock = stockDisponibleReal <= 0;

                return `
                    <div class="product-card ${sinStock ? 'opacity-60' : ''}" style="background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-direction: column; display: flex; justify-content: space-between;">
                        <div>
                            <span style="font-size: 0.75rem; color: #94a3b8; font-family: monospace; font-weight: bold;">${p.id_producto}</span>
                            <h3 style="margin: 4px 0; font-size: 1.1rem; font-weight: 600; color: #1e293b;">${p.nombre}</h3>
                            <p style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 8px 0;">$${parseFloat(p.precio).toFixed(2)}</p>
                        </div>
                        <div style="margin-top: 12px;">
                            <p style="font-size: 0.8rem; margin-bottom: 8px; font-weight: 600; color: ${sinStock ? '#ef4444' : '#16a34a'}">
                                ${sinStock ? '❌ Agotado en Tienda' : `📦 Disponible: ${stockDisponibleReal} pzas`}
                            </p>
                            <button onclick="añadirAlCarrito('${p.id_producto}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio}, ${p.cant_exist})" ${sinStock ? 'disabled' : ''} class="btn-confirm" style="width: 100%; padding: 10px; font-size: 0.85rem; cursor: ${sinStock ? 'not-allowed' : 'pointer'}; background: ${sinStock ? '#cbd5e1' : ''}; color: ${sinStock ? '#64748b' : ''}; border: none; border-radius: 8px; font-weight: bold;">
                                ${sinStock ? 'Sin existencias' : '🛒 Añadir al carrito'}
                            </button>
                        </div>
                    </div>`;
            }).join('');
        }
    } catch (e) {
        console.error("Error al cargar productos", e);
        if (tablaBody) tablaBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Error al conectar con el servidor.</td></tr>';
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
        carrito.push({ id, nombre, precio, cantidad: 1, stockMax: stockDisponible });
    }

    if (typeof cerrarBuscador === "function") {
        cerrarBuscador();
    }
    
    // Forzamos actualización de la vista del carrito
    if (typeof actualizarVistaTicket === "function") {
        actualizarVistaTicket();
    } else if (typeof actualizarInterfazCarritoPublico === "function") {
        actualizarInterfazCarritoPublico();
    }

    // ACTUALIZACIÓN AL VUELO: Re-renderiza las tarjetas restando lo que está en el carrito
    irAProductos();
}

function actualizarInterfazCarritoPublico() {
    const contenedor = document.getElementById('cart-items');
    const totalContenedor = document.getElementById('cart-total');
    if (!contenedor) return;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px 0;">Tu carrito está vacío</p>';
        if (totalContenedor) totalContenedor.innerText = '$0.00';
        // Si el carrito se vacía, actualizamos tarjetas para restaurar stock original
        irAProductos();
        return;
    }

    let sumaTotal = 0;
    contenedor.innerHTML = carrito.map(item => {
        const subtotal = item.cantidad * item.precio;
        sumaTotal += subtotal;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
                <div style="flex: 1; padding-right: 10px;">
                    <h4 style="margin: 0; font-weight: 600; color: var(--text-main);">${item.nombre}</h4>
                    <small style="color: var(--accent); font-weight: 700;">$${item.precio.toFixed(2)} c/u</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button onclick="cambiarCantidadCarrito('${item.id}', -1)" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border); background: #f8fafc; cursor: pointer; font-weight: bold;">-</button>
                    <span style="font-weight: 700; min-width: 16px; text-align: center;">${item.cantidad}</span>
                    <button onclick="cambiarCantidadCarrito('${item.id}', 1)" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border); background: #f8fafc; cursor: pointer; font-weight: bold;">+</button>
                </div>
                <div style="min-width: 70px; text-align: right; font-weight: 700; color: var(--text-main);">
                    $${subtotal.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');

    if (totalContenedor) totalContenedor.innerText = `$${sumaTotal.toFixed(2)}`;

    // RE-RENDERIZADO AUTOMÁTICO: Sincroniza las tarjetas con los cambios de cantidades del carrito
    irAProductos();
}

function cambiarCantidadCarrito(id, cambio) {
    const index = carrito.findIndex(item => item.id === id);
    if (index === -1) return;

    if (cambio > 0) {
        if (carrito[index].cantidad >= carrito[index].stockMax) {
            alert(`No puedes agregar más unidades. El stock máximo disponible es de ${carrito[index].stockMax} pzas.`);
            return;
        }
        carrito[index].cantidad++;
    } else {
        if (carrito[index].cantidad > 1) {
            carrito[index].cantidad--;
        } else {
            carrito.splice(index, 1);
        }
    }
    actualizarInterfazCarritoPublico();
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
        usuarioActual = usuario; 
        
        if (loginLink) loginLink.classList.add('hidden');
        if (userDisplay) {
            userDisplay.innerText = `👤 ${usuario.curp}`;
            userDisplay.classList.remove('hidden');
        }
        if (btnSalir) btnSalir.classList.remove('hidden');
        
        // Auto-cargar el historial en la columna izquierda en cuanto se inicia sesión
        if (typeof verMisCompras === "function") {
            verMisCompras();
        }
    } else {
        usuarioActual = null;
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
    if (carrito.length === 0) {
        alert("El carrito está vacío.");
        return;
    }
    if (!usuarioActual || !usuarioActual.curp) {
        alert("Debes iniciar sesión para comprar.");
        return;
    }

    const urlBase = obtenerUrlBaseAPI();
    const payload = {
        curp_cliente: usuarioActual.curp,
        productos: carrito.map(item => ({
            id_producto: item.id,
            cantidad: item.cantidad
        }))
    };

    try {
        const respuesta = await fetch(`${urlBase}/ventas/publico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert("🎉 ¡Compra realizada con éxito! Tu ticket ha sido generado.");
            
            // 1. Limpiamos carrito local
            carrito = [];
            if (typeof limpiarCarritoCliente === "function") {
                limpiarCarritoCliente();
            } else {
                actualizarInterfazCarritoPublico();
            }

            // 2. Traer el stock actualizado directo del servidor
            await irAProductos();

            // 3. AUTO-ACTUALIZACIÓN DE COMPRAS: Refresca el panel izquierdo de compras al instante
            if (typeof verMisCompras === "function") {
                verMisCompras();
            }
        } else {
            alert("Error al procesar la venta: " + (resultado.error || "Intente de nuevo."));
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión con el servidor.");
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

// =======================================================
// LÓGICA COMPLEMENTARIA PARA LA TIENDA PÚBLICA (ONLINE)
// =======================================================

// 1. Función para añadir un artículo al carrito
function añadirAlCarrito(id_producto, nombre, precio, stockMaximo) {
    // Verificar si el producto ya está en el carrito
    const itemExistente = carrito.find(item => item.id_producto === id_producto);

    if (itemExistente) {
        if (itemExistente.cantidad >= stockMaximo) {
            alert(`Lo sentimos, solo quedan ${stockMaximo} piezas disponibles de este producto.`);
            return;
        }
        itemExistente.cantidad++;
    } else {
        // Insertarlo por primera vez al arreglo global
        carrito.push({
            id_producto: id_producto,
            nombre: nombre,
            precio: parseFloat(precio),
            cantidad: 1
        });
    }

    actualizarInterfazCarritoPublico();
}

// 2. Función para redibujar la barra lateral del carrito
function actualizarInterfazCarritoPublico() {
    const contenedor = document.getElementById('cart-items');
    const totalContenedor = document.getElementById('cart-total');
    if (!contenedor) return;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px 0;">Tu carrito está vacío</p>';
        if (totalContenedor) totalContenedor.innerText = '$0.00';
        // Si el carrito se vacía, actualizamos tarjetas para restaurar stock original
        irAProductos();
        return;
    }

    let sumaTotal = 0;
    contenedor.innerHTML = carrito.map(item => {
        const subtotal = item.cantidad * item.precio;
        sumaTotal += subtotal;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
                <div style="flex: 1; padding-right: 10px;">
                    <h4 style="margin: 0; font-weight: 600; color: var(--text-main);">${item.nombre}</h4>
                    <small style="color: var(--accent); font-weight: 700;">$${item.precio.toFixed(2)} c/u</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button onclick="cambiarCantidadCarrito('${item.id}', -1)" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border); background: #f8fafc; cursor: pointer; font-weight: bold;">-</button>
                    <span style="font-weight: 700; min-width: 16px; text-align: center;">${item.cantidad}</span>
                    <button onclick="cambiarCantidadCarrito('${item.id}', 1)" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border); background: #f8fafc; cursor: pointer; font-weight: bold;">+</button>
                </div>
                <div style="min-width: 70px; text-align: right; font-weight: 700; color: var(--text-main);">
                    $${subtotal.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');

    if (totalContenedor) totalContenedor.innerText = `$${sumaTotal.toFixed(2)}`;

    // RE-RENDERIZADO AUTOMÁTICO: Sincroniza las tarjetas con los cambios de cantidades del carrito
    irAProductos();
}

function cambiarCantidadCarrito(id, cambio) {
    const index = carrito.findIndex(item => item.id === id);
    if (index === -1) return;

    if (cambio > 0) {
        if (carrito[index].cantidad >= carrito[index].stockMax) {
            alert(`No puedes agregar más unidades. El stock máximo disponible es de ${carrito[index].stockMax} pzas.`);
            return;
        }
        carrito[index].cantidad++;
    } else {
        if (carrito[index].cantidad > 1) {
            carrito[index].cantidad--;
        } else {
            carrito.splice(index, 1);
        }
    }
    actualizarInterfazCarritoPublico();
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
// LÓGICA DEL BUSCADOR DE PRODUCTOS EN TIENDA PÚBLICA
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    const publicSearchInput = document.getElementById('public-search');
    
    if (publicSearchInput) {
        publicSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const tarjetas = document.querySelectorAll('#product-grid > div');

            tarjetas.forEach(tarjeta => {
                // Buscamos el título h3 dentro de cada tarjeta de producto
                const nombreProducto = tarjeta.querySelector('h3').textContent.toLowerCase();
                const idProducto = tarjeta.querySelector('span').textContent.toLowerCase();

                if (nombreProducto.includes(query) || idProducto.includes(query)) {
                    tarjeta.style.display = 'flex'; // Muestra la tarjeta si coincide
                } else {
                    tarjeta.style.display = 'none'; // La oculta si no coincide
                }
            });
        });
    }
});

// Cambia la interfaz para ver la tabla de compras del cliente logueado
// =======================================================
// INTERFAZ DUAL SPLIT: HISTORIAL DE COMPRAS DEL CLIENTE
// =======================================================
async function verMisCompras() {
    if (!usuarioActual || !usuarioActual.curp) {
        alert("Por favor inicia sesión para ver tus compras.");
        return;
    }

    // Ocultar catálogo de productos y banner principal (Hero)
    const productGrid = document.getElementById('product-grid');
    if (productGrid) productGrid.classList.add('hidden');
    
    const storeHero = document.getElementById('store-hero-section');
    if (storeHero) storeHero.classList.add('hidden');

    // Desplegar la sección de compras dual sin alterar la barra del carrito
    const comprasSection = document.getElementById('compras-cliente-section');
    if (comprasSection) comprasSection.classList.remove('hidden');

    const listaCards = document.getElementById('compras-cliente-lista-cards');
    if (listaCards) {
        listaCards.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:0.85rem; padding:15px;">Buscando tus tickets...</p>';
    }
    
    // Resetear el panel informativo de la derecha
    const placeholder = document.getElementById('compras-cliente-detalle-placeholder');
    const contenido = document.getElementById('compras-cliente-detalle-contenido');
    if (placeholder) placeholder.classList.remove('hidden');
    if (contenido) contenido.classList.add('hidden');

    const urlBase = obtenerUrlBaseAPI();

    try {
        const respuesta = await fetch(`${urlBase}/clientes/${usuarioActual.curp}/compras`);
        const compras = await respuesta.json();

        if (!listaCards) return;

        if (!compras || compras.length === 0) {
            listaCards.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:0.85rem; padding: 20px;">No cuentas con compras registradas en este establecimiento.</p>';
            return;
        }

        listaCards.innerHTML = compras.map(c => {
            const fechaFormateada = new Date(c.fecha).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });

            return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; font-family:'Inter',sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-family: monospace; font-weight: 700; color: #2563eb; font-size: 0.85rem;">${c.id_venta}</span>
                        <span style="font-weight: 800; color: #10b981; font-size: 0.9rem;">$${parseFloat(c.precio_total).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                        <span style="color: #64748b; font-size: 0.7rem;">${fechaFormateada}</span>
                        <button onclick="verDetalleEnPanelDerecho('${c.id_venta}', '${fechaFormateada}', ${c.precio_total})" 
                            style="background: #2563eb; border: none; color: white; font-size: 0.7rem; font-weight: 700; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;">
                            Ver Detalles ➡️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        if (listaCards) {
            listaCards.innerHTML = '<p style="text-align:center; color:#ef4444; font-size:0.85rem;">Error al sincronizar con el servidor.</p>';
        }
    }
}

async function verDetalleEnPanelDerecho(idVenta, fechaStr, totalVenta) {
    const placeholder = document.getElementById('compras-cliente-detalle-placeholder');
    const contenido = document.getElementById('compras-cliente-detalle-contenido');
    const bodyProductos = document.getElementById('panel-detalle-productos-body');

    if (placeholder) placeholder.classList.add('hidden');
    if (contenido) contenido.classList.remove('hidden');

    const elFolio = document.getElementById('panel-detalle-folio');
    const elFecha = document.getElementById('panel-detalle-fecha');
    const elTotal = document.getElementById('panel-detalle-total');

    if (elFolio) elFolio.innerText = `Folio: ${idVenta}`;
    if (elFecha) elFecha.innerText = `Realizado: ${fechaStr}`;
    if (elTotal) elTotal.innerText = `$${parseFloat(totalVenta).toFixed(2)}`;

    if (bodyProductos) {
        bodyProductos.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:#94a3b8; font-size:0.8rem;">Desglosando artículos...</td></tr>';
    }

    const urlBase = obtenerUrlBaseAPI();

    try {
        const respuesta = await fetch(`${urlBase}/ventas/${encodeURIComponent(idVenta)}/detalles`);
        const detalles = await respuesta.json();

        if (!bodyProductos) return;

        if (!detalles || detalles.length === 0) {
            bodyProductos.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:#94a3b8; font-size:0.8rem;">No se encontraron artículos asignados.</td></tr>';
            return;
        }

        bodyProductos.innerHTML = detalles.map(d => {
            // CRUCE EN MEMORIA: Buscamos el objeto de producto usando el id_producto para obtener su nombre real
            const matchingProd = listaProductosGlobal.find(p => p.id_producto === d.id_producto);
            const nombreMostrar = matchingProd ? matchingProd.nombre : `Artículo ${d.id_producto}`;
            const subtotal = d.cantidad * d.precio_unitario;

            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 4px; color: #1e293b; font-weight: 600; text-align: left;">${nombreMostrar}</td>
                    <td style="padding: 8px 4px; text-align: center; color: #475569; font-weight: 700;">${d.cantidad}</td>
                    <td style="padding: 8px 4px; text-align: right; color: #0f172a; font-weight: 700;">$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        if (bodyProductos) {
            bodyProductos.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:#ef4444; font-size:0.8rem;">Error de lectura.</td></tr>';
        }
    }
}

function regresarATiendaPublica() {
    const comprasSection = document.getElementById('compras-cliente-section');
    if (comprasSection) comprasSection.classList.add('hidden');

    const productGrid = document.getElementById('product-grid');
    if (productGrid) productGrid.classList.remove('hidden');

    const storeHero = document.getElementById('store-hero-section');
    if (storeHero) storeHero.classList.remove('hidden');
}

// Abre el modal flotante consultando los detalles específicos del folio
async function verDetalleTicket(idVenta, fechaStr, totalVenta) {
    const modal = document.getElementById('modal-detalle-compra');
    const bodyProductos = document.getElementById('modal-detalle-productos-body');
    
    document.getElementById('modal-detalle-folio').innerText = `Ticket: ${idVenta}`;
    document.getElementById('modal-detalle-fecha').innerText = `Fecha: ${fechaStr}`;
    document.getElementById('modal-detalle-total').innerText = `$${parseFloat(totalVenta).toFixed(2)}`;
    
    bodyProductos.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Cargando artículos...</td></tr>';
    modal.classList.remove('hidden');

    const urlBase = obtenerUrlBaseAPI();

    try {
        const respuesta = await fetch(`${urlBase}/ventas/${encodeURIComponent(idVenta)}/detalles`);
        const detalles = await respuesta.json();

        if (detalles.length === 0) {
            bodyProductos.innerHTML = '<tr><td colspan="4" class="p-2 text-center text-slate-400">No se encontraron productos para este ticket.</td></tr>';
            return;
        }

        bodyProductos.innerHTML = detalles.map(d => {
            const nombreProd = d.producto ? d.producto.nombre : `Producto [${d.id_producto}]`;
            const subtotal = d.cantidad * d.precio_unitario;
            return `
                <tr class="border-b border-slate-50">
                    <td class="p-2 font-semibold text-slate-800">${nombreProd}</td>
                    <td class="p-2 text-center font-bold text-slate-600">${d.cantidad}</td>
                    <td class="p-2 text-slate-400">$${parseFloat(d.precio_unitario).toFixed(2)}</td>
                    <td class="p-2 text-right font-bold text-slate-800">$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        bodyProductos.innerHTML = '<tr><td colspan="4" class="p-2 text-center text-red-500">Error al cargar artículos.</td></tr>';
    }
}

function cerrarModalDetalleCompra() {
    document.getElementById('modal-detalle-compra').classList.add('hidden');
}
