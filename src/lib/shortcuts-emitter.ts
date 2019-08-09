type ShortcutsHandler = () => any;

export class ShortcutsEmitter {
  shortcuts: Map<string, Set<ShortcutsHandler>> = new Map();
  emit(e: KeyboardEvent) {
    const alt = e.altKey ? 'alt' : '';
    const ctrl = e.ctrlKey ? 'ctrl' : '';
    const shift = e.shiftKey ? 'shift' : '';
    const key = isTextKey(e.keyCode) ? (KeyCodeMap[e.keyCode] || e.key.toLowerCase()) : (isControlKey(e.key) ? '' : e.code.toLowerCase());
    const combined = [ctrl, shift, alt, key].filter(Boolean).join('+');
    const handlers = this.shortcuts.get(combined);
    if (!e.key.startsWith('F')) {
      e.preventDefault();
    }
    if (handlers) {
      for (const handler of handlers) {
        handler();
      }
    }
  }
  on(shortcuts: string, handler: ShortcutsHandler) {
    shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
    let handlers = this.shortcuts.get(shortcuts);
    if (handlers) {
      handlers.add(handler);
    } else {
      handlers = new Set();
      handlers.add(handler);
      this.shortcuts.set(shortcuts, handlers);
    }
  }
  off(shortcuts: string, handler: ShortcutsHandler) {
    shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
    const handlers = this.shortcuts.get(shortcuts);
    if (handlers) {
      handlers.delete(handler);
    }
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
