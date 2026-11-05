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

/** 🎭 Um efeito pra cada: quando cada rosto ganha um efeito diferente. */
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
  melt: ['Tá calor aqui? 🫠', 'Eu no verão do Rio.', 'Derretendo… derretendo…'],
  eyes: ['Olho grande, hein? 👀', 'Tô de olho em você. 👀', 'Viu o preço do café? 👀', 'Arregalou geral! 👀'],
  nose: ['Esse nariz tem CEP próprio! 👃', 'Fom fom! 👃', 'Mentiu, né? 👃', 'Nariz de quem sentiu cheiro de churrasco. 🍖'],
  cheeks: ['Bochechudo! 🐹', 'Guardou comida pra depois? 🐹', 'Tá segurando o riso, né? 😤', 'Vó apertando a bochecha em 3, 2, 1… 👵'],
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
  effect: EffectKind;
  caption: string;
}

export const POSE_CHALLENGES: readonly PoseChallenge[] = [
  { prompt: 'Todo mundo com cara de quem viu o boleto! 💸', effect: 'melt', caption: 'O boleto venceu. Você também. 🫠' },
  { prompt: 'Cara de surpresa no amigo secreto! 🎁', effect: 'balloon', caption: 'Ganhou meia de novo! 🧦' },
  { prompt: 'Pose de capa de disco de pagode! 🎤', effect: 'fish', caption: 'Sucesso nas paradas de 1998! 💿' },
  { prompt: 'Biquinho de selfie no espelho da academia! 💪', effect: 'fish', caption: 'Foco, força e biquinho. 🐟' },
  { prompt: 'Cara de quem acordou atrasado pra prova! ⏰', effect: 'balloon', caption: 'Nem a cara chegou a tempo. ⏰' },
  { prompt: 'Cara de quem mordeu uma pimenta escondida! 🌶️', effect: 'balloon', caption: 'Inchou de tanto arder! 🔥' },
  { prompt: 'Cara de quem ouviu "a gente precisa conversar"! 😬', effect: 'melt', caption: 'Derreteu de nervoso. 🫠' },
  { prompt: 'Cara de tio dançando no casamento! 🕺', effect: 'melt', caption: 'O tio derreteu na pista! 🫠' },
  { prompt: 'Cara de quem viu o ex no rolê! 👀', effect: 'fish', caption: 'Blub… finge que não viu. 🐟' },
  { prompt: 'Cara de quem chegou no churrasco e só tinha salada! 🥗', effect: 'melt', caption: 'Cadê a picanha?! 🥩' },
  { prompt: 'Cara de quem viu o preço da gasolina! ⛽', effect: 'eyes', caption: 'Quanto?! 👀' },
  { prompt: 'Cara de quem sentiu cheiro de bolo saindo do forno! 🎂', effect: 'nose', caption: 'Farejou o bolo de longe! 👃' },
  { prompt: 'Cara de fofoqueiro na janela! 🪟', effect: 'eyes', caption: 'Nada escapa desse olhão! 👀' },
  { prompt: 'Enche as bochechas de ar! 🐹', effect: 'cheeks', caption: 'Vai explodir! 🎈' },
];

/** 👀/👃/🐹 sem rosto na foto para mirar. */
export const NO_FACE_CAPTIONS = ['Cadê o rosto? Não achei. 🙈', 'Não achei ninguém nessa foto! 🔍'];

/** Quando a foto tem mais de um rosto. `{n}` vira o número de rostos. */
export const GROUP_SUGGEST_HINTS = [
  'Achei {n} rostos! Os efeitos pegam todo mundo. 😈',
  '{n} vítimas na foto! 😈 Aperta um efeito e ninguém escapa.',
  'Foto em grupo? Achei {n} rostos. Toca em 🎭 e cada um ganha o seu!',
];

/** Legendas dos efeitos quando a foto tem várias pessoas: todo mundo leva junto. */
export const GROUP_EFFECT_CAPTIONS = {
  balloon: ['Cabeção pra todo mundo! 🎈', 'A turma toda de ego inflado. 🎈', 'Família cabeçuda! 🎈'],
  fish: ['Cardume reunido! 🐟', 'Todo mundo fazendo biquinho. 🐟', 'Blub blub em coro! 🐟'],
  melt: ['Derreteu a turma toda! 🫠', 'Churrasco ao meio-dia no Rio. 🫠', 'Ninguém aguentou o calor! 🫠'],
  eyes: ['Todo mundo de olho! 👀', 'Arregalou a família inteira! 👀', 'Quem viu o preço da picanha? 👀'],
  nose: ['Narigão pra todo mundo! 👃', 'A turma toda mentiu! 👃', 'Família Pinóquio reunida! 👃'],
  cheeks: ['Família hamster reunida! 🐹', 'Todo mundo comeu escondido! 🐹', 'Bochecha pra vó apertar não falta! 👵'],
} as const;

/** ✨ Luz e beleza: quando liga e desliga o filtro. */
export const BEAUTY_ON_CAPTIONS = [
  'Filtro de blogueira ativado ✨',
  'Luz de novela das nove! 💡',
  'Ficou até bonito… por enquanto. 😏',
  'Pele de pêssego. Por pouco tempo. 🍑',
  'Fotógrafo de casamento aprovou! 📸',
];
export const BEAUTY_OFF_CAPTIONS = [
  'Sem filtro: a verdade nua e crua. 😬',
  'Voltou ao natural. Corajoso! 💪',
  'Raiz, sem filtro nenhum. 🌱',
];

/** Cabo de guerra: dois dedos puxando a mesma cara. */
export const TUG_START = ['Cabo de guerra! Puxa! 🪢', 'Quem puxa mais forte? 💪', 'Valendo! Puxa, puxa! 🪢'];
export const TUG_LEFT_WINS = ['Vitória do lado esquerdo! 🏆⬅️', 'O lado esquerdo levou a cara! ⬅️', 'Esquerda campeã! 💪⬅️'];
export const TUG_RIGHT_WINS = ['Vitória do lado direito! ➡️🏆', 'O lado direito levou a cara! ➡️', 'Direita campeã! ➡️💪'];
export const TUG_DRAW = ['Empate! A cara ficou no meio. 🤝', 'Empatou! Ninguém leva a cara. 🤝'];
