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

        // 🔥 ASIGNACIÓN DE ROL DINÁMICO RESTRINGIDO
        let rolFinal = tipoUsuario === 'cliente' ? 'cliente' : usuario.rol;
        
        // Si es cualquiera de nuestras dos CURPs de prueba, les forzamos el rol maestro de solo lectura
        if (curpLimpia === 'CHOC000101HDFRRR00' || curpLimpia === 'CHOC000101HDFRRR99') {
            rolFinal = 'visitante';
        }

        let destino = '/panel.html'; // Por defecto, el POS de los trabajadores

        if (tipoUsuario === 'cliente') {
            destino = '/cliente-publico.html'; // Los clientes van a su tienda
        } else if (rolFinal === 'visitante') {
            destino = '/panel.html'; // Tu profesor va a ver los reportes
        }

        // 3. Éxito. Retornamos el rol adecuado
        return res.json({
            curp: usuario.curp.trim(),
            rol: rolFinal,
            tipo: tipoUsuario,
            persona: { nombre: "Usuario", apellidos: "Papirosso" },
            redirect: destino // <--- AQUÍ LE DAS LA ORDEN DE A DÓNDE IR
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

// --- 5. RUTA DE VENTAS (Con actualización de Stock y CURP automática en línea) ---
app.post('/api/ventas', async (req, res) => {
    const { precio_total, curp_cliente, curp_trabajador, detalles, rol_usuario } = req.body;

    // ESTO NOS DIRÁ LA VERDAD
    console.log("DEBUG: Valor recibido en rol_usuario:", JSON.stringify(rol_usuario));
    console.log("DEBUG: Tipo de dato:", typeof rol_usuario);

    // Comparación forzada
    if (rol_usuario === 'visitante' || rol_usuario === 'General' || rol_usuario?.trim() === 'General') {
        return res.status(403).json({ error: "🚫 Acceso denegado: Tu cuenta tiene un rol de solo lectura." });
    }

    try {
        // 🌟 LA REGLA DE TU NEGOCIO: Si no viene un trabajador (venta en línea), 
        // le asignamos automáticamente la CURP que nos pediste.
        const trabajadorFinal = (curp_trabajador && curp_trabajador.trim() !== "") 
            ? curp_trabajador 
            : "TRAB010101HLINEA01";

        // 1. GENERAR FOLIO
        const folioVenta = `#VTA-2026-${Math.floor(Math.random() * 999)}`;

        // 2. INSERTAR VENTA (Usando la variable del trabajador final)
        const { error: errVenta } = await supabase.from('ventas').insert([{
            id_venta: folioVenta,
            precio_total: parseFloat(precio_total),
            curp_cliente: curp_cliente,
            curp_trabajador: trabajadorFinal, // 👈 Aquí se guarda el comodín si fue en línea
            fecha: new Date().toISOString()
        }]);
        if (errVenta) throw errVenta;

        // 3. PROCESAR CADA PRODUCTO (Tu funcionalidad original intacta)
        for (const item of detalles) {
            // A. CONSULTAR STOCK ACTUAL
            const { data: producto, error: errFetch } = await supabase
                .from('producto')
                .select('cant_exist')
                .eq('id_producto', item.id_producto)
                .single();

            if (errFetch || !producto) throw new Error(`Producto ${item.id_producto} no encontrado.`);

            // B. VALIDAR SI HAY SUFICIENTE
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

// Endpoint 1: Obtener el historial de compras de un cliente específico por su CURP
app.get('/api/clientes/:curp/compras', async (req, res) => {
    const { curp } = req.params;
    try {
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select('*')
            .eq('curp_cliente', curp.trim().toUpperCase())
            .order('fecha', { ascending: false });

        if (error) throw error;
        return res.json(ventas || []);
    } catch (err) {
        console.error("Error al obtener compras del cliente:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

// Endpoint 2: Obtener los artículos específicos de una venta
app.get('/api/ventas/:id_venta/detalles', async (req, res) => {
    const { id_venta } = req.params;
    try {
        const { data: detalles, error } = await supabase
            .from('detalle_venta')
            .select('*')
            .eq('id_venta', id_venta);

        if (error) throw error;
        return res.json(detalles || []); // Esto NO da error 500
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Ruta para actualizar stock (REABASTECIMIENTO)
app.put('/api/productos/reabastecer', async (req, res) => {
    const { id_producto, cantidad_a_sumar, rol_usuario } = req.body;

    // 🔥 EL CANDADO: Si no es Admin, bloqueamos la petición
    if (rol_usuario !== 'Admin') {
        return res.status(403).json({ error: "🚫 Acceso denegado: Solo el Administrador puede reabastecer stock." });
    }

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
    // 1. Obtenemos el rol del parámetro enviado en la URL
    const { rol } = req.query;

    // 2. Definimos quiénes tienen permiso
    const rolesAutorizados = ['Admin', 'visitante'];

    // 3. Validamos
    if (!rolesAutorizados.includes(rol)) {
        return res.status(403).json({ error: "🚫 Acceso denegado: No tienes permisos para ver reportes." });
    }

    try {
        const { data, error } = await supabase
            .from('ventas')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener reportes: " + err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));

// --- RUTA COMPUESTA INTELIGENTE: PERMITE ASIGNAR ROLES A PERSONAS YA EXISTENTES ---
app.post('/api/usuarios/registro', async (req, res) => {
    const { tipo, curp, nombre, apellidos, rol, sueldo, password, correo } = req.body;

    if (!curp || !nombre || !apellidos || !correo) {
        return res.status(400).json({ error: "CURP, nombre, apellidos y correo son requeridos." });
    }

    try {
        const curpLimpia = curp.trim().toUpperCase();

        // 1. Verificar si la persona ya existe en la tabla maestra 'persona'
        const { data: personaExistente, error: errBuscar } = await supabase
            .from('persona')
            .select('curp')
            .eq('curp', curpLimpia)
            .maybeSingle(); // Usamos maybeSingle para que no truene si no encuentra nada

        if (errBuscar) {
            return res.status(400).json({ error: "Error al verificar la persona: " + errBuscar.message });
        }

        // 2. Si NO existe en la tabla maestra, la insertamos por primera vez
        if (!personaExistente) {
            const { error: errPersona } = await supabase
                .from('persona') 
                .insert([{ curp: curpLimpia, nombre, apellidos, correo }]);

            if (errPersona) {
                return res.status(400).json({ error: "Error al registrar en tabla persona: " + errPersona.message });
            }
            console.log(`Persona nueva (${curpLimpia}) creada con éxito.`);
        } else {
            console.log(`La persona (${curpLimpia}) ya existía. Procediendo a asignación de rol.`);
        }

        // 3. Insertar en la tabla subordinada según el tipo elegido en el formulario
        if (tipo === 'trabajador') {
            if (!rol || !sueldo || !password) {
                return res.status(400).json({ error: "Faltan datos de contratación del trabajador (rol, sueldo o contraseña)." });
            }

            // Validamos si ya está dada de alta en trabajadores para no duplicar puestos
            const { data: yaEsTrabajador } = await supabase
                .from('trabajadores')
                .select('curp')
                .eq('curp', curpLimpia)
                .maybeSingle();

            if (yaEsTrabajador) {
                return res.status(400).json({ error: "Esta persona ya se encuentra registrada como Trabajador." });
            }

            // Al estar libre el RLS y existir la persona, insertamos directo
            const { error: errTrabajador } = await supabase
                .from('trabajadores')
                .insert([{ curp: curpLimpia, rol, sueldo, password }]);

            if (errTrabajador) {
                return res.status(400).json({ error: "Error al insertar en la tabla trabajadores: " + errTrabajador.message });
            }

        } else {
            // Tipo: Cliente
            const { data: yaEsCliente } = await supabase
                .from('cliente')
                .select('curp')
                .eq('curp', curpLimpia)
                .maybeSingle();

            if (yaEsCliente) {
                return res.status(400).json({ error: "Esta persona ya se encuentra registrada como Cliente." });
            }

            const { error: errCliente } = await supabase
                .from('cliente')
                .insert([{ curp: curpLimpia }]);

            if (errCliente) {
                return res.status(400).json({ error: "Error al insertar en la tabla cliente: " + errCliente.message });
            }
        }

        // Si todo sale bien, respondemos con éxito
        return res.json({ success: true, message: `Asignación completada exitosamente como ${tipo}` });

    } catch (globalErr) {
        console.error("Error general en el servidor:", globalErr);
        return res.status(500).json({ error: "Error interno del servidor: " + globalErr.message });
    }
});
