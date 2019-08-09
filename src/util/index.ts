import { Empty, AnyFunction } from "../types";

export const tail = <T>(arr: T[]): T | Empty => arr[arr.length - 1];
export const safetyHTML = (html: string) => {
  return html.replace('>', '&gt;').replace('<', '&lt;').replace(/ /g, '&nbsp;');
};
export const microtask = (fn: AnyFunction, arg?: any) => Promise.resolve(arg).then(fn);
