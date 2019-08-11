import { Editor } from "./editor";

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
        default: break;
      }
    }
  }
  redo() {}
}
