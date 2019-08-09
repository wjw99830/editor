export type Empty = void | undefined | null;
export type IndexSignature<V = any> = {
  [key: string]: V;
};
export type EditorConfig = {
  tabSize: number;
};
export type AnyFunction = (...args: any[]) => any;
