import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.mjs';

const supabaseUrl = window.SUPABASE_URL || '';
const supabaseKey = window.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL o ANON KEY no están configurados. Reemplaza los valores en login.html y cliente-publico.html.');
}

console.log('Supabase config:', { supabaseUrl: supabaseUrl ? 'set' : 'missing', supabaseKey: supabaseKey ? 'set' : 'missing' });

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getTrabajadorPorCURP(curp) {
    return await supabase
        .from('trabajadores')
        .select('curp,password,rol,nombre,activo')
        .eq('curp', curp)
        .single();
}

export async function obtenerProductos() {
    return await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });
}

export async function actualizarStockProducto(idProducto, cantidadRestar) {
    const { data, error } = await supabase
        .from('productos')
        .select('cant_exist')
        .eq('id_producto', idProducto)
        .single();

    if (error || !data) {
        return { data: null, error: error || new Error('Producto no encontrado') };
    }

    const nuevoStock = Math.max(0, data.cant_exist - cantidadRestar);
    return await supabase
        .from('productos')
        .update({ cant_exist: nuevoStock })
        .eq('id_producto', idProducto);
}

export async function registrarVentaEnBD(ventaData) {
    return await supabase
        .from('ventas')
        .insert([ ventaData ]);
}
