// Plantilla del recorrido. Compila todos los targets en el mismo archivo .mind.
// El orden de esta lista debe coincidir con el orden de las imágenes al compilar.
window.WORKPLACE_CONTENT = {
  mind: './assets/recorrido.mind',
  targets: [
    {
      id: 'termica', label: 'Tablero eléctrico · Seguridad', title: 'SEGURIDAD',
      lines: ['Tablero eléctrico', 'Riesgo eléctrico', 'Solo personal autorizado', 'No abrir el tablero'],
      footer: 'CLAROLAB · JUNÍN', accent: '#ffc247', background: '#17130b', visual: 'safety'
    },
    {
      id: 'cuadros_color', label: 'Cuadros de colores · Diseño', title: 'DISEÑO',
      lines: ['Texturas y color', 'Materiales en capas', 'Explorá sus combinaciones', 'Ideas para cada espacio'],
      footer: 'CLAROLAB · JUNÍN', accent: '#ff5c9b', background: '#140d16', visual: 'palette'
    }
  ]
};
