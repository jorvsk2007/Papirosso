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
app.post('/api/ventas', async (req, res) => {
    const { precio_total, curp_cliente, curp_trabajador, detalles } = req.body;
    
    try {
        // 1. Generamos el folio exactamente como lo necesitas
        const folioVenta = `#VTA-2026-${Math.floor(Math.random() * 999)}`;

        // 2. Insertamos en 'ventas' (Asegúrate de que 'id_venta' sea tipo TEXT en tu BD)
        const { data: venta, error: errVenta } = await supabase
            .from('ventas')
            .insert([{
                id_venta: folioVenta, // Aquí va el texto: "#VTA-2026-XXX"
                precio_total: parseFloat(precio_total),
                curp_cliente: curp_cliente,
                curp_trabajador: curp_trabajador,
                fecha: new Date().toISOString()
            }])
            .select();

        if (errVenta) throw errVenta;

        // 3. Insertar detalles
        for (const item of detalles) {
            // IMPORTANTE: id_detalle debe ser INT4 (entero). 
            // Si el error de "out of range" persiste, es porque le estás pasando 
            // un número gigante aquí. Usa Math.random() limitado:
            const idDetalleSeguro = Math.floor(Math.random() * 1000000); 

            await supabase.from('detalle_venta').insert([{
                id_detalle: idDetalleSeguro, 
                id_venta: folioVenta, // Usamos el mismo texto de arriba
                id_producto: item.id_producto,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }]);
        }

        return res.status(201).json({ id_venta: folioVenta });

    } catch (err) {
        console.error("Error al guardar:", err);
        return res.status(400).json({ error: err.message });
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
