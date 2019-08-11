import { h, $, writeClipboard } from "../dom";
import { EditorConfig, Empty } from "../types";
import { Line } from "./line";
import { tail } from "../util";
import { ShortcutsEmitter, isControlKeyPressed, isTextKey, KeyCodeMap, isControlKey } from "./shortcuts-emitter";
import { snippet, autoCompleteValues, autoCompleteKeys } from "./snippet";
import { downEnter, upEnter, rightIndent, leftIndent, leftMove, rightMove, upMove, downMove, tab, leftDelete, rightDelete } from "./shortcuts";
import { EventEmitter } from "./event-emitter";
import { Stack } from "./stack";

const { min, max, round } = Math;
let eid = 0;
export class Editor extends EventEmitter {
  public lines: Line[] = [];
  public config!: EditorConfig;
  public userInput = '';
  public charWidth = 0;
  public shortcutsEmitter = new ShortcutsEmitter();
  public currentLine?: Line;
  public selecting = false;
  public selectionAnchor = {
    x: 0, lineNumber: -1,
  };
  public _decorators: Set<Decorator> = new Set();
  public _stack: Stack = new Stack(this);
  private _id = ++eid;
  private _editorElm!: HTMLElement;

  constructor(
    public elm: HTMLElement,
    config: Partial<EditorConfig> = {},
  ) {
    super();
    config.tabSize = config.tabSize || 2;
    this.config = config as EditorConfig;
    this._mount();
  }

  useDecorator(decorator: Decorator) {
    this._decorators.add(decorator);
    return this;
  }
  findPrevLine(line: Line): Line | Empty {
    return this.lines[this.lines.indexOf(line) - 1];
  }
  findNextLine(line: Line): Line | Empty {
    return this.lines[this.lines.indexOf(line) + 1];
  }
  findFocusedLine(): Line | Empty {
    return this.lines.find(line => line.focused);
  }

