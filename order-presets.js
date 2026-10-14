// Liste per il minigioco "📋 Metti in ordine" (menu Minigioco nell'admin).
// Ogni lista ha uno o più ordini validi (dal primo all'ultimo): ognuno porta a una strada diversa.
// Gli ordini devono contenere gli stessi elementi. Qualsiasi altro ordine = Bad News.

const ORDER_PRESETS = {
  'piatti-preferiti': {
    name: 'Piatti preferiti',
    hint: 'Dal migliore (in alto) al peggiore (in basso)',
    orders: {
      lei: {
        label: 'Ordine di lei',
        items: [
          'Ricciola frollata',
          'Linguine Seppia',
          'Scampo e granchio',
          'Finto sushi ventresca tonno',
          'Pina Colada magica',
          'Porro alla cenere',
          'Pane e Nutella'
        ]
      },
      tuo: {
        label: 'Il tuo ordine',
        items: [
          'Ricciola frollata',
          'Pane e Nutella',
          'Scampo e granchio',
          'Linguine Seppia',
          'Pina Colada magica',
          'Porro alla cenere',
          'Finto sushi ventresca tonno'
        ]
      }
    }
  }
};
