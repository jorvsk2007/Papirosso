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
    
    // Validar de inmediato que el carrito no llegue vacío
    if (!detalles || detalles.length === 0) {
        return res.status(400).json({ error: "El carrito de ventas está completamente vacío." });
    }

    const client = await pool.connect(); 
    
    try {
        // Iniciamos la transacción SQL
        await client.query('BEGIN');

        // 1. INSERTAR LA CABECERA DE LA VENTA
        // Asegúrate de que los nombres de las columnas 'precio_total', 'curp_cliente', 'curp_trabajador' correspondan a tu tabla 'ventas'
        const queryVenta = `
            INSERT INTO ventas (precio_total, curp_cliente, curp_trabajador, fecha) 
            VALUES ($1, $2, $3, NOW()) RETURNING id_venta;
        `;
        
        // Si el cliente es "Público General", el frontend manda null o string vacío; lo guardamos como NULL en BD
        const clienteId = (curp_cliente && curp_cliente !== 'null' && curp_cliente.trim() !== '') ? curp_cliente : null;
        
        const resVenta = await client.query(queryVenta, [precio_total, clienteId, curp_trabajador]);
        const id_venta = resVenta.rows[0].id_venta;

        // 2. RECORRER CADA ARTÍCULO PARA VALIDAR, DISMINUIR STOCK E INSERTAR DETALLE
        for (const item of detalles) {
            
            // Buscamos el producto directo en la base de datos usando FOR UPDATE para bloquear la fila provisionalmente
            const verificarStock = await client.query(
                'SELECT cant_exist, nombre FROM productos WHERE id_producto = $1 FOR UPDATE', 
                [item.id]
            );
            
            const productoBD = verificarStock.rows[0];
            
            if (!productoBD) {
                throw new Error(`El producto con código ${item.id} no existe en el catálogo.`);
            }

            if (productoBD.cant_exist < item.cantidad) {
                throw new Error(`Stock insuficiente para "${productoBD.nombre}". Solicitado: ${item.cantidad}, Disponible: ${productoBD.cant_exist}`);
            }

            // 3. INSERTAR EN DETALLES_VENTAS
            // Revisa si tu tabla relacional se llama 'detalles_ventas' o 'detalle_venta'
            const queryDetalle = `
                INSERT INTO detalles_ventas (id_venta, id_producto, cantidad, precio_unitario) 
                VALUES ($1, $2, $3, $4);
            `;
            // Mapeamos los datos que vienen del frontend (item.id, item.cantidad, item.precio)
            await client.query(queryDetalle, [id_venta, item.id, item.cantidad, item.precio]);

            // 4. ACTUALIZAR DISMINUYENDO EL STOCK EN LA TABLA PRODUCTOS
            const queryDescontarStock = `
                UPDATE productos 
                SET cant_exist = cant_exist - $1 
                WHERE id_producto = $2;
            `;
            await client.query(queryDescontarStock, [item.cantidad, item.id]);
        }

        // Si todos los pasos se completaron con éxito, confirmamos los cambios de forma permanente
        await client.query('COMMIT');
        
        // Enviamos SIEMPRE una respuesta JSON válida de éxito
        return res.status(201).json({ success: true, id_venta: id_venta });

    } catch (error) {
        // En caso de que falle CUALQUIER inserción o validación, cancelamos todo el progreso para no corromper la BD
        await client.query('ROLLBACK');
        console.error("❌ ERROR EN TRANSACCIÓN DE VENTA:", error.message);
        
        // ¡Crucial! Devolvemos un JSON con el error para que el frontend no reciba HTML y se rompa
        return res.status(400).json({ error: error.message });
    } finally {
        // Liberamos la conexión de vuelta al pool de PostgreSQL
        client.release();
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
