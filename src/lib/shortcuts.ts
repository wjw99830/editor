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
      line.setIndent(prevLine ? prevLine.indent : 0);
    }
  };
}
export function downEnter(editor: Editor) {
  return function handler() {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      const line = new Line(editor);
      editor.appendLine(focusedLine, line);
      editor.focus(line);
      if (focusedLine) {
        let nextIndent = focusedLine.indent;
        if (autoCompleteKeys.concat(['.']).includes(focusedLine.getFullText()[focusedLine.cursorIndex - 1])) {
          nextIndent += editor.config.tabSize;
          microtask(handler);
        } else if (autoCompleteValues.includes(focusedLine.getFullText()[focusedLine.cursorIndex])) {
          nextIndent -= editor.config.tabSize;
          microtask(editor.focus.bind(editor), focusedLine);
        }
        line.setIndent(nextIndent);
        if (focusedLine.cursorIndex < focusedLine.getMaxCursor()) {
          const textWhichMoveToNextLine = focusedLine.text.slice(focusedLine.cursorIndex - focusedLine.indent, focusedLine.getMaxCursor());
          focusedLine.setText(focusedLine.text.slice(0, focusedLine.cursorIndex - focusedLine.indent));
          line.appendText(textWhichMoveToNextLine);
          line.setCursor(nextIndent);
        }
      }
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
        focusedLine.backspace();
      } else {
        const prevLine = editor.findPrevLine(focusedLine);
        if (prevLine) {
          prevLine.appendText(' '.repeat(focusedLine.indent) + focusedLine.text);
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
          focusedLine.moveToMaxCursor();
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
      if (cursorIndex < focusedLine.getMaxCursor()) {
        focusedLine.setCursor(cursorIndex + 1);
      } else {
        const nextLine = editor.findNextLine(focusedLine);
        if (nextLine) {
          focusedLine.moveToMaxCursor();
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
        if (prevLine.getMaxCursor() >= cursorIndex) {
          prevLine.setCursor(cursorIndex);
        } else {
          prevLine.moveToMaxCursor();
        }
        focusedLine.moveToMaxCursor();
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
        if (nextLine.getMaxCursor() >= cursorIndex) {
          nextLine.setCursor(cursorIndex);
        } else {
          nextLine.moveToMaxCursor();
        }
        focusedLine.moveToMaxCursor();
        editor.focus(nextLine);
      }
    }
  }
}
export function tab(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      if (focusedLine.cursorIndex <= focusedLine.indent) {
        focusedLine.tabIndent();
      } else {
        focusedLine.appendText(' '.repeat(editor.config.tabSize));
      }
    }
  };
}
export function space(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      if (focusedLine.indent >= focusedLine.cursorIndex) {
        focusedLine.incIndent();
      } else {
        focusedLine.appendText(' ');
      }
    }
  };
}
export function rightIndent(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.tabIndent();
    }
  }
}
export function leftIndent(editor: Editor) {
  return () => {
    const focusedLine = editor.findFocusedLine();
    if (focusedLine) {
      focusedLine.decTabIndent();
    }
  }
}
