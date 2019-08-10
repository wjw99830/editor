import { EditorConfig } from "../types";
import { Editor } from "./editor";
import { h } from "../dom";
import { stack, Operation } from "./stack";
import { microtask, deepClone } from "../util";

let lid = 0;
export class Line {
  public id: number = ++lid;
  public text = '';
  public focused = false;
  public cursorIndex = 0;
  public lineNumber = 0;
  public elm!: HTMLElement;
  public editorConfig!: EditorConfig;
  public selections: Selection[] = [];
  private _willUpdate = false;

  constructor(
    public editor: Editor,
  ) {
    this.editorConfig = editor.config;
    this._createElm();
  }

  isEmpty() {
    return !this.text.length;
  }
  blur() {
    this.focused = false;
    this.update();
    return this;
  }
  focus() {
    this.focused = true;
    this.update();
    return this;
  }
  getIndent() {
    return (this.text.match(/^ */) || [])[0] || '';
  }
  setText(text: string) {
    this.text = text;
    this.cursorIndex = text.length;
    this.update();
    return this;
  }
  insertText(text: string, startIndex = this.cursorIndex, pushToStack = true) {
    this.text = this.text.slice(0, startIndex) + text + this.text.slice(startIndex);
    if (pushToStack) {
      stack.push({
        type:  Operation.INSERT_TEXT,
        id: this.id,
        text: text,
        startIndex,
        cursorIndex: this.cursorIndex,
        selections: deepClone(this.selections),
      });
    }
    this.cursorIndex += text.length;
    this.update();
    return this;
  }
  deleteText(startIndex = this.cursorIndex - 1, count = 1, pushToStack = true) {
    count = Math.max(0, count);
    const arr = this.text.split('');
    const deleted = arr.splice(startIndex, count);
    if (pushToStack) {
      stack.push({
        type: Operation.DELETE_TEXT,
        id: this.id,
        text: deleted,
        cursorIndex: this.cursorIndex,
        startIndex,
        selections: deepClone(this.selections),
      });
    }
    this.text = arr.join('');
    this.cursorIndex -= count;
    this.update();
    return this;
  }
  setCursor(index: number) {
    index = Math.min(index, this.text.length);
    this.cursorIndex = index;
    this.update();
    return this;
  }
  update() {
    if (this._willUpdate) {
      return;
    }
    this._willUpdate = true;
    microtask(() => {
      const num = this.editor.lines.indexOf(this) + 1;
      this.lineNumber = num;
      this.elm.setAttribute('data-line-number', num.toString());
      if (this.focused) {
        this.elm.classList.add('line--focused');
      } else {
        this.elm.classList.remove('line--focused');
      }
      this.elm.querySelector('.line--number')!.textContent = num.toString();
      this.elm.querySelector('.line--content')!.textContent = this.text;
      (this.elm.querySelector('.line--cursor') as HTMLElement).style.left = this.editor.charWidth * this.cursorIndex + 32 + 'px';
      const selectionsLength = this.selections.length;
      const charWidth = this.editor.charWidth;
      for (const child of [...this.elm.children]) {
        if (child.classList.contains('line--selected')) {
          child.remove();
        }
      }
      for (let i = 0; i < selectionsLength; i++) {
        const selection = this.selections[i];
        const selected = h('span', undefined, { class: 'line--selected' });
        selected.style.left = selection[0] * charWidth + 32 + 'px';
        selected.style.width = (selection[1] - selection[0]) * charWidth + 'px';
        this.elm.appendChild(selected);
      }
      for (const decorator of this.editor._decorators) {
        decorator(this.elm);
      }
      this._willUpdate = false;
    });
  }
  destroy() {
    this.elm.removeEventListener('mousedown', this._focusHandler);
  }
  private _focusHandler = (e: MouseEvent) => {
    this.editor.focus(this);
    const target = e.target as HTMLElement;
    if (target.classList.contains('line--content')) {
      this.setCursor(Math.round(e.offsetX / this.editor.charWidth));
    } else {
      if (e.offsetX <= 30) {
        this.setCursor(0);
      } else {
        this.setCursor(this.text.length);
      }
    }
  }
  private _select = (e: MouseEvent) => {
    if (this.editor.selecting) {
      const target = e.target as HTMLElement;
      if (target.classList.contains('line--cursor')) {
        return;
      }
      const alt = e.altKey;
      const lineNumber = this.lineNumber;
      const anchorNumber = this.editor.selectionAnchor.lineNumber;
      const offsetX = target.classList.contains('line--content') ? e.offsetX : e.offsetX - 32;
      const charWidth = this.editor.charWidth;
      const focus = Math.round(offsetX / charWidth);
      const anchor = Math.min(Math.round(this.editor.selectionAnchor.x / charWidth), this.text.length);
      if (lineNumber < anchorNumber) {
        alt ?
        this.selections.push([Math.max(focus, 0), this.text.length]) :
        (this.selections = [[Math.max(focus, 0), this.text.length]])
      } else if (lineNumber === anchorNumber) {
        alt ?
          this.selections.push([Math.max(0, Math.min(focus, anchor)), Math.min(this.text.length, Math.max(focus, anchor))]) :
          (this.selections = [[Math.max(0, Math.min(focus, anchor)), Math.min(this.text.length, Math.max(focus, anchor))]])
      } else {
        alt ?
          this.selections.push([0, Math.min(focus, this.text.length)]) :
          (this.selections = [[0, Math.min(focus, this.text.length)]])
      }
      this.update();
    }
  }
  private _createElm() {
    const line = h('div', undefined, { class: 'line', id: 'line-' + this.id.toString() });
    const number = h('span', undefined, { class: 'line--number' }, this.editor.lines.indexOf(this) + 1);
    const content = h('pre', undefined, { class: 'line--content' });
    const cursor = h('span', undefined, { class: 'line--cursor' });
    cursor.style.left = '30px';
    line.appendChild(number);
    line.appendChild(content);
    line.appendChild(cursor);
    line.addEventListener('mousedown', this._focusHandler);
    line.addEventListener('mousemove', this._select);
    this.elm = line;
    this.update();
  }
}
type Selection = [number, number];
