/**
 * Languages: PT-BR (the source) and English. No library: `t()` returns the current
 * locale's messages, and `applyDom()` fills the static markup in `index.html`, whose
 * elements name their key with `data-i18n` (text), `data-i18n-aria` (aria-label) and
 * `data-i18n-title` (title). The PT-BR text stays in the HTML as the default.
 */

import { pt, type Messages } from './locales/pt';
import { en } from './locales/en';

export type Locale = 'pt' | 'en';

const MESSAGES: Record<Locale, Messages> = { pt, en };
const HTML_LANG: Record<Locale, string> = { pt: 'pt-BR', en: 'en' };
const STORAGE_KEY = 'crazy-face-lang';

const isLocale = (v: unknown): v is Locale => v === 'pt' || v === 'en';

/** `?lang=`, then the saved choice, then the browser's languages; English otherwise. */
function detect(): Locale {
  const param = new URLSearchParams(location.search).get('lang')?.slice(0, 2).toLowerCase();
  if (isLocale(param)) return param;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage blocked (private mode): just detect again next time.
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang?.slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return 'en';
}

let locale: Locale = detect();
const listeners: (() => void)[] = [];

export const getLocale = (): Locale => locale;
export const t = (): Messages => MESSAGES[locale];

/** Run `fn` after every language change (to redraw text set from code). */
export function onLocaleChange(fn: () => void): void {
  listeners.push(fn);
}

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not saved; the picker still works for this visit.
  }
  applyDom();
  for (const fn of listeners) fn();
}

type DomKey = keyof Messages['dom'];

function lookup(key: string | undefined): string | null {
  if (!key) return null;
  const text = t().dom[key as DomKey];
  if (text === undefined && import.meta.env.DEV) console.warn(`i18n: no text for "${key}"`);
  return text ?? null;
}

/** Fill every marked element (and the page language, description and picker) with the current locale. */
export function applyDom(root: ParentNode = document): void {
  document.documentElement.lang = HTML_LANG[locale];
  document.querySelector('meta[name="description"]')?.setAttribute('content', t().meta.description);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const text = lookup(el.dataset.i18n);
    if (text !== null) el.textContent = text;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const text = lookup(el.dataset.i18nAria);
    if (text !== null) el.setAttribute('aria-label', text);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const text = lookup(el.dataset.i18nTitle);
    if (text !== null) el.title = text;
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === locale));
  }
}

/** The 🌐 PT | EN pickers (one in the toolbar, one on the start screen). */
export function setupLanguagePicker(onPick?: () => void): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.addEventListener('click', () => {
      const next = button.dataset.lang;
      if (!isLocale(next) || next === locale) return;
      setLocale(next);
      onPick?.();
    });
  }
}
