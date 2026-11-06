/** English. Same keys as `pt.ts`; the jokes are written for English speakers, not translated. */

import type { Messages } from './pt';

export const en: Messages = {
  meta: {
    description: 'Take or upload a photo, then stretch, squish and pull the face around.',
  },

  dom: {
    language: 'Language',
    newPhoto: '📸 New photo',
    crop: '✂️ Crop',
    cropAria: 'Crop or rotate the photo',
    cropTitle: 'Crop or rotate',
    brush: 'Brush',
    beauty: '✨ Light & beauty',
    clay: 'Clay mode',
    friday: '🎉 Friday',
    reset: '↺ Reset',
    save: '💾 Save',
    settings: '⚙️ Settings',
    settingsAria: 'Settings',
    actions: 'Actions',
    whatsappAria: 'Send the photo on WhatsApp',
    effects: 'Crazy effects',
    balloon: '🎈 Balloon',
    fish: '🐟 Fish face',
    melt: '🫠 Melt',
    eyes: '👀 Big eyes',
    nose: '👃 Big nose',
    cheeks: '🐹 Chubby cheeks',
    mix: '🎭 One effect each',
    startTitle: 'Ready to wreck a face?',
    startText: 'Take a photo or pick one from your gallery. Then stretch, squish and pull.',
    takePhoto: '📸 Take photo',
    pickPhoto: '🖼️ Choose photo',
    startBack: '↩ Back to the previous photo',
    startSample: 'or play with the sample face 🙂',
    startNote: '🔒 Your photo stays on your device. You can also drop or paste an image here.',
    drop: 'Drop your photo here',
    camera: 'Camera',
    reviewTitle: 'Looking good? 😎',
    retake: '🔁 Retake',
    usePhoto: '✔ Use this one',
    cameraClose: 'Close camera',
    close: 'Close',
    shutter: 'Take photo (3-second countdown)',
    flip: 'Switch camera',
    cropRatios: 'Crop shape',
    ratioFree: 'Free',
    rotateLeft: 'Rotate left',
    rotateRight: 'Rotate right',
    cropReset: 'Whole photo',
    cancel: 'Cancel',
    done: '✔ Done',
  },

  text: {
    soundOn: 'Turn sound on',
    soundOff: 'Turn sound off',
    lightOn: 'Turn light on',
    lightOff: 'Turn light off',
    beautyOn: '✨ With light & beauty',
    beautyOff: '✨ No filter',
    imageError: "Oops! I couldn't open that image.",
    noWebgl: "Your browser doesn't support WebGL2. Try a newer browser.",
    cameraDenied:
      'I couldn\'t access the camera. Allow it in your browser settings. You can still use the "Choose photo" button.',
    cameraMissing: 'I couldn\'t find a camera on this device. You can still use the "Choose photo" button.',
    cameraBusy: 'Another app is using the camera. Close it and try again.',
    cameraFailed: 'Oops! The camera refused to work. You can still use the "Choose photo" button.',
  },

  hints: [
    'Drag the face to stretch it. Tap 📸 New photo to switch.',
    'Drag to stretch. Side effect: uncontrollable giggles.',
    'Pull the face all you want. No faces were harmed in this app.',
    'Stretch and squish. Plastic surgeons hate this one weird trick.',
    "Drag to squish. Snap a photo of your boss (we won't tell).",
    'Go ahead, stretch! Just not on your passport photo.',
    'Drag the face. Shake your phone to make it wobble.',
    "Pull, squish, repeat. Ruin someone's face (lovingly).",
    'Crooked photo or too much background? ✂️ Crop (in ⚙️ Settings) fixes it.',
  ],

  groupHints: [
    'Found {n} faces! The effects hit everyone. 😈',
    '{n} victims in this photo! 😈 Tap an effect and nobody escapes.',
    'Group photo? I found {n} faces. Tap 🎭 and everyone gets their own!',
  ],

  ouch: ['OUCH!', 'HEY!', 'EASY!', 'MY FACE!', 'MY NOSE!', 'HELP!', 'RUDE!', 'STOP!'],

  share: [
    'Look what I did to this face! 🤪 Your turn, go wreck yours:',
    'Better than the original, right? 😂 Bet you can make a worse one:',
    'Send it to the family group chat! 🤪 Then make your own, it’s free:',
    "Don't ask what happened to this face. 😂 Come squish yours:",
  ],

  fridayStickers: ['Happy Friday! 🎉', 'Happy Friday! 🥳', 'Happy Friday! 🍻', 'Happy Friday! 😎'],

  fridayHints: [
    "Happy Friday! 🎉 Drag the sticker, pinch to spin it, and tap it.",
    "Happy Friday! 🥳 Move the sticker around or tap it to party.",
  ],
};
