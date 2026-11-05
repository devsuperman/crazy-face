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
  melt: ['Tá calor aqui? 🫠', 'Eu no verão do Rio.', 'Derretendo… derretendo…'],
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
];

/** Modo turma: troféus engraçados, um diferente para cada rosto. */
export const AWARDS = [
  'Drama nível novela 🎭',
  'Dormiu na foto 😴',
  'Vai chorar no casamento 😭',
  'Conta a piada do pavê 🍰',
  'Cara de segunda-feira 📅',
  'Some primeiro da festa 🏃',
  'Fofoca em dia 👂',
  'Sempre atrasa ⏰',
  'Comeu o último salgado 🥟',
  'Manda áudio de 5 minutos 🎙️',
  'Ainda deve o Pix 💸',
  'Esqueceu o aniversário 🎂',
  'Chora em comercial de margarina 🧈',
  'Responde "kkk" sem rir 😐',
  'Tira foto do prato 📸',
  'Rei do "já tô chegando" 🚗',
];

/** Quando os troféus são entregues. */
export const AWARD_CAPTIONS = ['E o troféu vai para… 🏆', 'Premiação da turma! 🏆', 'Oscar da família! 🎬', 'Os vencedores são… 🥁'];

/** Quando o app está ocupado e ignora um toque no Modo turma. */
export const BUSY_HINTS = ['Calma! Espera a brincadeira acabar. ⏳', 'Peraí, ainda tá rolando! ⏳'];

/** Modo turma: troca de cabeças. */
export const SWAP_CAPTIONS = [
  'Quem é quem? 🔀',
  'Troca de cabeças! Ninguém percebeu. 🤫',
  'Agora sim, a família está completa. 😂',
  'Cada um com a cara do outro!',
  'Ficou até mais bonito, né?',
];

/** Quando as cabeças voltam pro lugar. */
export const SWAP_BACK_CAPTIONS = ['Tudo de volta ao normal. Será? 🤔', 'Cada cabeça no seu lugar. Ufa! 😮‍💨'];

/** Cabo de guerra: dois dedos puxando a mesma cara. */
export const TUG_START = ['Cabo de guerra! Puxa! 🪢', 'Quem puxa mais forte? 💪', 'Valendo! Puxa, puxa! 🪢'];
export const TUG_LEFT_WINS = ['Vitória do lado esquerdo! 🏆⬅️', 'O lado esquerdo levou a cara! ⬅️', 'Esquerda campeã! 💪⬅️'];
export const TUG_RIGHT_WINS = ['Vitória do lado direito! ➡️🏆', 'O lado direito levou a cara! ➡️', 'Direita campeã! ➡️💪'];
export const TUG_DRAW = ['Empate! A cara ficou no meio. 🤝', 'Empatou! Ninguém leva a cara. 🤝'];
