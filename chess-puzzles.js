// Puzzle di scacchi disponibili nell'admin (blocco "♟ Scacchi").
// Ogni puzzle è verificato: a ogni passo c'è una sola mossa vincente
// e le risposte dell'avversario sono obbligate.
//
// moves: sequenza in notazione inglese (SAN), alternando giocatore e avversario.
// Nell'ultima mossa il gioco accetta qualsiasi scacco matto.

const CHESS_PUZZLES = {
  'matto-1': {
    name: 'Facile — matto in 1',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    moves: ['Rd8#']
  },
  'matto-affogato': {
    name: 'Medio — matto in 2',
    fen: 'r6k/6pp/7N/8/8/1Q6/6PP/6K1 w - - 0 1',
    moves: ['Qg8+', 'Rxg8', 'Nf7#']
  },
  'matto-anastasia': {
    name: 'Difficile — matto in 3',
    fen: '5rk1/pp3ppp/8/3R1N1Q/8/8/PPP2PPP/6K1 w - - 0 1',
    moves: ['Ne7+', 'Kh8', 'Qxh7+', 'Kxh7', 'Rh5#']
  }
};
