# jorvsk2007.github.io
# 🚀 Proyecto: Super Pape :D

### Sistema de Gestión de Base de Datos para Papelería

Este proyecto forma parte de la Unidad de Aprendizaje de **Bases de Datos** en la **Escuela Superior de Cómputo (ESCOM - IPN)**. Es una aplicación web integral que permite gestionar inventarios, ventas y roles de usuario de manera eficiente.

---

## 🏛️ Información Académica

* **Institución:** Instituto Politécnico Nacional
* **Unidad Académica:** Escuela Superior de Cómputo (ESCOM)
* **Unidad de Aprendizaje:** Bases de Datos
* **Grupo:** 3CV4
* **Profesor Titular:** Gabriel Hurtado Avilés
* **Fecha de Entrega:** 10 de febrero de 2026

**Desarrolladores:**

* Rodríguez Martínez José
* Rosales Juárez Alexis

---

## 🛠️ Arquitectura y Stack Tecnológico

El sistema utiliza una arquitectura de cliente-servidor desacoplada:

| Componente | Tecnología | Función |
| --- | --- | --- |
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla) | Interfaz de usuario dinámica y gestión de estados. |
| **Backend** | Node.js / Express | API REST encargada de la lógica de negocio y peticiones. |
| **Base de Datos** | PostgreSQL (vía Supabase) | Almacenamiento relacional de productos, clientes y ventas. |
| **Hosting** | GitHub Pages & Render | Despliegue de la interfaz y el servidor respectivamente. |
|[Diagrama de Base de Datos](./DER.png)|


---

## 🏗️ Gestión de Datos y Backend

Para mantener la integridad y la organización del proyecto, la gestión de la base de datos se realiza bajo las siguientes premisas técnicas:

* **API RESTful:** La comunicación entre la página y la base de datos se realiza exclusivamente a través de un servidor intermedio. El frontend solicita información y el servidor procesa las consultas.
* **Aislamiento de Credenciales:** Por diseño del sistema, las claves de conexión y configuraciones sensibles de la base de datos no residen en este repositorio público. Toda la configuración del motor de la base de datos se gestiona de forma aislada en el repositorio privado del backend.
* **Persistencia:** Se utiliza un modelo relacional normalizado para garantizar que las existencias (stock) y el historial de ventas se mantengan consistentes en cada transacción.

---

## 🧩 Configuración de Supabase

Para conectar el frontend con Supabase debes reemplazar los valores de configuración en `login.html` y `cliente-publico.html`:

* `window.SUPABASE_URL`
* `window.SUPABASE_ANON_KEY`

El archivo `supabase-schema.sql` contiene el script para:

* agregar la columna `password` en la tabla `trabajadores`
* crear la tabla `ventas` si no existe

> En producción, usa siempre contraseñas hasheadas en lugar de texto plano.

---

## 🌐 Despliegue

La aplicación está disponible para su ejecución en el siguiente enlace:
👉 [https://jorvsk2007.github.io](https://jorvsk2007.github.io)



## Repositorio general de proyectos
👉 [https://jorvsk2007.github.io](https://github.com/gabrielhuav/DB-Coursework-2026-2)

---
