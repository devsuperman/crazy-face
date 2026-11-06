/** Todos os textos engraçados num lugar só, para ficar fácil adicionar mais. */


export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Dica no rodapé, sorteada a cada vez que a página abre. */
export const HINTS = [
  'Arraste a cara para esticar. Toque em 📸 Nova foto para trocar.',
  'Arraste para esticar. Efeito colateral: crise de riso.',
  'Puxe a cara à vontade. Nenhum rosto foi ferido neste app.',
  'Estica e puxa. Seu cirurgião plástico odeia esse truque.',
  'Arraste para amassar. Tira uma foto do chefe (a gente não conta).',
  'Pode esticar! Não vale para foto de RG.',
  'Arraste a cara. Chacoalhe o celular para tremer mais.',
  'Puxa, amassa, repete. Estrague a cara de alguém (com carinho).',
  'Foto torta ou com muita sobra? ✂️ Recortar resolve.',
];

/** Balão de fala quando você puxa demais. */
export const OUCH_LINES = ['AI!', 'EI!', 'CALMA!', 'MEU ROSTO!', 'MEU NARIZ!', 'SOCORRO!', 'GROSSO!', 'PARA!'];

/** Texto que vai junto com a foto no WhatsApp. */
export const SHARE_TEXTS = [
  'Olha o que eu fiz com essa cara! 🤪',
  'Ficou melhor que a original, né? 😂',
  'Manda pro grupo da família! 🤪',
  'Não me pergunte o que aconteceu com essa cara. 😂',
];

/** Quando a foto tem mais de um rosto. `{n}` vira o número de rostos. */
export const GROUP_SUGGEST_HINTS = [
  'Achei {n} rostos! Os efeitos pegam todo mundo. 😈',
  '{n} vítimas na foto! 😈 Aperta um efeito e ninguém escapa.',
  'Foto em grupo? Achei {n} rostos. Toca em 🎭 e cada um ganha o seu!',
];

/** 🎉 Sextou: o adesivo de sexta-feira (o texto vai desenhado no adesivo). */
export const FRIDAY_STICKERS = ['SEXTOU! 🎉', 'SEXTOOOU! 🥳', 'É SEXTA! 🍻', 'SEXTOU 😎'];
/** A dica da primeira foto numa sexta. */
export const FRIDAY_HINTS = [
  'Sextou! 🎉 Arraste o adesivo, faça pinça para girar e toque nele.',
  'É sexta! 🥳 Mude o adesivo de lugar ou toque nele pra festa.',
];
