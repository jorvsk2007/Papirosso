require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuración avanzada de CORS para permitir la comunicación segura entre GitHub Pages y Render
app.use(cors({
    origin: '*', // Permite peticiones desde cualquier origen (incluyendo tu GitHub Pages)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json()); // Recuerda que esta línea es obligatoria para leer el req.body

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- 1. RUTA DE LOGIN (ACTUALIZADA PARA TRABAJADORES Y CLIENTES) ---
app.post('/api/login', async (req, res) => {
    const { curp, password } = req.body;

    if (!curp || !password) {
        return res.status(400).json({ error: "CURP y contraseña son obligatorios." });
    }

    try {
        const curpLimpia = curp.trim().toUpperCase();

        // 1. Intentar buscar en trabajadores
        const { data: trabajadores } = await supabase.from('trabajadores').select('*');
        let usuario = trabajadores ? trabajadores.find(t => t.curp && t.curp.trim().toUpperCase() === curpLimpia) : null;
        let tipoUsuario = 'trabajador';

        // 2. Si no es trabajador, buscar en cliente
        if (!usuario) {
            const { data: clientes } = await supabase.from('cliente').select('*');
            usuario = clientes ? clientes.find(c => c.curp && c.curp.trim().toUpperCase() === curpLimpia) : null;
            tipoUsuario = 'cliente';
        }

        if (!usuario) {
            return res.status(401).json({ error: "La CURP no está registrada." });
        }

        if (!usuario.password || usuario.password.trim() !== password.trim()) {
            return res.status(401).json({ error: "Contraseña incorrecta." });
        }

        // 3. Éxito. Retornamos el rol adecuado ('cliente' o el rol del trabajador)
        return res.json({
            curp: usuario.curp.trim(),
            rol: tipoUsuario === 'cliente' ? 'cliente' : usuario.rol,
            persona: { nombre: "Usuario", apellidos: "Papirosso" }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: `Error de servidor: ${err.message}` });
    }
});

// --- 2. RUTA DE PRODUCTOS (Listado y Filtro) ---
app.get('/api/productos', async (req, res) => {
    const { nombre } = req.query; // Para cuando busques desde el modal
    let query = supabase.from('producto').select('*');
    
    if (nombre) {
        query = query.ilike('nombre', `%${nombre}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json(error);
    res.json(data);
});

// --- 3. RUTA PARA CREAR PRODUCTO ---
app.post('/api/productos', async (req, res) => {
    const { id_producto, nombre, precio, cant_exist } = req.body;
    const { data, error } = await supabase
        .from('producto')
        .insert([{ id_producto, nombre, precio, cant_exist }])
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data[0]);
});

// --- 4. RUTA DE CLIENTES ---
app.get('/api/clientes', async (req, res) => {
    const { data, error } = await supabase.from('cliente').select('curp, password, persona(nombre, apellidos)');
    if (error) return res.status(400).json(error);
    res.json(data);
});

// --- 5. RUTA DE VENTAS (Con actualización de Stock) ---
app.post('/api/ventas', async (req, res) => {
    const { precio_total, curp_cliente, curp_trabajador, detalles } = req.body;

    try {
        // 1. GENERAR FOLIO
        const folioVenta = `#VTA-2026-${Math.floor(Math.random() * 999)}`;

        // 2. INSERTAR VENTA
        const { error: errVenta } = await supabase.from('ventas').insert([{
            id_venta: folioVenta,
            precio_total: parseFloat(precio_total),
            curp_cliente: curp_cliente,
            curp_trabajador: curp_trabajador,
            fecha: new Date().toISOString()
        }]);
        if (errVenta) throw errVenta;

        // 3. PROCESAR CADA PRODUCTO
        for (const item of detalles) {
            // A. CONSULTAR STOCK ACTUAL
            const { data: producto, error: errFetch } = await supabase
                .from('producto')
                .select('cant_exist')
                .eq('id_producto', item.id_producto)
                .single();

            if (errFetch || !producto) throw new Error(`Producto ${item.id_producto} no encontrado.`);

            // B. VALIDAR SI HAY SUFICIENTE (Esto evita que baje de 0)
            if (producto.cant_exist < item.cantidad) {
                throw new Error(`Stock insuficiente para ${item.nombre}. Quedan: ${producto.cant_exist}`);
            }

            // C. ACTUALIZAR STOCK
            const nuevoStock = producto.cant_exist - item.cantidad;
            const { error: errUpdate } = await supabase
                .from('producto')
                .update({ cant_exist: nuevoStock })
                .eq('id_producto', item.id_producto);
            
            if (errUpdate) throw errUpdate;

            // D. INSERTAR DETALLE
            await supabase.from('detalle_venta').insert([{
                id_detalle: Math.floor(Math.random() * 1000000),
                id_venta: folioVenta,
                id_producto: item.id_producto,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }]);
        }

        return res.status(201).json({ id_venta: folioVenta });

    } catch (err) {
        console.error("Error en la transacción:", err);
        return res.status(400).json({ error: err.message });
    }
});

// Ruta para actualizar stock (REABASTECIMIENTO)
app.put('/api/productos/reabastecer', async (req, res) => {
    const { id_producto, cantidad_a_sumar } = req.body;

    // 1. Obtener el stock actual
    const { data: producto, error: errFetch } = await supabase
        .from('producto')
        .select('cant_exist')
        .eq('id_producto', id_producto)
        .single();

    if (errFetch || !producto) return res.status(404).json({ error: "Producto no encontrado" });

    // 2. Sumar el stock nuevo al actual
    const nuevoTotal = producto.cant_exist + parseInt(cantidad_a_sumar);

    // 3. Guardar el nuevo valor
    const { error: errUpdate } = await supabase
        .from('producto')
        .update({ cant_exist: nuevoTotal })
        .eq('id_producto', id_producto);

    if (errUpdate) return res.status(500).json({ error: "Error al actualizar stock" });

    res.json({ mensaje: "Stock actualizado", nuevo_total: nuevoTotal });
});

// --- 6. RUTA DE REPORTES (Historial) ---
app.get('/api/reportes', async (req, res) => {
    const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .order('fecha', { ascending: false }); // Ventas recientes primero

    if (error) return res.status(500).json(error);
    res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));

// --- RUTA COMPUESTA: REGISTRO DE TRABAJADORES O CLIENTES ---
app.post('/api/usuarios/registro', async (req, res) => {
    const { tipo, curp, nombre, apellidos, rol, sueldo, password } = req.body;

    if (!curp || !nombre || !apellidos) {
        return res.status(400).json({ error: "CURP, nombre y apellidos son requeridos." });
    }

    // 1. Insertar en la tabla maestra de 'personas'
    const { error: errPersona } = await supabase
        .from('personas')
        .insert([{ curp, nombre, apellidos }]);

    if (errPersona) {
        return res.status(400).json({ error: "Error al registrar persona: " + errPersona.message });
    }

    // 2. Insertar en la tabla subordinada según el tipo elegido
    if (tipo === 'trabajador') {
        if (!rol || !sueldo || !password) {
            return res.status(400).json({ error: "Faltan datos de contratación del trabajador." });
        }
        const { error: errTrabajador } = await supabase
            .from('trabajadores')
            .insert([{ curp, rol, sueldo, password }]);

        if (errTrabajador) return res.status(400).json({ error: "Persona creada, pero falló el rol de trabajador: " + errTrabajador.message });
    } else {
        // Tipo Cliente
        const { error: errCliente } = await supabase
            .from('clientes')
            .insert([{ curp }]);

        if (errCliente) return res.status(400).json({ error: "Persona creada, pero falló el registro en clientes: " + errCliente.message });
    }

    res.json({ success: true, message: `Registro completado exitosamente como ${tipo}` });
});