  appendLine(newLine: Line): this;
  appendLine(target: Line, newLine: Line): this;
  appendLine(target: Line, newLine?: Line) {
    if (newLine) {
      this.lines.splice(this.lines.indexOf(target) + 1, 0, newLine);
      const nextSibling = target.elm.nextElementSibling;
      if (nextSibling) {
        this._editorElm.insertBefore(newLine.elm, nextSibling);
      } else {
        this._editorElm.appendChild(newLine.elm);
      }
    } else {
      this.lines.push(target);
      this._editorElm.appendChild(target.elm);
    }
    return this;
  }
  prependLine(target: Line, newLine: Line) {
    this.lines.splice(this.lines.indexOf(target), 0, newLine);
    this._editorElm.insertBefore(newLine.elm, target.elm);
    return this;
  }
  removeLine(target: Line) {
    this.lines.splice(this.lines.indexOf(target), 1);
    this._editorElm.removeChild(target.elm);
    return this;
  }
  focus = (line: Line, e?: MouseEvent) => {
    this.currentLine = line;
    const textarea = this.elm.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
    }
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      line.blur();
    }
    line.focus(e);
  }
  deserialize(text: string) {
    let l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      line.dispose();
    }
    this.lines = [];
    const rows = text.split('\n');
    l = rows.length;
    for (let i = 0; i < l; i++) {
      const row = rows[i];
      this.appendLine(new Line(this).setText(row));
    }
  }
  serialize() {
    const text: string[] = [];
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      text.push(line.text);
    }
    return text.join('\n');
  }
  dispose() {
    const editor = this._editorElm;
    const textarea = this.elm.querySelector('textarea')!;
    document.removeEventListener('mouseup', this._endSelect);
    editor.removeEventListener('mousedown', this._startSelect);
    editor.removeEventListener('mousemove', this._select);
    editor.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('mouseup', this._endSelect);
    textarea.removeEventListener('blur', this._onBlur);
    textarea.removeEventListener('input', this._onInput);
    textarea.removeEventListener('compositionend', this._onInput);
    textarea.removeEventListener('keydown', this._onKeyDown);
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      line.dispose();
    }
    editor.remove();
    textarea.remove();
  }
  private _mount() {
    const editor = h('div', undefined, { class: 'editor', id: 'editor-' + this._id });
    this._editorElm = editor;
    const linesFragment = document.createDocumentFragment();
    const line = new Line(this);
    this.appendLine(line);
    const textarea = h('textarea');
    editor.appendChild(linesFragment);
    editor.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('editor')) {
        const lastLine = tail(this.lines);
        if (lastLine) {
          this.focus(lastLine, e);
        }
      }
    });
    editor.addEventListener('mousedown', this._startSelect);
    editor.addEventListener('mousemove', this._select);
    editor.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('mouseup', this._endSelect);
    textarea.addEventListener('blur', this._onBlur);
    textarea.addEventListener('input', this._onInput);
    textarea.addEventListener('compositionend', this._onInput);
    textarea.addEventListener('keydown', this._onKeyDown);
    textarea.addEventListener('copy', (e) => {
      e.preventDefault();
      writeClipboard(this._getSelectedText());
    });
    this.elm.appendChild(editor);
    this.elm.appendChild(textarea);
    this.shortcutsEmitter.on('ctrl + s', e => {
      e.preventDefault();
      this.emit('save', this.serialize());
    });
    this.shortcutsEmitter.on('ctrl + x', () => {
      writeClipboard(this._clipSelectedText());
    });
    this.shortcutsEmitter.on('ctrl + shift + enter', upEnter(this));
    this.shortcutsEmitter.on('enter', downEnter(this));
    this.shortcutsEmitter.on('ctrl + ]', rightIndent(this));
    this.shortcutsEmitter.on('ctrl + [', leftIndent(this));
    this.shortcutsEmitter.on('backspace', leftDelete(this));
    this.shortcutsEmitter.on('delete', rightDelete(this));
    this.shortcutsEmitter.on('ctrl + backspace', leftDelete(this));
    this.shortcutsEmitter.on('ctrl + delete', rightDelete(this));
    this.shortcutsEmitter.on('ctrl + z', this._stack.undo);
    this.shortcutsEmitter.on('tab', tab(this));
    this.shortcutsEmitter.on('arrowleft', leftMove(this));
    this.shortcutsEmitter.on('arrowright', rightMove(this));
    this.shortcutsEmitter.on('arrowup', upMove(this));
    this.shortcutsEmitter.on('arrowdown', downMove(this));
    
    this._onMounted();
  }
  private _onKeyDown = (e: KeyboardEvent) => {
    const focusedLine = this.findFocusedLine();
    if (!focusedLine) {
      return;
    }
    if (isControlKeyPressed(e) || !isTextKey(e.keyCode)) {
      const alt = e.altKey ? 'alt' : '';
      const ctrl = e.ctrlKey ? 'ctrl' : '';
      const shift = e.shiftKey ? 'shift' : '';
      const key = isTextKey(e.keyCode) ? (KeyCodeMap[e.keyCode] || e.key.toLowerCase()) : (isControlKey(e.key) ? '' : e.code.toLowerCase());
      const combined = [ctrl, shift, alt, key].filter(Boolean).join('+');
      this.shortcutsEmitter.emit(combined, e);
    }
  }
  private _onBlur = () => {
    if (this.currentLine) {
      const textarea = this.elm.querySelector('textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
      }
    }
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      const focused = this.currentLine === line;
      if (line.focused !== focused) {
        line.focused = focused;
        line.update();
      }
    }
    this.currentLine = undefined;
  }
  private _onInput = (e: Event) => {
    // @ts-ignore
    if (e.isComposing || e.inputType !== 'insertText') {
      return;
    }
    const target = e.target as HTMLTextAreaElement;
    this.userInput = target.value;
    target.value = '';
    const focusedLine = this.findFocusedLine();
    if (focusedLine) {
      if (this.userInput.length === 1 && !this.userInput.includes('\n')) {
        const nextChar = focusedLine.text[focusedLine.cursorIndex];
        if (autoCompleteValues.includes(nextChar) && nextChar === this.userInput) {
          focusedLine.setCursor(focusedLine.cursorIndex + 1);
        } else {
          focusedLine.insertText(snippet(this.userInput));
          if (autoCompleteKeys.includes(this.userInput)) {
            focusedLine.setCursor(focusedLine.cursorIndex - 1);
          }
        }
      } else if (!this.userInput.includes('\n') && this.userInput.length > 1) {
        focusedLine.insertText(this.userInput);
      } else if (this.userInput.includes('\n') && this.userInput.trim().length > 1) {
        const focusedIndex = this.lines.indexOf(focusedLine);
        const rows = this.userInput.split('\n').filter(Boolean);
        const l = rows.length;
        for (let i = l - 1; i >= 0; i--) {
          const row = rows[i];
          if (i === 0) {
            focusedLine.insertText(row);
          } else {
            this.appendLine(focusedLine, new Line(this).setText(row));
          }
        }
        this.focus(this.lines[focusedIndex + l - 1]);
      }
    }
  }
  private _startSelect = (e: MouseEvent) => {
    const line = e.composedPath().find(target => {
      const elm = target as HTMLElement;
      return elm.classList && elm.classList.contains('line');
    }) as HTMLElement | Empty;
    if (line) {
      this.selecting = true;
      this.selectionAnchor = {
        x: e.clientX,
        lineNumber: Number(line.dataset.lineNumber),
      };
    }
    if (!e.altKey) {
      const l = this.lines.length;
      for (let i = 0; i < l; i++) {
        const element = this.lines[i];
        if (element.selections.length) {
          element.update();
        }
        element.selections = [];
      }
    }
  }
  private _select = (e: MouseEvent) => {
    if (this.selecting) {
      const alt = e.altKey;
      const anchorNumber = this.selectionAnchor.lineNumber;
      const focusLine = e.composedPath().find(target => {
        const elm = target as HTMLElement;
        return elm.classList && elm.classList.contains('line');
      }) as HTMLElement | Empty;
      if (focusLine) {
        const focusNumber = Number(focusLine.dataset.lineNumber);
        const lineLength = this.lines.length;
        const charWidth = this.charWidth;
        for (let i = 1; i < lineLength + 1; i++) {
          const line = this.lines[i - 1];
          if ((i < min(anchorNumber, focusNumber) || i > max(anchorNumber, focusNumber)) && !alt) {
            line.setSelections([]);
          } else if (i > min(anchorNumber, focusNumber) && i < max(anchorNumber, focusNumber)) {
            line.setSelections([[0, line.text.length]]);
          } else if (i === min(anchorNumber, focusNumber) && focusNumber !== i) {
            const originX = line.elm.getBoundingClientRect().left + 32;
            const anchorIndex = min(round((this.selectionAnchor.x - originX) / charWidth), line.text.length);
            if (!line.setSelectionFromAnchor(anchorIndex, line.text.length)) {
              alt ?
                line.pushSelection([anchorIndex, line.text.length]) :
                line.setSelections([[anchorIndex, line.text.length]])
            }
          } else if (i === max(anchorNumber, focusNumber) && focusNumber !== i) {
            const originX = line.elm.getBoundingClientRect().left + 32;
            const anchorIndex = min(round((this.selectionAnchor.x - originX) / charWidth), line.text.length);
            if (!line.setSelectionFromAnchor(0, anchorIndex)) {
              alt ?
                line.pushSelection([0, anchorIndex]) :
                line.setSelections([[0, anchorIndex]])
            }
          }
        }
      }
    }
  }
  private _endSelect = () => {
    this.selecting = false;
  }
  private _getSelectedText() {
    const text: string[] = [];
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      for (let j = 0; j < line.selections.length; j++) {
        const selection = line.selections[j];
        text.push((line.text || '').slice(selection[0], selection[1]));
      }
    }
    return text.join('\n');
  }
  private _clipSelectedText() {
    const text: string[] = [];
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      for (let j = 0; j < line.selections.length; j++) {
        const selection = line.selections[j];
        text.push((line.text || '').slice(selection[0], selection[1]));
        line.setText(line.text.slice(0, selection[0]) + line.text.slice(selection[1], line.text.length));
      }
    }
    return text.join('\n');
  }
  private _onMounted() {
    this.focus(this.lines[0]);
    this._calcCharRect();
  }
  private _calcCharRect() {
    const range = document.createRange();
    const textNode = document.createTextNode('0');
    range.setStart(textNode, 0);
    range.setEnd(textNode, 1);
    const editor = $('#editor-' + this._id);
    if (editor) {
      editor.appendChild(textNode);
      const selection = window.getSelection();
      if (selection) {
        selection.addRange(range);
        const rect = range.getBoundingClientRect();
        selection.removeRange(range);
        range.detach();
        textNode.remove();
        this.charWidth = rect.width;
      }
    }
  }
}
type Decorator = (line: HTMLElement) => any;
