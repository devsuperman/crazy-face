/**
 * PT-BR: the source language. Every key here must exist in `en.ts` too (the `Messages`
 * type makes the build fail otherwise). Jokes are written for each language, not
 * translated word for word.
 */

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
    beauty: '✨ Beleza',
    light: '☀️ Luz',
    clay: 'Modo massinha',
    friday: '🎉 Sextou',
    reset: '↺ Resetar',
    settings: '⚙️ Ajustes',
    settingsAria: 'Ajustes',
    actions: 'Ações',
    shareButton: '📤 Compartilhar com amigos',
    shareMenu: 'Compartilhar com amigos',
    saveTitle: '💾 Salvar na galeria',
    saveNote: 'Guarda a foto no celular ou no computador',
    whatsappTitle: '💬 Enviar no WhatsApp',
    whatsappNote: 'A foto, com um convite pra galera fazer a dela',
    inviteTitle: '🔗 Compartilhar o link do Crazy Face',
    inviteNote: 'Só o link, sem a foto, pra galera entrar na brincadeira',
    effects: 'Efeitos malucos',
    balloon: '🎈 Balão',
    fish: '🐟 Cara de peixe',
    melt: '🫠 Derreter',
    eyes: '👀 Olhão',
    nose: '👃 Narigão',
    cheeks: '🐹 Bochechas',
    smile: '😁 Sorrisão',
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
    imageError: 'Ops! Não consegui abrir essa imagem.',
    noWebgl: 'Seu navegador não suporta WebGL2. Tente um navegador mais recente.',
    cameraDenied:
      'Não consegui acessar a câmera. Libere a permissão nas configurações do navegador. Você ainda pode usar o botão "Escolher foto".',
    cameraMissing: 'Não encontrei nenhuma câmera neste aparelho. Você ainda pode usar o botão "Escolher foto".',
    cameraBusy: 'A câmera está sendo usada por outro app. Feche o outro app e tente de novo.',
    cameraFailed: 'Ops! A câmera não quis funcionar. Você ainda pode usar o botão "Escolher foto".',
    photoSaved: '💾 Foto salva! Está na galeria ou na pasta Downloads.',
    whatsappPick: '💬 Escolha o WhatsApp na lista.',
    whatsappCopied: '📋 Foto copiada! No WhatsApp, escolha a conversa e cole (Ctrl+V).',
    whatsappSaved: '💾 Foto baixada! No WhatsApp, escolha a conversa e anexe ela no 📎.',
    invitePick: '🔗 Escolha pra quem mandar o link.',
    linkCopied: '🔗 Link copiado! Cole numa conversa pra chamar a galera.',
    linkHere: '🔗 Copie e mande o link: {link}',
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
    'Foto torta ou com muita sobra? ✂️ Recortar, em ⚙️ Ajustes, resolve.',
  ],

  /** Quando a foto tem mais de um rosto. `{n}` vira o número de rostos. */
  groupHints: [
    'Achei {n} rostos! Os efeitos pegam todo mundo. 😈',
    '{n} vítimas na foto! 😈 Aperta um efeito e ninguém escapa.',
    'Foto em grupo? Achei {n} rostos. Toca em 🎭 e cada um ganha o seu!',
  ],

  /** Balão de fala quando você puxa demais. */
  ouch: ['AI!', 'EI!', 'CALMA!', 'MEU ROSTO!', 'MEU NARIZ!', 'SOCORRO!', 'GROSSO!', 'PARA!'],

  /** 🔗 Convite sem foto: vai com o link do site logo depois. */
  invite: [
    'Vem estragar umas caras comigo! 🤪 É de graça e a foto não sai do seu celular:',
    'Achei um app que deixa qualquer um com cara de massinha 😂 Testa aí:',
    'Duvido você fazer uma cara mais maluca que a minha 🤪 Bora:',
  ],

  /** 💬 Texto que vai junto com a foto no WhatsApp: um convite (o link do site vem logo depois). */
  share: [
    'Olha o que eu fiz com essa cara! 🤪 Agora é sua vez, estrague a sua aqui:',
    'Ficou melhor que a original, né? 😂 Duvido você fazer uma pior:',
    'Manda pro grupo da família! 🤪 E faz a sua também, é de graça:',
    'Não me pergunte o que aconteceu com essa cara. 😂 Vem deformar a sua:',
  ],

  /** 🎉 Sextou: o adesivo de sexta-feira (o texto vai desenhado no adesivo). */
  fridayStickers: ['SEXTOU! 🎉', 'SEXTOOOU! 🥳', 'É SEXTA! 🍻', 'SEXTOU 😎'],

  /** A dica da primeira foto numa sexta. */
  fridayHints: [
    'Sextou! 🎉 Arraste o adesivo, faça pinça para girar e toque nele.',
    'É sexta! 🥳 Mude o adesivo de lugar ou toque nele pra festa.',
  ],
};

export type Messages = typeof pt;
