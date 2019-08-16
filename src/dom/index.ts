import { IndexSignature, Empty } from '../types';

type DOMProps = Record<string, any>;
type DOMAttrs = Record<string, string | Empty>;
export const $ = (sel: string) => document.querySelector(sel);
export const $$ = (sel: string) => document.querySelectorAll(sel);
export const h = (tag: string, props: DOMProps = {}, attrs: DOMAttrs = {}, text: string | number = '') => {
  const elm: IndexSignature & HTMLElement = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    elm[key] = value;
  }
  for (const [key, value] of Object.entries(attrs)) {
    elm.setAttribute(key, value || '');
  }
  elm.textContent = text.toString();
  return elm;
};
