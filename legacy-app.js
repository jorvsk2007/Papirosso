// Cambia esto con la URL real que te asigne Render para tu backend
const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://jorvsk2007-github-io.onrender.com";

let usuarioActual = null;
let carrito = [];
let totalVentaAnterior = 0;
let clienteSeleccionado = null; 

// 2. FUNCIONES DE INTERFAZ (MODALES Y MENÚS)
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

// 3. LÓGICA DE LOGIN
async function ejecutarLogin() {
    const curpInput = document.getElementById('login-curp');
    const passwordInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error');
    
    // Extraemos los valores de forma segura
    const curp = curpInput ? curpInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    
    if (!curp || !password) {
        alert("Por favor, ingresa tu CURP y contraseña.");
        return;
    }

    // Ajustamos la URL dinámicamente para que lleve /api de forma correcta
    let urlBase = API_URL.replace(/\/+$/, ""); 
    if (!urlBase.endsWith('/api')) {
        urlBase += '/api';
    }

    try {
        console.log(`Enviando credenciales a: ${urlBase}/login`);

        const respuesta = await fetch(`${urlBase}/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' // <-- Agrega esta línea crucial para el handshake de CORS
            },
            body: JSON.stringify({ curp: curp, password: password })
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

        // LOGIN EXITOSO
        usuarioActual = data;
        if (errorMsg) errorMsg.classList.add('hidden');
        
        alert(`¡Bienvenido! Has ingresado como: ${data.rol}`);
        console.log("Datos del usuario logueado:", data);

        // Si existe un contenedor para renderizar el panel privado, lo montamos
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            document.getElementById('user-profile').classList.remove('hidden');
            document.getElementById('main-nav').classList.remove('hidden');
            
            const nombreCompleto = data.persona ? `${data.persona.nombre} ${data.persona.apellidos}` : "Usuario"; 
            document.getElementById('user-display-name').innerText = `${data.rol}: ${nombreCompleto}`;
            
            if (data.rol.toLowerCase().trim() === 'almacenista') {
                irAProductos();
            } else {
                irAVentas();
            }
        }

    } catch (e) {
        console.error("Error al intentar loguear:", e);
        alert("Error de conexión con el servidor: " + e.message);
    }
}

function cerrarSesion() {
    usuarioActual = null;
    location.reload();
}

// 4. NAVEGACIÓN Y RENDERIZADO DE VISTAS
function navegar(pantalla, btn) {
    const rolActual = usuarioActual.rol.trim().toLowerCase();
    console.log("Rol detectado en navegación:", rolActual);

    if (pantalla === 'reportes') {
        if (rolActual !== 'admin') {
            alert(`Acceso Denegado. Tu rol es "${usuarioActual.rol}", se requiere "Admin".`);
            return;
        }
    }

    if (pantalla === 'ventas' && rolActual === 'almacenista') {
        alert("Los almacenistas no tienen permiso para realizar ventas.");
        return;
    }

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (pantalla === 'ventas') irAVentas();
    if (pantalla === 'productos' || pantalla === 'inventario') irAProductos();
    if (pantalla === 'reportes') irAReportes(); 
}

function irAVentas() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="ventas-view">
            <div class="ticket-section">
                <div style="background: #f1f3f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #dee2e6;">
                    <div>
                        <small style="display:block; color:#666; text-transform:uppercase; font-size:10px; font-weight:bold;">Cliente de la venta:</small>
                        <span id="cliente-info-display" style="font-weight: 600; color: #333;">
                            ${clienteSeleccionado ? clienteSeleccionado : 'Público General'}
                        </span>
                    </div>
                    <button onclick="abrirModalCliente()" style="background: #6c757d; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        🔍 Cambiar Cliente
                    </button>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0;">Venta en curso</h2>
                    <button class="btn-confirm" onclick="abrirBuscador()" style="background:var(--accent);">+ Agregar Producto</button>
                </div>

                <table class="ticket-table">
                    <thead>
                        <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr>
                    </thead>
                    <tbody id="ticket-body"></tbody>
                </table>
            </div>
            
            <div class="totals-section">
                <div class="last-sale">Venta anterior: $${totalVentaAnterior.toFixed(2)}</div>
                <div class="current-total">
                    <label>TOTAL ACTUAL</label>
                    <span id="display-total">$0.00</span>
                </div>
                <button class="btn-vender" onclick="registrarVenta()">FINALIZAR Y REGISTRAR</button>
            </div>
        </div>
    `;
    actualizarVistaTicket();
}

async function irAProductos() {
    // Detectamos si estamos en la tienda pública o en el panel privado
    const mainPrivado = document.getElementById('main-content');
    const gridPublico = document.getElementById('product-grid');
    
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        const data = await respuesta.json();

        // CASO 1: Si existe 'product-grid', estamos en cliente-publico.html
        if (gridPublico) {
            if (!data || data.length === 0) {
                gridPublico.innerHTML = '<p class="no-products">No hay productos disponibles en este momento.</p>';
                return;
            }
            // Renderizamos los productos en formato de tarjetas de mercado libre / marketplace
            gridPublico.innerHTML = data.map(p => `
                <article class="product-card">
                    <div class="product-info">
                        <span class="product-id">ID: ${p.id_producto}</span>
                        <h3>${p.nombre}</h3>
                        <p class="price">$${p.precio.toFixed(2)}</p>
                        <p class="stock ${p.cant_exist <= 5 ? 'low-stock' : ''}">Disponibles: ${p.cant_exist}</p>
                    </div>
                    <button class="btn-confirm" onclick="añadirAlCarrito('${p.id_producto}', '${p.nombre}', ${p.precio})">
                        Añadir al carrito
                    </button>
                </article>
            `).join('');
            return; // Termina la ejecución aquí para la tienda pública
        }

        // CASO 2: Si no, estamos en el panel privado de administrador/almacenista (usa main-content)
        if (mainPrivado) {
            const rol = usuarioActual ? usuarioActual.rol.toLowerCase() : '';
            const puedeAgregar = (rol === 'admin' || rol === 'almacenista');

            mainPrivado.innerHTML = `
                <div style="background:white; padding:30px; border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                        <h2 style="margin:0;">Inventario General</h2>
                        ${puedeAgregar ? `<button class="btn-confirm" onclick="abrirModalProducto()">+ Nuevo Producto</button>` : ''}
                    </div>
                    <table style="width:100%; text-align:left;">
                        <thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th></tr></thead>
                        <tbody>
                            ${data.map(p => `
                                <tr>
                                    <td>${p.id_producto}</td>
                                    <td>${p.nombre}</td>
                                    <td>$${p.precio.toFixed(2)}</td>
                                    <td>${p.cant_exist}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (e) { 
        console.error("Error al cargar productos", e); 
    }
}
// 5. LÓGICA DE VENTA (EL TICKET)
async function filtrarProductos(termino) {
    // Llamada al API para buscar productos
    const respuesta = await fetch(`${API_URL}/productos`);
    let data = await respuesta.json();

    // Filtrado simple en el cliente si el API no soporta query strings aún
    if (termino) {
        data = data.filter(p => p.nombre.toLowerCase().includes(termino.toLowerCase()));
    }

    const body = document.getElementById('search-results-body');
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

function añadirAlCarrito(id, nombre, precio) {
    const index = carrito.findIndex(item => item.id === id);
    if (index !== -1) {
        carrito[index].cantidad++;
    } else {
        carrito.push({ id, nombre, precio, cantidad: 1 });
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
                <td>${item.nombre}</td>
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

    displayTotal.innerText = `$${sumaTotal.toFixed(2)}`;
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
            irAVentas();
        } else {
            throw new Error(resultado.error);
        }
    } catch (err) {
        alert("No se pudo registrar: " + err.message);
    }
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

async function irAReportes() {
    const main = document.getElementById('main-content');
    try {
        const respuesta = await fetch(`${API_URL}/reportes`);
        const data = await respuesta.json();

        main.innerHTML = `
            <div style="background:white; padding:30px; border-radius:12px;">
                <h2>Historial de Ventas (Reporte General)</h2>
                <table style="width:100%; margin-top:20px;">
                    <thead>
                        <tr style="text-align:left; border-bottom:2px solid #eee;">
                            <th>ID Venta</th>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Trabajador</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(v => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:15px;">#${v.id_venta}</td>
                                <td>${new Date(v.fecha).toLocaleDateString()}</td>
                                <td>$${parseFloat(v.precio_total).toFixed(2)}</td>
                                <td><small>${v.curp_trabajador}</small></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) { console.error("Error al cargar reportes", e); }
}

async function abrirModalCliente() {
    document.getElementById('modal-cliente').classList.remove('hidden');
    
    try {
        const respuesta = await fetch(`${API_URL}/clientes`);
        const clientes = await respuesta.json();
        renderizarListaClientes(clientes);
    } catch (e) { console.error("Error al traer clientes", e); }
}

function renderizarListaClientes(clientes) {
    const body = document.getElementById('lista-clientes-body');
    
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
    document.getElementById('cliente-info-display').innerText = `Cliente: ${nombre}`;
    cerrarModalCliente();
}

function seleccionarClienteNull() {
    clienteSeleccionado = null;
    document.getElementById('cliente-info-display').innerText = "Cliente: Público General";
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
            renderizarListaClientes(todosLosClientes);
            return;
        }

        const busqueda = termino.toLowerCase();
        const clientesFiltrados = todosLosClientes.filter(c => {
            const nombre = (c.persona?.nombre || "").toLowerCase();
            const apellidos = (c.persona?.apellidos || "").toLowerCase();
            const curp = (c.curp || "").toLowerCase();
            return nombre.includes(busqueda) || apellidos.includes(busqueda) || curp.includes(busqueda);
        });

        renderizarListaClientes(clientesFiltrados);
    } catch (e) { console.error(e); }
}
