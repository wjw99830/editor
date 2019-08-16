export type Empty = void | undefined | null;
export interface IndexSignature<V = any> {
  [key: string]: V;
}
export interface EditorConfig {
  tabSize: number;
  lang: string;
}
export type AnyFunction = (...args: any[]) => any;
