import { Editor } from "./editor";
import { Line } from "./line";

let ptr = -1;
export const stack: any[] = [];
export function pushOperation(operation: any) {
  stack.push(operation);
  ptr = stack.length - 1;
}
export function undo() {
  const operation = stack[ptr];
  switch (operation.type) {
    case Operation.INSERT_TEXT:
  }
}
export function redo() {}
export const Operation = {
  DELETE_TEXT: 'deleteText',
  INSERT_TEXT: 'insertText',
  CUT: 'cut',
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
          this.ptr--;
          break;
        }
        case Operation.DELETE_TEXT: {
          const line = this._editor.lines.find(line => line.id === opt.id);
          if (line) {
            line.insertText(opt.text, opt.startIndex, false);
            line.setCursor(opt.cursorIndex);
            line.setSelections(opt.selections);
          }
          this.ptr--;
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
                if (l > 1) {
                  const newLine = new Line(this._editor).setText(line.text.slice(opt.startIndex));
                  line.deleteText(opt.startIndex, line.text.length, false);
                  this._editor.appendLine(line, newLine);
                }
                line.insertText(row, opt.startIndex, false);
                line.setCursor(opt.startIndex);
                line.pushSelection([opt.startIndex, opt.startIndex + row.length]);
              } else if (i < l - 1) {
                const newLine = new Line(this._editor).setText(row);
                newLine.pushSelection([0, newLine.text.length + 1]);
                this._editor.appendLine(line, newLine);
              } else {
                line.insertText(row, 0, false);
                line.pushSelection([0, row.length]);
              }
              if (line.nextLine) {
                line = line.nextLine;
              }
            }
          }
          this.ptr--;
          break;
        }
        default: break;
      }
    }
  }
  redo() {}
}
