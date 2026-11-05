/** Todos os textos engraçados num lugar só, para ficar fácil adicionar mais. */

import type { EffectKind } from './warp';

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Dica no rodapé, sorteada a cada vez que a página abre. */
export const HINTS = [
  'Arraste a cara para esticar. Tire uma foto ou envie a sua.',
  'Arraste para esticar. Efeito colateral: crise de riso.',
  'Puxe a cara à vontade. Nenhum rosto foi ferido neste app.',
  'Estica e puxa. Seu cirurgião plástico odeia esse truque.',
  'Arraste para amassar. Tira uma foto do chefe (a gente não conta).',
  'Pode esticar! Não vale para foto de RG.',
  'Arraste a cara. Chacoalhe o celular para tremer mais.',
  'Puxa, amassa, repete. Estrague a cara de alguém (com carinho).',
];

/** Depois de uma esticada média. */
export const MEDIUM_CAPTIONS = [
  'Ficou ótimo! 😬',
  'Foto de RG aprovada ✅',
  'Sua mãe ficaria orgulhosa.',
  'Segunda-feira, 7h da manhã.',
  'Foto de perfil nova!',
  'Tá tudo bem. 🙂',
  'Eu fingindo que entendi a reunião.',
  'Cara de quem viu o boleto.',
  'Beleza nível máximo.',
];

/** Depois de uma esticada enorme. */
export const BIG_CAPTIONS = [
  'A ciência foi longe demais. 🧪',
  'Chama o SAMU!',
  'Isso não é um rosto, é arte moderna.',
  'Agora você tá sendo malvado.',
  'Somos obrigados por lei a dizer: uau.',
  'Conquista desbloqueada: Cara de Miojo 🍜',
  'Espelho, espelho meu… melhor não.',
  'Até a mola cansou.',
];

/** Balão de fala quando você puxa demais. */
export const OUCH_LINES = ['AI!', 'EI!', 'CALMA!', 'MEU ROSTO!', 'MEU NARIZ!', 'SOCORRO!', 'GROSSO!', 'PARA!'];

/** Logo depois de tirar uma foto. */
export const PHOTO_CAPTIONS = ['Xiiis! 📸', 'Que beleza… por enquanto. 😈', 'Agora começa a diversão!', 'Foto linda. Vamos estragar?'];

/** Modo turma: o que a roleta diz para quem foi sorteado. */
export const ROULETTE_CAPTIONS = [
  'Quem paga a pizza é você! 🍕',
  'Hoje a louça é sua! 🧽',
  'O destino escolheu… você! 🫵',
  'Parabéns, você pagou o mico! 🐒',
  'Próxima rodada é por sua conta! 🍻',
  'Você foi eleito o mais bonito. Era mentira. 😈',
  'Sorteado para contar a piada do pavê! 🍰',
];

/** Modo turma: quando cada um ganha um efeito diferente. */
export const EVERYONE_CAPTIONS = [
  'Cada um com seu estilo! 🎭',
  'Foto de família para o Natal! 🎄',
  'A turma toda reunida. Infelizmente. 😂',
  'Essa vai pro grupo da família!',
];

/** Legendas de cada botão de efeito. */
export const EFFECT_CAPTIONS = {
  balloon: ['Cabeção? Eu? 🎈', 'Ego inflado hoje.', 'Enche que cabe!'],
  fish: ['Blub blub. 🐟', 'Tem algo cheirando a peixe…', 'Biquinho de selfie: máximo.'],
  twist: ['Uhuuul! 🌀', 'Já ficou tonto?', 'Reviravolta!'],
  melt: ['Tá calor aqui? 🫠', 'Eu no verão do Rio.', 'Derretendo… derretendo…'],
  chaos: ['Modo caos! 🎲', 'Agora ninguém conserta.', 'O que você FEZ?'],
  jelly: ['Modo gelatina: ligado. 🍮', 'Treme, treme.'],
  shake: ['Terremoto! 📳', 'Chacoalha!'],
} as const;

/** Quando começa a gravar um vídeo. */
export const RECORD_CAPTIONS = [
  'Gravando! Capricha na careta. 🎬',
  'Luz, câmera… careta! 🎬',
  'Isso vai direto pro grupo da família. 📲',
  'Gravando! Depois não adianta pedir pra apagar. 😈',
];

/** Desafio de pose na câmera: a pose pedida e o efeito que toca logo depois da foto. */
export interface PoseChallenge {
  prompt: string;
  effect: EffectKind | 'chaos';
  caption: string;
}

export const POSE_CHALLENGES: readonly PoseChallenge[] = [
  { prompt: 'Todo mundo com cara de quem viu o boleto! 💸', effect: 'melt', caption: 'O boleto venceu. Você também. 🫠' },
  { prompt: 'Cara de surpresa no amigo secreto! 🎁', effect: 'balloon', caption: 'Ganhou meia de novo! 🧦' },
  { prompt: 'Pose de capa de disco de pagode! 🎤', effect: 'twist', caption: 'Sucesso nas paradas de 1998! 💿' },
  { prompt: 'Biquinho de selfie no espelho da academia! 💪', effect: 'fish', caption: 'Foco, força e biquinho. 🐟' },
  { prompt: 'Cara de quem acordou atrasado pra prova! ⏰', effect: 'chaos', caption: 'Nem a cara chegou a tempo. 🎲' },
  { prompt: 'Cara de quem mordeu uma pimenta escondida! 🌶️', effect: 'balloon', caption: 'Inchou de tanto arder! 🔥' },
  { prompt: 'Cara de quem ouviu "a gente precisa conversar"! 😬', effect: 'melt', caption: 'Derreteu de nervoso. 🫠' },
  { prompt: 'Cara de tio dançando no casamento! 🕺', effect: 'twist', caption: 'O tio rodou a pista toda! 🌀' },
  { prompt: 'Cara de quem viu o ex no rolê! 👀', effect: 'fish', caption: 'Blub… finge que não viu. 🐟' },
  { prompt: 'Cara de quem chegou no churrasco e só tinha salada! 🥗', effect: 'melt', caption: 'Cadê a picanha?! 🥩' },
];
