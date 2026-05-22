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

// --- 1. RUTA DE LOGIN (VERSIÓN A PRUEBA DE FALLOS) ---
app.post('/api/login', async (req, res) => {
    const { curp, password } = req.body;

    if (!curp || !password) {
        return res.status(400).json({ error: "CURP y contraseña son obligatorios." });
    }

    try {
        // 1. Consulta limpia: sin uniones (joins) que rompan la base de datos.
        const { data: trabajadores, error } = await supabase
            .from('trabajadores')
            .select('*');

        // Si la base de datos falla, ahora nos dirá exactamente por qué
        if (error) {
            console.error("Fallo de Supabase:", error.message);
            return res.status(500).json({ error: `Error DB: ${error.message}` });
        }

        // 2. Buscamos limpiando los espacios invisibles
        const curpLimpia = curp.trim().toUpperCase();
        const trabajador = trabajadores.find(t => 
            t.curp && t.curp.trim().toUpperCase() === curpLimpia
        );

        if (!trabajador) {
            return res.status(401).json({ error: "La CURP no está registrada." });
        }

        // 3. Validamos la contraseña (evitando errores si un usuario no tiene password aún)
        if (!trabajador.password || trabajador.password.trim() !== password.trim()) {
            return res.status(401).json({ error: "Contraseña incorrecta." });
        }

        // 4. Éxito total. Mandamos nombre genérico por ahora para evitar el choque de tablas.
        return res.json({
            curp: trabajador.curp.trim(),
            rol: trabajador.rol,
            sueldo: trabajador.sueldo,
            persona: { nombre: "Equipo", apellidos: "Papelería" }
        });

    } catch (err) {
        console.error("Error de Node:", err);
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
    const { data, error } = await supabase.from('cliente').select('curp, persona(nombre, apellidos)');
    if (error) return res.status(400).json(error);
    res.json(data);
});

// --- 5. RUTA DE VENTAS (Con actualización de Stock) ---
// --- 5. RUTA DE VENTAS (Con actualización de Stock y Generación de IDs) ---
app.post('/api/ventas', async (req, res) => {
    const { precio_total, curp_cliente, curp_trabajador, detalles } = req.body;
    
    if (!detalles || detalles.length === 0) {
        return res.status(400).json({ error: "El carrito de ventas está completamente vacío." });
    }

    try {
        const clienteId = (curp_cliente && curp_cliente !== 'null' && curp_cliente.trim() !== '') ? curp_cliente : null;
        
        // Generar un folio de venta único por texto compatible
        const añoActual = new Date().getFullYear();
        const numeroConsecutivo = Math.floor(100 + Math.random() * 900); 
        const folioVenta = `#VTA-${añoActual}-${numeroConsecutivo}`;

        const { data: nuevaVenta, error: errVenta } = await supabase
            .from('ventas')
            .insert([{ 
                id_venta: folioVenta,
                precio_total: parseFloat(precio_total), 
                curp_cliente: clienteId, 
                curp_trabajador: curp_trabajador,
                fecha: new Date().toISOString()
            }])
            .select();

        if (errVenta) {
            return res.status(400).json({ error: "Error en venta: " + errVenta.message });
        }

        const id_venta = nuevaVenta[0].id_venta;

        // Recorrer los artículos para validar stock, registrar detalle y descontar
        for (const item of detalles) {
            const codigoProducto = item.id || item.id_producto;
            
            // Consultar existencias actuales en la tabla 'producto'
            const { data: productoBD, error: errStock } = await supabase
                .from('producto')
                .select('cant_exist, nombre')
                .eq('id_producto', codigoProducto)
                .single();

            if (errStock || !productoBD) {
                return res.status(400).json({ error: `El producto con código ${codigoProducto} no existe.` });
            }

            if (productoBD.cant_exist < item.cantidad) {
                return res.status(400).json({ error: `Stock insuficiente para "${productoBD.nombre}".` });
            }

            // Generar obligatoriamente un ID numérico entero único para 'id_detalle' (bigint compatible)
            const idDetalleManual = Number(`${Date.now()}${Math.floor(100 + Math.random() * 900)}`);

            // Insertar en la tabla 'detalle_venta'
            const { error: errDetalle } = await supabase
                .from('detalle_venta')
                .insert([{
                    id_detalle: idDetalleManual,
                    id_venta: id_venta,
                    id_producto: codigoProducto,
                    cantidad: parseInt(item.cantidad),
                    precio_unitario: parseFloat(item.precio)
                }]);

            if (errDetalle) {
                return res.status(400).json({ error: "Error en detalle: " + errDetalle.message });
            }

            // Descontar del inventario en la tabla 'producto'
            const nuevoStock = productoBD.cant_exist - item.cantidad;
            const { error: errUpdate } = await supabase
                .from('producto')
                .update({ cant_exist: nuevoStock })
                .eq('id_producto', codigoProducto);

            if (errUpdate) {
                return res.status(400).json({ error: "Error al actualizar inventario: " + errUpdate.message });
            }
        }

        return res.status(201).json({ success: true, id_venta: id_venta });

    } catch (err) {
        return res.status(500).json({ error: `Error inesperado: ${err.message}` });
    }
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
