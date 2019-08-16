import { Editor } from "./editor";
import { Line } from "./line";
import { tail } from "../util";

export const Operation = {
  DELETE_TEXT: 'deleteText',
  INSERT_TEXT: 'insertText',
  CUT: 'cut',
  INSERT_LINE: 'insertLine',
  APPEND_LINE: 'appendLine',
  REMOVE_LINE: 'removeLine',
  PREPEND_LINE: 'prependLine',
};
export class Stack {
  private _innerStack: any[] = [];
  private ptr = -1;
  constructor(
    private _editor: Editor,
  ) {}
  push(opt: any) {
    this._innerStack.push(opt);
    this.ptr = this._innerStack.length - 1;
  }
  undo = () => {
    const opt = this._innerStack[this.ptr];
    if (opt) {
      switch (opt.type) {
        case Operation.INSERT_TEXT: {
          const line = this._editor.lines.find(line => line.id === opt.id);
          if (line) {
            line.deleteText(opt.startIndex, opt.startIndex + opt.text.length, false);
            line.setCursor(opt.cursorIndex);
            line.setSelections(opt.selections);
          }
          break;
        }
        case Operation.DELETE_TEXT: {
          const line = this._editor.lines.find(line => line.id === opt.id);
          if (line) {
            line.insertText(opt.text, opt.startIndex, false);
            line.setCursor(opt.cursorIndex);
            line.setSelections(opt.selections);
          }
          break;
        }
        case Operation.CUT: {
          let line = this._editor.lines.find(line => line.id === opt.id);
          if (line) {
            const rows: string[] = opt.text.split('\n');
            const l = rows.length;
            for (let i = 0; i < l; i++) {
              const row = rows[i];
              if (i === 0) {
                let selectionEnd = opt.startIndex + row.length;
                if (l > 1) {
                  selectionEnd++;
                }
                line.insertText(row, opt.startIndex, false);
                line.setCursor(opt.startIndex);
                line.pushSelection([opt.startIndex, selectionEnd]);
              } else if (i < l - 1) {
                const newLine = new Line(this._editor).setText(row);
                newLine.pushSelection([0, newLine.text.length + 1]);
                this._editor.appendLine(line, newLine, false);
              } else {
                const newLine = new Line(this._editor).setText(row);
                // line.insertText(row, 0, false);
                newLine.pushSelection([0, row.length]);
                this._editor.appendLine(line, newLine, false);
              }
              if (line.nextLine && i !== 0) {
                line = line.nextLine;
              }
            }
          }
          break;
        }
        case Operation.INSERT_LINE: {
          const line = this._editor.lines.find(line => line.id === opt.newId);
          if (line) {
            let shouldFocusId = opt.prevId || opt.nextId;
            let shouldFocusLine = this._editor.lines.find(line => line.id === shouldFocusId);
            shouldFocusLine && this._editor.focus(shouldFocusLine);
            this._editor.removeLine(line, false);
          }
          break;
        }
        default: break;
      }
      this._innerStack.splice(this.ptr, 1);
      this.ptr--;
    }
  }
  redo = () => {}
}
