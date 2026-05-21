-- Agrega la columna de contraseña para el acceso de trabajadores.
-- Ejecuta esto en tu proyecto Supabase SQL editor.

ALTER TABLE trabajadores
ADD COLUMN IF NOT EXISTS password text;

-- Opcional: crea tabla de ventas si aún no existe.
-- Reemplaza los nombres con los que uses en Supabase.

CREATE TABLE IF NOT EXISTS ventas (
  id_venta serial PRIMARY KEY,
  precio_total numeric,
  curp_cliente text,
  curp_trabajador text,
  detalles jsonb,
  fecha timestamptz DEFAULT now()
);

-- Ejemplo de actualización de contraseña en la tabla de trabajadores.
-- Utiliza un hash seguro en producción.

UPDATE trabajadores
SET password = 'tu_contraseña_segura'
WHERE curp = 'GARC850101HDFABC01';
