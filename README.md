# Guía del recorrido AR de Clarolab

Esta guía explica qué hace cada archivo y cómo se conectan las dos pantallas. Está pensada para poder leer el proyecto sin conocer A-Frame o MindAR de antemano.

## Qué hace la web

1. `index.html` muestra la portada “Tour of the offices”. El GIF es un enlace: al tocarlo, abre `workplace.html`.
2. En `workplace.html`, el usuario pulsa **Comenzar el recorrido**. En ese momento el navegador solicita permiso para usar la cámara.
3. El recorrido carga un `.mind` a la vez. Al reconocer uno de sus carteles, muestra la información de esa estación; cuando se deja el cartel o pasa el tiempo de espera, avanza a la estación siguiente con la cámara activa.
4. El botón **×** detiene el escáner y vuelve a la pantalla de bienvenida. También se puede cerrar con la tecla Escape.

El GIF de la portada no lee un QR. Es una ayuda visual y un acceso táctil a la segunda pantalla. Para que el QR impreso en la entrada funcione, su contenido debe ser la dirección pública de `workplace.html` una vez publicado el sitio.

## Archivos principales

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Portada y enlace al recorrido. |
| `tour.css` | Apariencia y adaptación a distintos tamaños de pantalla de la portada. |
| `workplace.html` | Bienvenida, escena de A-Frame, tarjeta AR y controles del escáner. |
| `workplace.css` | Diseño de la bienvenida y de la interfaz que aparece sobre la cámara. |
| `workplace.js` | Inicio y cierre de cámara, reconocimiento del marcador y construcción del fondo de la tarjeta AR. |
| `workplace-content.js` | Orden de las estaciones, archivo `.mind` independiente y tarjeta correspondiente a cada una. |
| `assets/targets_entrada.mind` | Marcador independiente de la entrada (4 imágenes internas). |
| `assets/targets_ofi2.mind` | Marcador independiente de la oficina 2 (3 imágenes internas). |
| `assets/targets_ofiFran.mind` | Marcador independiente de la oficina de Fran (4 imágenes internas). |
| `assets/termica.mind`, `assets/cuadros_color.mind` | Marcadores independientes de tablero y ambiente de oficina. |
| `assets/termica.jpg`, `assets/cuadrados_color.jpg` | Fotos originales que deben mostrarse a la cámara. |
| `assets/qr-scan.gif` | Animación del escáner en la portada y en la pantalla de cámara. |
| `assets/ars_scan.svg` | Ilustración vectorial de la pantalla de bienvenida. |
| `assets/Clarolab.svg` | Logo vectorial disponible en los recursos. Las páginas actuales no lo cargan directamente. |

## Cómo se conectan HTML, CSS y JavaScript

### Portada: `index.html` y `tour.css`

En el HTML están el título, el texto y el enlace que contiene el GIF. El CSS coloca esas piezas en un lienzo vertical y ajusta tamaños y posiciones según la pantalla.

- `.welcome-screen` ocupa el alto visible del dispositivo.
- `.welcome-art` define el área de la portada.
- `.poster-copy` agrupa el título y la descripción.
- `.scan-entry` posiciona el GIF y lo convierte en un enlace a `workplace.html`.
- Las reglas `@media` adaptan el diseño a teléfonos, pantallas anchas y orientación horizontal.
- `prefers-reduced-motion` evita desplazamientos animados innecesarios para quienes reducen el movimiento en su sistema.

El GIF se mezcla visualmente con el fondo oscuro mediante `mix-blend-mode: screen`; por eso las zonas negras del GIF no forman un rectángulo opaco.

### Pantalla del recorrido: `workplace.html`

La página contiene dos capas principales:

- `welcomePanel`: bienvenida, botón de inicio e ilustración.
- `scanPanel`: escena AR y controles de cámara.

`workplace.js` crea los objetivos del `.mind` de la estación actual. Sus índices son locales a ese archivo. Cada estación tiene una tarjeta propia definida en `workplace-content.js`; al cambiar de estación se descartan sus objetivos y se cargan los del archivo siguiente.

Cada objetivo recibe una tarjeta 3D con su título, cuatro líneas y pie. Los valores se generan desde la entrada correspondiente de `workplace-content.js`.

`workplace-content.js` define el orden del recorrido y relaciona cada archivo `.mind` con su tarjeta. Solo se analiza una estación a la vez. También se cargan dos bibliotecas desde Internet:

- **A-Frame 1.5.0** crea la escena 3D que se superpone a la cámara.
- **MindAR 1.2.5** obtiene la cámara y busca la imagen objetivo.

Los scripts de estas bibliotecas aparecen antes de `workplace.js` para que el código del proyecto pueda usar A-Frame y MindAR. `workplace.js` tiene `defer`: espera a que el HTML esté leído antes de buscar botones y elementos por sus `id`.

### Diseño: `workplace.css`

Este archivo controla la bienvenida, los botones, la tarjeta de estado y el visor.

- `.welcome-panel` distribuye la bienvenida en columnas en pantallas grandes y en una columna en teléfonos.
- `.scan-panel` contiene la escena AR. Se mantiene en el documento desde el inicio, pero invisible y sin recibir toques hasta añadirle `is-visible`. Esto permite que A-Frame termine de inicializarse antes de abrir la cámara.
- `.scan-hud` es la capa de controles dibujada sobre el visor.
- `.finder` y sus elementos `span` crean las cuatro esquinas verdes y la línea de lectura con CSS.
- `.close-button` queda habilitado para recibir toques aunque el resto del HUD no intercepte gestos de la cámara.
- Las reglas para pantallas estrechas, teléfonos pequeños y orientación horizontal organizan el contenido sin desbordarlo.
- `env(safe-area-inset-*)` deja espacio para la cámara frontal, la barra del sistema y las esquinas redondeadas de algunos teléfonos.

