# KARGO — mockup funcional

Mockup navegable de **todo el flujo**: el merchant crea una encomienda desde el celular y esta recorre la cadena de custodia completa (coordinador → operador → recolección → bodega → bus → entrega) con escaneo por bulto, firma y registro de eventos.

**No hay backend.** Es un mockup: los datos salen de `web/data/*.json` y el estado de la demo vive en el `localStorage` del navegador. El backend y la base de datos los construye el equipo de desarrollo; este repo les entrega el contrato (JSON + reglas ejecutables + tests).

## Correrlo

Requiere Node 18+ (sin instalar nada más).

```bash
npm start
```

Abrir **http://localhost:3000** (idealmente en el celular o con el navegador en modo móvil). Alternativa sin Node: `python -m http.server 3000` desde `web/` y abrir `http://localhost:3000`.

> `npm start` es solo un servidor de archivos estáticos: los navegadores bloquean leer los JSON desde un archivo suelto.

## Desplegar (Vercel, Netlify, GitHub Pages…)

Es un sitio 100 % estático: publica la carpeta **`web/`** como raíz (en Vercel: *Framework Preset* "Other", *Build Command* vacío, *Output Directory* `web`). No necesita build ni variables de entorno; los JSON viajan dentro de `web/data/`.

## Controles de la demo (barra superior)

| Control | Qué hace |
|---|---|
| **Ver como** | Cambia de usuario sin login (9 roles, 2 operadores). |
| **ES / EN** | Cambia todo el idioma de la interfaz al instante. |
| **Móvil / Escritorio** | Móvil = marco de teléfono con barra inferior; Escritorio = panel completo con menú lateral, mapa de rutas y resumen. Bajo 700 px de pantalla real siempre es móvil. |
| **Reiniciar demo** | Vuelve a los datos de `web/data/`. |

Las preferencias se guardan. Enlaces directos para presentar: `http://localhost:3000/?as=usr_210&lang=en&view=mobile#/order/ot_00007` (`as` = id de usuario de `web/data/users.json`; agrega `&still=1` para desactivar animaciones al sacar capturas).

## Cómo presentarlo (guion de 5 minutos)

Cada orden muestra **"Siguiente: <persona>"** con un botón para saltar a esa persona. El seed deja 10 órdenes en distintos estados (ver `docs/` y la guía en `deliverables/`).

1. **Carla (Merchant)** → `＋ Nueva`: bodegas, 2 autorizados por punto (RUT validado), MPO opcional, bultos → *Crear orden* → etiquetas.
2. **Andrés (Coordinador / Control Tower)** → asigna a un operador **eligiendo la última milla** (con el operador o retiro del destinatario).
3. **Patricia (Despachador)** → **acepta o rechaza** (rechazo con motivo: vuelve al coordinador) → designa conductor y móvil.
4. **Héctor (Conductor de recolección)** → puede **cambiar la cantidad de bultos** (motivo obligatorio, etiquetas nuevas), escanea, elige la persona autorizada, verifica RUT y **firma (obligatoria)**.
5. **Camila (Bodega operador)** → escanea el ingreso y asigna el **bus con sugerencia de la parrilla** (más de 2 h = riesgo).
6. **Jorge (Conductor de bus)** → escanea la carga.
7. **Camila (bodega destino)** → escanea el ingreso a destino. Según la modalidad: **Patricia designa la última milla** (Felipe entrega con escaneo y firma) o **Camila marca "lista para retiro"** y entrega al destinatario con escaneo y firma.
8. **Carla**: ve el avance de 5 estados, el aviso de retiro, las firmas, las diferencias de conteo y las incidencias.
9. Torre de control (KPIs y órdenes en riesgo), **Valentina (Auditoría)** conciliación por checkpoint, **Diego (Finanzas)** envíos por cliente y período con CSV, y en Coordinador: **Merchants** (alta por el KAM) y **Operadores** (importar desde Konnect).

Enlace de ejemplo: `http://localhost:3000/?as=usr_210&lang=es&view=mobile#/order/ot_00007` (Héctor con su recolección pendiente). **Reiniciar demo** vuelve a los datos iniciales.

## Estructura

```
web/          Sitio estático autocontenido (esta carpeta es lo que se despliega): index.html · app.js (UI por rol) · store.js (reglas) · i18n.js (ES/EN) · style.css
web/data/     Contrato de datos: merchants, users, operators, konnect, roles, orders, packages, tracking_events, incidents, config, invoices
scripts/      seed.js  → regenera web/data/ (npm run seed)
test/         flow.test.js → cadena completa + permisos + validaciones (npm test)
serve.js      servidor estático (sin API)
docs/         Especificación: visión, roles y cadena de custodia, flujo del merchant, modelo de datos, decisiones abiertas
deliverables/ PDF en inglés para el consultor logístico
graphify-out/ Grafo de conocimiento de la especificación (graph.html)
```

## Para el equipo de backend

- **`web/store.js` es la especificación ejecutable**: máquina de estados, permisos por rol, validaciones (RUT, ≥2 autorizados por punto, bultos, aceptación del despachador, ajuste de cantidad con motivo, ventana de bus de 2 h, escaneo completo antes de confirmar, firma en recolección y entrega, KPIs). El servidor real debe hacer cumplir lo mismo; `test/flow.test.js` describe el comportamiento esperado.
- **Contrato de datos**: `web/data/*.json` (claves en español, tal como lo definió el brief). `timeline` de la orden y `scan_history` del bulto son vistas derivadas del log `tracking_events`.
- **Estados internos (11)**: `creada → asignada_operador → aceptada → recoleccion_asignada → recolectada → en_bodega_operador → asignada_transporte → cargada_bus → en_bodega_destino → (ultima_milla_asignada | lista_retiro) → entregada`. El merchant solo ve 5.

## Qué es de mentira en el mockup

| Mockup | Sistema real |
|---|---|
| Sin login; el usuario se elige de una lista | Autenticación y sesiones |
| Estado en `localStorage` | Base de datos, concurrencia, auditoría inmutable |
| Firma guardada como data URL dentro del JSON | Subir el archivo y guardar su URL |
| Escaneo por teclado/botón (un lector USB actúa como teclado) | Cámara del teléfono (BarcodeDetector / librería) |
| Etiquetas Code 39 e impresora portátil simulada | QR / DataMatrix generado por el backend + impresora Bluetooth |
| Onboarding de operadores con un catálogo `konnect.json` | Prefetch real desde la base de datos de Konnect |
| Sugerencia de bus con la hora del navegador | Reloj y parrilla del servidor, zona horaria de Chile |
| KPIs calculados en el navegador | Cálculo en el backend / BI sobre el registro de eventos |
| Mapa de rutas = esquema SVG de Chile (no geográfico exacto) | Mapa real con posición GPS del bus |
| Fuentes Fira desde Google Fonts (sin internet cae a la fuente del sistema) | Autoalojar las fuentes |
| Motivo del registro manual con `prompt()` | Formulario con códigos de motivo + revisión |

## Fuera de alcance (por ahora)

- **Facturación**: en pausa por definición del negocio (`web/data/invoices.json` vacío a propósito).
- Terceros para la última milla, integración GPS real, impresora portátil real, carga masiva CSV, devoluciones (ver `docs/05-open-decisions.md`).
- Decisiones abiertas para el consultor: ver `docs/05-open-decisions.md`.
