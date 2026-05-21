require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors()); 
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- 1. RUTA DE LOGIN ---
app.post('/api/login', async (req, res) => {
    const { curp } = req.body;
    const { data, error } = await supabase
        .from('trabajadores')
        .select('curp, rol, persona(nombre, apellidos)')
        .eq('curp', curp)
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(401).json({ error: "CURP no encontrada" });
    res.json(data);
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
    const nuevoIdVenta = `VTA-2026-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;

    // 1. Insertar la venta principal
    const { error: errVenta } = await supabase.from('ventas').insert([{
        id_venta: nuevoIdVenta,
        precio_total,
        curp_cliente,
        curp_trabajador
    }]);

    if (errVenta) return res.status(400).json({ error: errVenta.message });

    // 2. Actualizar Stock de cada producto (Lógica en Servidor)
    try {
        for (const item of detalles) {
            // Obtenemos el stock actual primero
            const { data: prod } = await supabase
                .from('producto')
                .select('cant_exist')
                .eq('id_producto', item.id)
                .single();

            if (prod) {
                const nuevoStock = prod.cant_exist - item.cantidad;
                await supabase
                    .from('producto')
                    .update({ cant_exist: nuevoStock })
                    .eq('id_producto', item.id);
            }
        }
        res.json({ id_venta: nuevoIdVenta, status: "Venta y stock procesados" });
    } catch (err) {
        res.status(500).json({ error: "Venta registrada, pero falló el stock" });
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
