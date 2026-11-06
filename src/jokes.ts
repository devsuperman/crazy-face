/** Todos os textos engraçados num lugar só, para ficar fácil adicionar mais. */

import type { EffectKind } from './warp';

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

/** Desafio de pose na câmera: a pose pedida e o efeito que toca logo depois da foto. */
export interface PoseChallenge {
  prompt: string;
  effect: EffectKind;
}

export const POSE_CHALLENGES: readonly PoseChallenge[] = [
  { prompt: 'Todo mundo com cara de quem viu o boleto! 💸', effect: 'melt' },
  { prompt: 'Cara de surpresa no amigo secreto! 🎁', effect: 'balloon' },
  { prompt: 'Pose de capa de disco de pagode! 🎤', effect: 'fish' },
  { prompt: 'Biquinho de selfie no espelho da academia! 💪', effect: 'fish' },
  { prompt: 'Cara de quem acordou atrasado pra prova! ⏰', effect: 'balloon' },
  { prompt: 'Cara de quem mordeu uma pimenta escondida! 🌶️', effect: 'balloon' },
  { prompt: 'Cara de quem ouviu "a gente precisa conversar"! 😬', effect: 'melt' },
  { prompt: 'Cara de tio dançando no casamento! 🕺', effect: 'melt' },
  { prompt: 'Cara de quem viu o ex no rolê! 👀', effect: 'fish' },
  { prompt: 'Cara de quem chegou no churrasco e só tinha salada! 🥗', effect: 'melt' },
  { prompt: 'Cara de quem viu o preço da gasolina! ⛽', effect: 'eyes' },
  { prompt: 'Cara de quem sentiu cheiro de bolo saindo do forno! 🎂', effect: 'nose' },
  { prompt: 'Cara de fofoqueiro na janela! 🪟', effect: 'eyes' },
  { prompt: 'Enche as bochechas de ar! 🐹', effect: 'cheeks' },
];

/** Quando a foto tem mais de um rosto. `{n}` vira o número de rostos. */
export const GROUP_SUGGEST_HINTS = [
  'Achei {n} rostos! Os efeitos pegam todo mundo. 😈',
  '{n} vítimas na foto! 😈 Aperta um efeito e ninguém escapa.',
  'Foto em grupo? Achei {n} rostos. Toca em 🎭 e cada um ganha o seu!',
];
