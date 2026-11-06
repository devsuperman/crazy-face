/**
 * PT-BR: the source language. Every key here must exist in `en.ts` too (the `Messages`
 * type makes the build fail otherwise). Jokes are written for each language, not
 * translated word for word.
 */

import type { PoseChallenge } from '../jokes';

/** Desafio de pose na câmera: a pose pedida e o efeito que toca logo depois da foto. */
const POSE_CHALLENGES: PoseChallenge[] = [
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

export const pt = {
  meta: {
    description: 'Tire ou envie uma foto e estique, amasse e puxe a cara à vontade.',
  },

  /** Static markup in `index.html`, by its `data-i18n*` key. */
  dom: {
    language: 'Idioma',
    newPhoto: '📸 Nova foto',
    crop: '✂️ Recortar',
    cropAria: 'Recortar ou girar a foto',
    cropTitle: 'Recortar ou girar',
    brush: 'Pincel',
    beauty: '✨ Luz e beleza',
    clay: 'Modo massinha',
    reset: 'Resetar',
    save: 'Salvar PNG',
    whatsappAria: 'Enviar a foto pelo WhatsApp',
    effects: 'Efeitos malucos',
    balloon: '🎈 Balão',
    fish: '🐟 Cara de peixe',
    melt: '🫠 Derreter',
    eyes: '👀 Olhão',
    nose: '👃 Narigão',
    cheeks: '🐹 Bochechas',
    mix: '🎭 Um efeito pra cada',
    startTitle: 'Bora estragar uma cara?',
    startText: 'Tire uma foto ou escolha uma da galeria. Depois é só esticar, amassar e puxar.',
    takePhoto: '📸 Tirar foto',
    pickPhoto: '🖼️ Escolher foto',
    startBack: '↩ Voltar para a foto de antes',
    startSample: 'ou brinque com a cara de exemplo 🙂',
    startNote: '🔒 A foto fica só no seu aparelho. Também dá pra soltar ou colar uma imagem aqui.',
    drop: 'Solte sua foto aqui',
    camera: 'Câmera',
    challengeLabel: '😜 Desafio de pose',
    challengeNext: '🔀 Outro',
    challengeOff: 'Sem desafio',
    challengeOn: '😜 Quero um desafio',
    reviewTitle: 'Ficou boa? 😎',
    retake: '🔁 Tirar outra',
    usePhoto: '✔ Usar esta',
    cameraClose: 'Fechar câmera',
    close: 'Fechar',
    shutter: 'Tirar foto (contagem de 3 segundos)',
    flip: 'Trocar câmera',
    cropRatios: 'Formato do recorte',
    ratioFree: 'Livre',
    rotateLeft: 'Girar para a esquerda',
    rotateRight: 'Girar para a direita',
    cropReset: 'Foto inteira',
    cancel: 'Cancelar',
    done: '✔ Pronto',
  },

  /** Text set from code. */
  text: {
    soundOn: 'Ligar sons',
    soundOff: 'Desligar sons',
    lightOn: 'Ligar luz',
    lightOff: 'Desligar luz',
    beautyOn: '✨ Com luz e beleza',
    beautyOff: '✨ Sem filtro',
    imageError: 'Ops! Não consegui abrir essa imagem.',
    noWebgl: 'Seu navegador não suporta WebGL2. Tente um navegador mais recente.',
    cameraDenied:
      'Não consegui acessar a câmera. Libere a permissão nas configurações do navegador. Você ainda pode usar o botão "Escolher foto".',
    cameraMissing: 'Não encontrei nenhuma câmera neste aparelho. Você ainda pode usar o botão "Escolher foto".',
    cameraBusy: 'A câmera está sendo usada por outro app. Feche o outro app e tente de novo.',
    cameraFailed: 'Ops! A câmera não quis funcionar. Você ainda pode usar o botão "Escolher foto".',
  },

  /** Dica no rodapé, sorteada a cada foto nova. */
  hints: [
    'Arraste a cara para esticar. Toque em 📸 Nova foto para trocar.',
    'Arraste para esticar. Efeito colateral: crise de riso.',
    'Puxe a cara à vontade. Nenhum rosto foi ferido neste app.',
    'Estica e puxa. Seu cirurgião plástico odeia esse truque.',
    'Arraste para amassar. Tira uma foto do chefe (a gente não conta).',
    'Pode esticar! Não vale para foto de RG.',
    'Arraste a cara. Chacoalhe o celular para tremer mais.',
    'Puxa, amassa, repete. Estrague a cara de alguém (com carinho).',
    'Foto torta ou com muita sobra? ✂️ Recortar resolve.',
  ],

  /** Quando a foto tem mais de um rosto. `{n}` vira o número de rostos. */
  groupHints: [
    'Achei {n} rostos! Os efeitos pegam todo mundo. 😈',
    '{n} vítimas na foto! 😈 Aperta um efeito e ninguém escapa.',
    'Foto em grupo? Achei {n} rostos. Toca em 🎭 e cada um ganha o seu!',
  ],

  /** Balão de fala quando você puxa demais. */
  ouch: ['AI!', 'EI!', 'CALMA!', 'MEU ROSTO!', 'MEU NARIZ!', 'SOCORRO!', 'GROSSO!', 'PARA!'],

  /** Texto que vai junto com a foto no WhatsApp. */
  share: [
    'Olha o que eu fiz com essa cara! 🤪',
    'Ficou melhor que a original, né? 😂',
    'Manda pro grupo da família! 🤪',
    'Não me pergunte o que aconteceu com essa cara. 😂',
  ],

  challenges: POSE_CHALLENGES,
};

export type Messages = typeof pt;
