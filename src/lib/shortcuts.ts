import { Editor } from './editor';
import { Line } from './line';
import { microtask } from '../util';
import { autoCompleteKeys, autoCompleteValues } from './snippet';

export function upEnter(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const prevLine = focusedLine.prevLine;
      const line = new Line(editor);
      editor.prependLine(focusedLine, line);
      editor.focus(line);
      line.setText(prevLine ? prevLine.getIndent() : '');
    }
  };
}
export function downEnter(editor: Editor) {
  return function handler() {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const line = new Line(editor);
      if (focusedLine) {
        let nextIndent = focusedLine.getIndent().length;
        if (autoCompleteKeys.concat(['.']).includes(focusedLine.text[focusedLine.cursorIndex - 1])) {
          nextIndent += editor.config.tabSize;
          // microtask(handler);
        } else if (autoCompleteValues.includes(focusedLine.text[focusedLine.cursorIndex])) {
          nextIndent -= editor.config.tabSize;
          microtask(editor.focus.bind(editor), focusedLine);
        }
        if (focusedLine.cursorIndex < focusedLine.text.length) {
          const textWhichMoveToNextLine = focusedLine.text.slice(focusedLine.cursorIndex, focusedLine.text.length);
          focusedLine.setText(focusedLine.text.slice(0, focusedLine.cursorIndex));
          line.insertText(' '.repeat(nextIndent) + textWhichMoveToNextLine);
          line.setCursor(nextIndent);
        } else {
          line.insertText(' '.repeat(nextIndent));
        }
      }
      editor.appendLine(focusedLine, line);
      editor.focus(line);
    }
  };
}
export function leftDelete(editor: Editor) {
  return (e: KeyboardEvent) => {
    const focusedLine = editor.findFocusedLine();
    const selectedText = editor.getSelectedText();
    if (selectedText) {
      editor.cut();
    } else if (!focusedLine) {
      return;
    } else if (focusedLine.isEmpty()) {
      const prevLine = focusedLine.prevLine;
      if (prevLine) {
        editor.removeLine(focusedLine);
        editor.focus(prevLine);
      }
    } else if (focusedLine.cursorIndex > 0) {
      if (e.ctrlKey) {
        const tokens = focusedLine.text.slice(0, focusedLine.cursorIndex).split('').filter(Boolean);
        const splitter = ' .+*&|/%?:;=\'"`,~-_(){}[]<>]/';
        let i = focusedLine.cursorIndex;
        while (!splitter.includes(tokens[i - 1]) && i >= 1) {
          i--;
        }
        if (!tokens.join('').trim()) {
          i = 0;
        } else if (i >= 1 && i === focusedLine.cursorIndex) {
          i--;
        }
        focusedLine.deleteText(focusedLine.cursorIndex, i);
      } else {
        focusedLine.deleteText();
      }
    } else {
      const prevLine = focusedLine.prevLine;
      if (prevLine) {
        prevLine.insertText(focusedLine.text);
        editor.removeLine(focusedLine);
        editor.focus(prevLine);
      }
    }
  };
}
export function rightDelete(editor: Editor) {
  return (e: KeyboardEvent) => {
    const focusedLine = editor.findFocusedLine();
    const selectedText = editor.getSelectedText();
    if (selectedText) {
      editor.cut();
    } else if (!focusedLine) {
      return;
    } else if (focusedLine.text.length === focusedLine.cursorIndex) {
      const { nextLine } = focusedLine;
      if (nextLine) {
        focusedLine.insertText(nextLine.text);
        editor.removeLine(nextLine);
      }
    } else if (e.ctrlKey) {
      const { cursorIndex } = focusedLine;
      const tokens = focusedLine.text.split('').filter(Boolean);
      const splitter = ' .+*&|/%?:=\'"`,~-_(){}[]<>]/';
      let i = cursorIndex;
      while (!splitter.includes(tokens[i]) && i <= focusedLine.text.length) {
        i++;
      }
      if (i === cursorIndex) {
        i++;
      }
      focusedLine.deleteText(cursorIndex, i);
    } else {
      const { cursorIndex } = focusedLine;
      focusedLine.deleteText(cursorIndex, cursorIndex + 1);
    }
  };
}
export function leftMove(editor: Editor) {
  return (e: KeyboardEvent) => {
    editor.clearSelections();
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const cursorIndex = focusedLine.cursorIndex;
      if (cursorIndex > 0) {
        if (e.ctrlKey) {
          const tokens = focusedLine.text.split('').filter(Boolean);
          const splitter = ' .+*&|/%?:=\'"`,~-_(){}[]<>]/';
          let i = cursorIndex;
          while (!splitter.includes(tokens[i - 1]) && i >= 1) {
            i--;
          }
          if (i === cursorIndex) {
            i--;
          }
          focusedLine.setCursor(i);
        } else {
          focusedLine.setCursor(focusedLine.cursorIndex - 1);
        }
      } else {
        const prevLine = focusedLine.prevLine;
        if (prevLine) {
          focusedLine.setCursor(focusedLine.text.length);
          editor.focus(prevLine);
        }
      }
    }
  };
}
export function rightMove(editor: Editor) {
  return (e: KeyboardEvent) => {
    editor.clearSelections();
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const cursorIndex = focusedLine.cursorIndex;
      if (cursorIndex >= focusedLine.text.length) {
        const nextLine = focusedLine.nextLine;
        if (nextLine) {
          focusedLine.setCursor(focusedLine.text.length);
          nextLine.setCursor(0);
          editor.focus(nextLine);
        }
      } else {
        if (e.ctrlKey) {
          const tokens = focusedLine.text.split('').filter(Boolean);
          const splitter = ' .+*&|/%?:=\'"`,~-_(){}[]<>]/';
          let i = cursorIndex;
          while (!splitter.includes(tokens[i]) && i <= focusedLine.text.length) {
            i++;
          }
          if (i === cursorIndex) {
            i++;
          }
          focusedLine.setCursor(i);
        } else {
          focusedLine.setCursor(cursorIndex + 1);
        }
      }
    }
  };
}
export function upMove(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const cursorIndex = focusedLine.cursorIndex;
      const prevLine = focusedLine.prevLine;
      if (prevLine) {
        prevLine.setCursor(cursorIndex);
        focusedLine.setCursor(focusedLine.text.length);
        editor.focus(prevLine);
      }
    }
  };
}
export function downMove(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const cursorIndex = focusedLine.cursorIndex;
      const nextLine = focusedLine.nextLine;
      if (nextLine) {
        nextLine.setCursor(cursorIndex);
        focusedLine.setCursor(focusedLine.text.length);
        editor.focus(nextLine);
      }
    }
  };
}
export function tab(editor: Editor) {
  return (e: KeyboardEvent) => {
    e.preventDefault();
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.insertText(' '.repeat(editor.config.tabSize));
    }
  };
}
export function rightIndent(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.insertText(' '.repeat(editor.config.tabSize), 0);
    }
  };
}
export function leftIndent(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.deleteText(Math.min(focusedLine.getIndent().length, editor.config.tabSize), 0);
    }
  };
}
