import { Editor } from "./editor";
import { Line } from "./line";
import { microtask } from "../util";
import { autoCompleteKeys, autoCompleteValues } from "./snippet";

export function upEnter(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const prevLine = editor.findPrevLine(focusedLine);
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
      editor.appendLine(focusedLine, line);
      if (focusedLine) {
        let nextIndent = focusedLine.getIndent().length;
        if (autoCompleteKeys.concat(['.']).includes(focusedLine.text[focusedLine.cursorIndex - 1])) {
          nextIndent += editor.config.tabSize;
          microtask(handler);
        } else if (autoCompleteValues.includes(focusedLine.text[focusedLine.cursorIndex])) {
          nextIndent -= editor.config.tabSize;
          microtask(editor.focus.bind(editor), focusedLine);
        }
        line.setText(' '.repeat(nextIndent));
        if (focusedLine.cursorIndex < focusedLine.text.length) {
          const textWhichMoveToNextLine = focusedLine.text.slice(focusedLine.cursorIndex, focusedLine.text.length);
          focusedLine.setText(focusedLine.text.slice(0, focusedLine.cursorIndex));
          line.insertText(textWhichMoveToNextLine);
          line.setCursor(nextIndent);
        }
      }
      editor.focus(line);
    }
  };
}
export function backspace(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      if (focusedLine.isEmpty()) {
        const prevLine = editor.findPrevLine(focusedLine);
        if (prevLine) {
          editor.removeLine(focusedLine);
          editor.focus(prevLine);
        }
      } else if (focusedLine.cursorIndex > 0) {
        focusedLine.deleteText();
      } else {
        const prevLine = editor.findPrevLine(focusedLine);
        if (prevLine) {
          prevLine.insertText(focusedLine.text);
          editor.removeLine(focusedLine);
          editor.focus(prevLine);
        }
      }
    }
  };
}
export function leftMove(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const cursorIndex = focusedLine.cursorIndex;
      if (cursorIndex > 0) {
        focusedLine.setCursor(focusedLine.cursorIndex - 1);
      } else {
        const prevLine = editor.findPrevLine(focusedLine);
        if (prevLine) {
          focusedLine.setCursor(focusedLine.text.length);
          editor.focus(prevLine);
        }
      }
    }
  };
}
export function rightMove(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const cursorIndex = focusedLine.cursorIndex;
      focusedLine.setCursor(cursorIndex + 1);
      if (cursorIndex >= focusedLine.text.length) {
        const nextLine = editor.findNextLine(focusedLine);
        if (nextLine) {
          focusedLine.setCursor(focusedLine.text.length);
          nextLine.setCursor(0);
          editor.focus(nextLine);
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
      const prevLine = editor.findPrevLine(focusedLine);
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
      const nextLine = editor.findNextLine(focusedLine);
      if (nextLine) {
        nextLine.setCursor(cursorIndex);
        focusedLine.setCursor(focusedLine.text.length);
        editor.focus(nextLine);
      }
    }
  }
}
export function tab(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.insertText(' '.repeat(editor.config.tabSize));
    }
  };
}
export function space(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.insertText(' ');
    }
  };
}
export function rightIndent(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.insertText(' '.repeat(editor.config.tabSize));
    }
  }
}
export function leftIndent(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.deleteText(0, Math.min(focusedLine.getIndent().length, editor.config.tabSize));
    }
  }
}
