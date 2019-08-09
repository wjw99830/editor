import { Empty } from "../types";

export const snippet = (input: string) => {
  return input + (autoCompleteMap[input] || '');
};
export const autoCompleteMap: Record<string, string | Empty> = {
  '{': '}',
  '[': ']',
  '(': ')',
  '\'': '\'',
  '"': '"',
  '<': '>',
};
export const autoCompleteKeys = Object.keys(autoCompleteMap);
export const autoCompleteValues = Object.values(autoCompleteMap);
export const autoCompleteEntries = Object.entries(autoCompleteMap).map(([key, value]) => key + value);
