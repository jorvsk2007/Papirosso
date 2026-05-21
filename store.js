import { formatPrice, showElement, hideElement } from './utils.js';
import { obtenerProductos, actualizarStockProducto, registrarVentaEnBD } from './supabaseClient.js';

const searchInput = document.getElementById('public-search');
const gridContainer = document.getElementById('product-grid');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalLabel = document.getElementById('cart-total');
const checkoutButton = document.getElementById('checkout-button');
const easterEggTrigger = document.getElementById('easter-egg-trigger');
const easterEggModal = document.getElementById('easter-egg-modal');
const easterEggClose = document.getElementById('close-easter-egg');

let carritoPublico = [];
let productosDisponibles = [];
const easterKeywords = ['mortadela', 'sans', 'undertale'];

function renderizarProductos(lista) {
    if (!gridContainer) return;

    gridContainer.innerHTML = lista.map(producto => `
        <article class="product-card">
            <div class="product-badge">${producto.emoji}</div>
            <div class="product-info">
                <span class="product-category">${producto.categoria}</span>
                <h3>${producto.nombre}</h3>
                <p class="product-description">${producto.descripcion}</p>
            </div>
            <div class="product-meta">
                <strong>${formatPrice(producto.precio)}</strong>
                <span>${producto.stock} disponibles</span>
            </div>
            <div class="product-footer">
                <small>${producto.vendedor} · ⭐ ${producto.rating.toFixed(1)}</small>
                <button class="btn-confirm" onclick="addToCart('${producto.id}')">Agregar</button>
            </div>
        </article>
    `).join('');
}

function actualizarCarrito() {
    if (!cartItemsContainer || !cartTotalLabel) return;

    if (carritoPublico.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Aún no hay productos en el carrito.</p>';
        cartTotalLabel.textContent = formatPrice(0);
        checkoutButton.disabled = true;
        return;
    }

    const itemsHtml = carritoPublico.map(item => `
        <div class="cart-item">
            <div>
                <strong>${item.nombre}</strong>
                <small>${item.cantidad} x ${formatPrice(item.precio)}</small>
            </div>
            <span>${formatPrice(item.precio * item.cantidad)}</span>
        </div>
    `).join('');

    const total = carritoPublico.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    cartItemsContainer.innerHTML = itemsHtml;
    cartTotalLabel.textContent = formatPrice(total);
    checkoutButton.disabled = false;
}

function handleEasterKeyword(termino) {
    const search = termino.toLowerCase();
    const found = easterKeywords.some(keyword => search.includes(keyword));

    if (found) {
        showElement(easterEggTrigger);
    } else {
        hideElement(easterEggTrigger);
    }
}

function abrirEasterEgg() {
    showElement(easterEggModal);
}

function cerrarEasterEgg() {
    hideElement(easterEggModal);
}

window.addToCart = function(id) {
    const producto = productosDisponibles.find(item => String(item.id) === String(id));
    if (!producto) return;

    const existente = carritoPublico.find(item => String(item.id) === String(id));
    if (existente) {
        existente.cantidad += 1;
    } else {
        carritoPublico.push({ ...producto, cantidad: 1 });
    }

    actualizarCarrito();
};

async function cargarProductos() {
    const { data, error } = await obtenerProductos();

    if (error || !data) {
        productosDisponibles = [];
        renderizarProductos([]);
        console.error('Error al cargar productos desde Supabase:', error, data);
        alert('No se pudieron cargar los productos. Revisa la conexión a Supabase.');
        return;
    }

    productosDisponibles = data.map(producto => ({
        id: producto.id_producto,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        stock: producto.cant_exist,
        descripcion: producto.descripcion,
        categoria: producto.categoria || 'Papelería',
        emoji: producto.emoji || '📦',
        vendedor: producto.vendedor || 'Papelería DB',
        rating: Number(producto.rating || 4.5),
    }));
    renderizarProductos(productosDisponibles);
}

function filtrarProductos(termino) {
    const filtro = termino.toLowerCase();
    const productosFiltrados = productosDisponibles.filter(producto => {
        return producto.nombre.toLowerCase().includes(filtro)
            || producto.descripcion.toLowerCase().includes(filtro)
            || producto.categoria.toLowerCase().includes(filtro);
    });
    renderizarProductos(productosFiltrados);
}

async function inicializarTienda() {
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const value = event.target.value;
            filtrarProductos(value);
            handleEasterKeyword(value);
        });
    }

    if (easterEggTrigger) {
        easterEggTrigger.addEventListener('click', abrirEasterEgg);
    }

    if (easterEggClose) {
        easterEggClose.addEventListener('click', cerrarEasterEgg);
    }

    if (easterEggModal) {
        easterEggModal.addEventListener('click', (event) => {
            if (event.target === easterEggModal) {
                cerrarEasterEgg();
            }
        });
    }

    await cargarProductos();
    actualizarCarrito();
    handleEasterKeyword('');

    if (checkoutButton) {
        checkoutButton.addEventListener('click', async () => {
            if (carritoPublico.length === 0) return;

            for (const item of carritoPublico) {
                const { error: stockError } = await actualizarStockProducto(item.id, item.cantidad);
                if (stockError) {
                    alert(`Error al actualizar stock para ${item.nombre}: ${stockError.message}`);
                    return;
                }
            }

            const ventaData = {
                precio_total: carritoPublico.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
                curp_cliente: null,
                curp_trabajador: null,
                detalles: carritoPublico,
            };

            const { error } = await registrarVentaEnBD(ventaData);
            if (error) {
                alert('Error al registrar la venta: ' + error.message);
                return;
            }

            alert('Compra registrada con éxito en Supabase. Inventario actualizado.');
            carritoPublico = [];
            await cargarProductos();
            actualizarCarrito();
        });
    }
}

window.addEventListener('DOMContentLoaded', inicializarTienda);