## Qué hace `workplace.js`

El archivo está envuelto en una función inmediata `(() => { ... })()`. Así, sus variables quedan dentro de este archivo y no se mezclan con las de A-Frame ni con las del navegador.

### Elementos y estados

Al principio, el código guarda referencias a los botones, paneles, escena, objetivo y mensaje de estado. También mantiene cuatro indicadores:

- `active`: la cámara y el escáner ya están funcionando.
- `starting`: el inicio todavía está en curso; evita abrir dos escáneres a la vez.
- `closeRequested`: el usuario pidió salir mientras la cámara se estaba iniciando.
- `detectedTargets`: objetivos del `.mind` de la estación actual que MindAR mantiene a la vista.

`cardBackgroundReady` evita dibujar dos veces el fondo de cada tarjeta.

### Funciones

- **`drawOfficeCard()`** dibuja el panel 3D detrás del texto. Usa `THREE.Shape`, `ShapeGeometry` y `MeshBasicMaterial`: el color exterior y el fondo cambian según cada oficina. `addOfficeVisual()` agrega el símbolo de seguridad o las muestras de color correspondientes.
- **`setStatus(message)`** cambia el texto que se ve en la parte central del escáner.
- **`showScanner(message)`** oculta la bienvenida, hace visible el visor y muestra el estado inicial.
- **`restoreWelcome()`** oculta el visor, devuelve la bienvenida y enfoca el botón de inicio.
- **`waitForScene()`** espera el evento `loaded` de A-Frame. Si la escena no queda lista en diez segundos, devuelve un error en vez de dejar la pantalla esperando para siempre.
- **`openAR()`** valida el acceso a la cámara, espera a que la escena esté lista, dibuja el fondo del panel, conecta el archivo `.mind` con MindAR y arranca la cámara. También actualiza el mensaje cuando la foto se encuentra, se pierde o MindAR devuelve un error.
- **`closeAR()`** cierra la cámara, retira el componente `mindar-image` y vuelve a la bienvenida. Si el cierre ocurre durante el inicio, marca la solicitud para que la limpieza se complete al terminar esa operación.

Los eventos `targetFound` y `targetLost` se disparan en cada objetivo. El primero indica que la imagen entró en cámara; el segundo, que dejó de verse. `arReady` y `arError` pertenecen al sistema MindAR.

### Recorrido de inicio

Al pulsar el botón, `openAR()` carga el `.mind` de la primera estación y abre la cámara. Cuando el cartel sale del visor, el código carga el próximo archivo en el mismo flujo de cámara. Si no se encuentra un cartel, cambia de estación después del tiempo de espera.

`requestAnimationFrame` da dos ciclos al navegador para procesar los cambios de A-Frame antes de pedir el sistema MindAR. El bloque `finally` siempre libera el estado de “iniciando”. Si mientras tanto se pidió cerrar, detiene el sistema y quita el componente AR.

Los ajustes `filterMinCF`, `filterBeta`, `warmupTolerance` y `missTolerance` controlan el filtrado y la estabilidad del seguimiento. `maxTrack: 1` limita el seguimiento a un cartel por vez.

## Estaciones y marcadores

Cada estación mantiene su propio `.mind`; no se fusionan dentro de un archivo `recorrido.mind`. Los archivos de entrada, oficina 2, oficina de Fran, tablero y cuadros se cargan secuencialmente en el orden de `workplace-content.js`. Si el usuario deja de enfocar un cartel, el escáner avanza a la estación siguiente manteniendo la cámara encendida. Si no detecta nada, avanza luego de 30 segundos.

## Plantilla para agregar o actualizar una estación

1. Coloca el `.mind` independiente en `assets` y añade una entrada a `groups` en `workplace-content.js` con su ruta, cantidad de imágenes internas y tarjeta.
2. Conserva el orden en que quieres recorrer las estaciones. Cada objetivo interno de un mismo `.mind` muestra la tarjeta de ese archivo.
3. Edita el título, las cuatro líneas, el pie, los colores y el motivo visual.

No hace falta compilar ni reemplazar un `.mind` conjunto. Para actualizar una estación, reemplaza únicamente su `.mind` y su texto.
## Cómo abrirlo para usar la cámara

La cámara normalmente requiere un contexto seguro. Abre el sitio desde `localhost` durante el desarrollo o publícalo con HTTPS; abrir el HTML directamente desde una carpeta (`file://`) puede bloquear permisos o la carga del marcador. También se necesita conexión a Internet para descargar A-Frame y MindAR.

Para levantar un servidor local desde la carpeta del proyecto, ejecuta:

```powershell
python -m http.server 8000
```

Después abre `http://localhost:8000/` en el navegador. En el teléfono, el sitio publicado debe usar HTTPS. Al iniciar el recorrido, permite el acceso a la cámara y apunta a la misma foto usada para compilar el marcador.

## Alcance actual

Esta versión recorre cinco archivos `.mind` independientes, de a uno por vez. La entrada presenta Clarolab; la oficina 2 cuenta la experiencia de pasantías y el ambiente del equipo; la oficina de Fran agradece el espacio y el acompañamiento. El tablero y los cuadros tienen tarjetas propias. El GIF de la portada tampoco lee un QR: su enlace simula el acceso hasta publicar la dirección definitiva en el QR físico.
