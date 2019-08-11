import { EventEmitter } from "./event-emitter";

type ShortcutsHandler = (e: KeyboardEvent) => void;

export class ShortcutsEmitter extends EventEmitter {
  static sort(shortcuts: string) {
    const keys = shortcuts.split('+');
    const alt = keys.includes('alt');
    const ctrl = keys.includes('ctrl');
    const shift = keys.includes('shift');
    return [ctrl && 'ctrl', shift && 'shift', alt && 'alt', keys.find(key => !['ctrl', 'shift', 'alt'].includes(key))].filter(Boolean).join('+');
  }
  on(shortcuts: string, handler: ShortcutsHandler) {
    shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
    super.on(ShortcutsEmitter.sort(shortcuts), handler);
    return this;
  }
  off(shortcuts: string, handler: ShortcutsHandler) {
    shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
    this.off(ShortcutsEmitter.sort(shortcuts), handler);
    return this;
  }
}

export const isTextKey = (keyCode: number) => {
  return keyCode >= 48 && keyCode <= 57 || keyCode >= 65 && keyCode <= 90 || keyCode >= 186 && keyCode <= 192 || keyCode >= 219 && keyCode <= 222;
};
export const isControlKey = (key: string) => {
  return ['Control', 'Alt', 'Shift'].includes(key);
};
export const isControlKeyPressed = (e: KeyboardEvent) => {
  return e.ctrlKey || e.altKey;
};
export const KeyCodeMap: Record<string | number, string | void> = {
  48: '0',
  49: '1',
  50: '2',
  51: '3',
  52: '4',
  53: '5',
  54: '6',
  55: '7',
  56: '8',
  57: '9',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: '\'',
};
