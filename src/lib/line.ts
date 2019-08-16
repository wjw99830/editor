import { EditorConfig } from "../types";
import { Editor } from "./editor";
import { h } from "../dom";
import { Operation } from "./stack";
import { microtask, deepClone, tail } from "../util";

const { min, max, round, abs } = Math;

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
  public prevLine?: Line;
  public nextLine?: Line;
  private _willUpdate = false;

  constructor(
    public editor: Editor,
  ) {
    this.editorConfig = editor.config;
    this._createElm();
  }

  clone() {
    const { id, text, lineNumber, selections, cursorIndex } = this;
    return {
      id,
      text,
      lineNumber,
      cursorIndex,
      selections: deepClone(selections),
    };
  }
  isEmpty() {
    return !this.text.length;
  }
  blur() {
    this.focused = false;
    this.update();
    return this;
  }
  focus(e?: MouseEvent) {
    this.focused = true;
    e && this._focusHandler(e);
    this.update();
    return this;
  }
  setSelections(selections: Selection[]) {
    const ptrs = selections.flat().sort((a, b) => a - b).filter(ptr => ptr <= this.text.length + 1);
    this.selections = [];
    const l = ptrs.length;
    for (let i = 0; i < l; i++) {
      const ptr = ptrs[i];
      if (i % 2) {
        const selection = tail(this.selections);
        if (selection) {
          selection[1] = ptr;
        }
      } else {
        this.selections.push([ptr, 0]);
      }
    }
    this.update();
    return this;
  }
  setSelectionFromAnchor(anchor: number, focus: number) {
    const selection = this.selections.find(selection => selection[0] === anchor);
    if (selection) {
      selection[1] = focus;
      this.setSelections(this.selections);
      return true;
    }
    return false;
  }
  pushSelection(selection: Selection) {
    this.setSelections([...this.selections, selection]);
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
      this.editor._stack.push({
        type: Operation.INSERT_TEXT,
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
  deleteText(startIndex = this.cursorIndex, endIndex = this.cursorIndex - 1, pushToStack = true) {
    const arr = this.text.split('');
    const deleted = arr.splice(min(startIndex, endIndex), abs(startIndex - endIndex));
    if (pushToStack) {
      this.editor._stack.push({
        type: Operation.DELETE_TEXT,
        id: this.id,
        text: deleted.join(''),
        cursorIndex: this.cursorIndex,
        startIndex: min(startIndex, endIndex),
        selections: deepClone(this.selections),
      });
    }
    this.text = arr.join('');
    if (startIndex > endIndex) {
      this.cursorIndex -= startIndex - endIndex;
    }
    this.update();
    return this;
  }
  setCursor(index: number) {
    index = max(0, min(index, this.text.length));
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
  dispose() {
    this.elm.removeEventListener('mousedown', this._focusHandler);
    this.elm.removeEventListener('mousemove', this._select);
    this.elm.remove();
  }
  private _focusHandler = (e: MouseEvent) => {
    this.editor.focus(this);
    const originX = this.elm.getBoundingClientRect().left + 32;
    const cursorIndex = round((e.clientX - originX) / this.editor.charWidth);
    this.setCursor(cursorIndex);
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
      const charWidth = this.editor.charWidth;
      const originX = this.elm.getBoundingClientRect().left + 32;
      const focus = round((e.clientX - originX) / charWidth);
      const anchor = min(round((this.editor.selectionAnchor.x - originX) / charWidth), this.text.length);
      if (lineNumber < anchorNumber && !this.setSelectionFromAnchor(max(focus, 0), this.text.length + 1)) {
        alt ?
          this.pushSelection([max(focus, 0), this.text.length + 1]) :
          this.setSelections([[max(focus, 0), this.text.length + 1]])
      } else if (lineNumber === anchorNumber && !this.setSelectionFromAnchor(max(0, min(focus, anchor)), min(this.text.length, max(focus, anchor)))) {
        alt ?
          this.pushSelection([max(0, min(focus, anchor)), min(this.text.length, max(focus, anchor))]) :
          this.setSelections([[max(0, min(focus, anchor)), min(this.text.length, max(focus, anchor))]])
      } else if (lineNumber > anchorNumber && !this.setSelectionFromAnchor(0, min(focus, this.text.length))) {
        alt ?
          this.pushSelection([0, min(focus, this.text.length)]) :
          this.setSelections([[0, min(focus, this.text.length)]])
      }
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
