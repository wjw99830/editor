import { Empty, AnyFunction } from '../types';

export const tail = <T>(arr: T[]): T | Empty => arr[arr.length - 1];
export const safetyHTML = (html: string) => {
  return html.replace('>', '&gt;').replace('<', '&lt;').replace(/ /g, '&nbsp;');
};
export const microtask = (fn: AnyFunction, arg?: any) => Promise.resolve(arg).then(fn);
export const isArray = Array.isArray;
export const isRefType = (o: any) => o && typeof o === 'object';

export function deepClone<T>(obj: T): T;
export function deepClone(obj: any) {
  if (!isRefType(obj)) {
    return obj;
  }
  const copy: Record<symbol | string | number, any> | any[] = isArray(obj) ? [] : {};
  const stack = [{
    copy,
    target: obj,
  }];
  const copiedRefs: Array<{ target: any, copy: any }> = [];
  const { set, ownKeys, getOwnPropertyDescriptor } = Reflect;
  while (stack.length) {
    const { target, copy } = stack.pop()!;
    const keys = ownKeys(target);
    for (const key of keys) {
      const desc = getOwnPropertyDescriptor(target, key);
      if (desc && !desc.enumerable) {
        continue;
      }
      const val = target[key];
      if (isRefType(val)) {
        const copied = copiedRefs.find(copied => copied.target === val);
        if (copied) {
          set(copy, key, copied.copy);
          continue;
        }
        const copyVal = isArray(val) ? [] : {};
        set(copy, key, copyVal);
        stack.push({
          target: val,
          copy: copyVal,
        });
      } else {
        set(copy, key, val);
      }
    }
    copiedRefs.push({
      target,
      copy,
    });
  }
  return copy;
}
