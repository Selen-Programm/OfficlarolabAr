# Guía del recorrido AR de Clarolab

Esta guía explica qué hace cada archivo y cómo se conectan las dos pantallas. Está pensada para poder leer el proyecto sin conocer A-Frame o MindAR de antemano.

## Qué hace la web

1. `index.html` muestra la portada “Tour of the offices”. El GIF es un enlace: al tocarlo, abre `workplace.html`.
2. En `workplace.html`, el usuario pulsa **Comenzar el recorrido**. En ese momento el navegador solicita permiso para usar la cámara.
3. MindAR busca la foto de la oficina. Cuando la reconoce, muestra sobre ella una tarjeta con el título “OFICINAS” y un mensaje.
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
| `assets/oficina_prueba.png` | Foto original usada para crear el marcador. La web no la muestra como imagen de la interfaz. |
| `assets/oficina_prueba.mind` | Marcador compilado que MindAR usa para reconocer esa foto. |
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

La escena incluye `officeTarget`, que tiene `mindar-image-target="targetIndex: 0"`. Ese índice apunta al primer marcador guardado dentro de `oficina_prueba.mind`.

Dentro del objetivo está `officeMessageCard`, el grupo que se coloca delante de la foto reconocida. Sus elementos `<a-text>` contienen el título, el mensaje y la firma. Si quieres cambiar esas palabras, edita sus atributos `value` en este archivo.

También se cargan dos bibliotecas desde Internet:

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
- `targetFound`: MindAR encontró la foto y todavía la mantiene a la vista.

`cardBackgroundReady` evita dibujar dos veces el fondo de la tarjeta.

### Funciones

- **`drawOfficeCard()`** dibuja el panel 3D detrás del texto. Usa `THREE.Shape`, `ShapeGeometry` y `MeshBasicMaterial`: una forma verde exterior, una forma negra interior y un borde desplazado más tenue. Es geometría creada con JavaScript; no usa un SVG como imagen.
- **`setStatus(message)`** cambia el texto que se ve en la parte central del escáner.
- **`showScanner(message)`** oculta la bienvenida, hace visible el visor y muestra el estado inicial.
- **`restoreWelcome()`** oculta el visor, devuelve la bienvenida y enfoca el botón de inicio.
- **`waitForScene()`** espera el evento `loaded` de A-Frame. Si la escena no queda lista en diez segundos, devuelve un error en vez de dejar la pantalla esperando para siempre.
- **`openAR()`** valida el acceso a la cámara, espera a que la escena esté lista, dibuja el fondo del panel, conecta el archivo `.mind` con MindAR y arranca la cámara. También actualiza el mensaje cuando la foto se encuentra, se pierde o MindAR devuelve un error.
- **`closeAR()`** cierra la cámara, retira el componente `mindar-image` y vuelve a la bienvenida. Si el cierre ocurre durante el inicio, marca la solicitud para que la limpieza se complete al terminar esa operación.

Los eventos `targetFound` y `targetLost` se disparan desde `officeTarget`. El primero indica que la foto entró en cámara; el segundo, que dejó de verse. `arReady` y `arError` pertenecen al sistema MindAR.

### Recorrido de inicio

Al pulsar el botón, `openAR()` verifica que el navegador permita cámara. Luego espera la escena, configura MindAR con `assets/oficina_prueba.mind` y llama a `arSystem.start()`.

`requestAnimationFrame` da dos ciclos al navegador para procesar los cambios de A-Frame antes de pedir el sistema MindAR. El bloque `finally` siempre libera el estado de “iniciando”. Si mientras tanto se pidió cerrar, detiene el sistema y quita el componente AR.

Los ajustes `filterMinCF`, `filterBeta`, `warmupTolerance` y `missTolerance` controlan el filtrado y la estabilidad del seguimiento. `maxTrack: 1` limita esta prueba a un objetivo simultáneo.

## Recursos y marcador

`oficina_prueba.png` es la imagen que debe aparecer ante la cámara. `oficina_prueba.mind` contiene los datos que MindAR calcula para reconocerla; no es otra foto ni se debe editar a mano.

Si reemplazas la foto, hay que compilar un nuevo `.mind`, guardarlo en `assets` y actualizar la ruta `imageTargetSrc` en `workplace.js`. La foto impresa o mostrada en el teléfono debe corresponder a ese marcador.

## Cómo abrirlo para usar la cámara

La cámara normalmente requiere un contexto seguro. Abre el sitio desde `localhost` durante el desarrollo o publícalo con HTTPS; abrir el HTML directamente desde una carpeta (`file://`) puede bloquear permisos o la carga del marcador. También se necesita conexión a Internet para descargar A-Frame y MindAR.

Para levantar un servidor local desde la carpeta del proyecto, ejecuta:

```powershell
python -m http.server 8000
```

Después abre `http://localhost:8000/` en el navegador. En el teléfono, el sitio publicado debe usar HTTPS. Al iniciar el recorrido, permite el acceso a la cámara y apunta a la misma foto usada para compilar el marcador.

## Alcance actual

Esta versión reconoce un solo marcador: la foto de prueba de la oficina. Al detectarla, muestra una tarjeta de bienvenida; todavía no guía al visitante entre todas las salas ni cambia de mensaje según el espacio. El GIF de la portada tampoco lee un QR: su enlace simula el acceso hasta publicar la dirección definitiva en el QR físico.
