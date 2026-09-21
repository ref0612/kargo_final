# KARGO — mockup funcional

Mockup navegable de **todo el flujo**: el merchant crea una encomienda desde el celular y esta recorre la cadena de custodia completa (coordinador → operador → recolección → bodega → bus → entrega) con escaneo por bulto, firma y registro de eventos.

**No hay backend.** Es un mockup: los datos salen de `data/*.json` y el estado de la demo vive en el `localStorage` del navegador. El backend y la base de datos los construye el equipo de desarrollo; este repo les entrega el contrato (JSON + reglas ejecutables + tests).

## Correrlo

Requiere Node 18+ (sin instalar nada más).

```bash
npm start
```

Abrir **http://localhost:3000** (idealmente en el celular o con el navegador en modo móvil). Alternativa sin Node: `python -m http.server 3000` desde la raíz y abrir `http://localhost:3000/web/`.

> `npm start` es solo un servidor de archivos estáticos: los navegadores bloquean leer los JSON desde un archivo suelto.

## Cómo presentarlo (guion de 3 minutos)

Arriba hay un selector **"Ver como"** para cambiar de usuario sin login. Cada orden muestra **"Siguiente: <persona>"** con un botón para saltar a esa persona.

1. **Carla (Merchant)** → `＋ Nueva`: bodega de origen/destino, 2 personas autorizadas por punto (RUT validado), bultos (con "Duplicar") → *Crear orden* → etiquetas imprimibles.
2. **Andrés (Coordinador)** → asigna la orden a un operador.
3. **Patricia (Despachador)** → designa conductor y móvil.
4. **Héctor (Conductor de recolección)** → escanea cada bulto ("Escanear todos (demo)" si no hay lector), elige la persona autorizada, confirma que vio la cédula y firma.
5. **Camila (Bodega operador)** → escanea el ingreso y asigna bus/servicio.
6. **Jorge (Conductor de bus)** → escanea la carga.
7. **Felipe (Conductor de entrega)** → escanea en destino y recibe la firma.
8. Vuelve a **Carla**: ve el avance simplificado (5 estados), las firmas y el registro de eventos.

Cosas para probar: registro **manual** de un bulto con motivo, RUT inválido, menos de 2 autorizados, un conductor que intenta escanear el trabajo de otro, agregar una bodega nueva. **Reiniciar demo** (arriba a la derecha) vuelve a los datos iniciales.

## Estructura

```
web/          index.html · app.js (UI por rol) · store.js (reglas) · style.css
data/         Contrato de datos: merchants, users, operators, roles, orders, packages, tracking_events, invoices
scripts/      seed.js  → regenera data/ (npm run seed)
test/         flow.test.js → cadena completa + permisos + validaciones (npm test)
serve.js      servidor estático (sin API)
docs/         Especificación: visión, roles y cadena de custodia, flujo del merchant, modelo de datos, decisiones abiertas
deliverables/ PDF en inglés para el consultor logístico
graphify-out/ Grafo de conocimiento de la especificación (graph.html)
```

## Para el equipo de backend

- **`web/store.js` es la especificación ejecutable**: máquina de estados, permisos por rol, validaciones (RUT, ≥2 autorizados por punto, bultos, escaneo completo antes de confirmar, firma solo en recolección y entrega). El servidor real debe hacer cumplir lo mismo; `test/flow.test.js` describe el comportamiento esperado.
- **Contrato de datos**: `data/*.json` (claves en español, tal como lo definió el brief). `timeline` de la orden y `scan_history` del bulto son vistas derivadas del log `tracking_events`.
- **Estados internos (8)**: `creada → asignada_operador → recoleccion_asignada → recolectada → en_bodega_operador → asignada_transporte → cargada_bus → entregada`. El merchant solo ve 5.

## Qué es de mentira en el mockup

| Mockup | Sistema real |
|---|---|
| Sin login; el usuario se elige de una lista | Autenticación y sesiones |
| Estado en `localStorage` | Base de datos, concurrencia, auditoría inmutable |
| Firma guardada como data URL dentro del JSON | Subir el archivo y guardar su URL |
| Escaneo por teclado/botón (un lector USB actúa como teclado) | Cámara del teléfono (BarcodeDetector / librería) |
| Etiquetas Code 39 | QR / Code128 generado por el backend |
| Motivo del registro manual con `prompt()` | Formulario con códigos de motivo + revisión |

## Fuera de alcance (por ahora)

- **Facturación**: en pausa por definición del negocio (`data/invoices.json` vacío a propósito).
- Carga masiva CSV, incidencias, devoluciones, reportes/SLA (fases 5–6 del roadmap).
- Decisiones abiertas para el consultor: ver `docs/05-open-decisions.md`.
