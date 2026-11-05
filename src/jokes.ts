/** All the silly text in one place, so it's easy to add more. */

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Bottom hint, one picked at random on each page load. */
export const HINTS = [
  'Drag the face to stretch it. Drop or paste a photo to use your own.',
  'Drag to stretch. Side effects may include uncontrollable giggling.',
  'Pull the face around. No faces were harmed in the making of this app.',
  'Grab and stretch. Your plastic surgeon hates this one weird trick.',
  'Drag to squish. Paste a photo of your boss (we won’t tell).',
  'Stretch away! Results not valid for passport photos.',
  'Drag the face. Shake your phone for extra wobble.',
  'Pull, squish, repeat. Drop a photo to ruin someone’s face (lovingly).',
];

/** Shown after a medium stretch. */
export const MEDIUM_CAPTIONS = [
  'Looking good! 😬',
  'Is this your passport photo?',
  'Your mom would be proud.',
  'Ah yes, Monday morning face.',
  'Instant profile picture!',
  'This is fine. 🙂',
  'Me pretending to understand the meeting.',
  'Peak beauty achieved.',
];

/** Shown after a really big stretch. */
export const BIG_CAPTIONS = [
  'Science has gone too far. 🧪',
  'Somebody call a doctor!',
  'That’s not a face, that’s modern art.',
  'Okay, now you’re just being mean.',
  'We are legally required to say: wow.',
  'Achievement unlocked: Noodle Face 🍜',
  'Mirror, mirror… please no.',
  'Even the spring is tired now.',
];

/** Speech bubble when you pull way too far. */
export const OUCH_LINES = ['OUCH!', 'HEY!', 'EASY!', 'MY FACE!', 'NOT THE NOSE!', 'OWWW!', 'RUDE!', 'STOP IT!'];

/** One caption per preset button. */
export const EFFECT_CAPTIONS = {
  balloon: ['Big-headed? Who, me? 🎈', 'Too much ego today.', 'Pump it up!'],
  fish: ['Blub blub. 🐟', 'Something smells fishy…', 'Selfie pout: maximum.'],
  twist: ['Wheeee! 🌀', 'Dizzy yet?', 'Plot twist!'],
  melt: ['Is it hot in here? 🫠', 'Me in summer.', 'Melting… melting…'],
  chaos: ['Chaos mode! 🎲', 'Nobody can fix this now.', 'What did you DO?'],
  jelly: ['Jelly mode: on. 🍮', 'Wobble wobble.'],
  shake: ['Earthquake! 📳', 'Shake it off!'],
} as const;
