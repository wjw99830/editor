import { h, $ } from '../dom';
import { EditorConfig, Empty } from '../types';
import { Line } from './line';
import { tail, microtask } from '../util';
import { ShortcutsEmitter, isControlKeyPressed, isTextKey, KeyCodeMap, isControlKey } from './shortcuts-emitter';
import { snippet, autoCompleteValues, autoCompleteKeys } from './snippet';
import { downEnter, upEnter, rightIndent, leftIndent, leftMove, rightMove, upMove, downMove, tab, leftDelete, rightDelete } from './shortcuts';
import { EventEmitter } from './event-emitter';
import { Stack, Operation } from './stack';

const { min, max, round } = Math;
let eid = 0;
export class Editor extends EventEmitter {
  public lines: Line[] = [];
  public config!: EditorConfig;
  public userInput = '';
  public charWidth = 0;
  public twoBytesCharWidth = 0;
  public shortcutsEmitter = new ShortcutsEmitter();
  public currentLine?: Line;
  public selecting = false;
  public selectionAnchor = {
    x: 0, lineNumber: -1,
  };
  public _decorators: Set<Decorator> = new Set();
  public _stack: Stack = new Stack(this);
  public _isComposing = false;
  private _id = ++eid;
  private _editorElm!: HTMLElement;

  constructor(
    public elm: HTMLElement,
    config: Partial<EditorConfig> = {},
  ) {
    super();
    config.tabSize = config.tabSize || 2;
    config.lang = config.lang || 'javascript';
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

  appendLine(newLine: Line, pushToStack?: boolean): this;
  appendLine(target: Line, newLine: Line, pushToStack?: boolean): this;
  appendLine(target: Line, newLine: Line | boolean = true, pushToStack = true) {
    const nextLine = this.lines[this.lines.indexOf(target) + 1];
    let _pushToStack = true;
    let prevId: number | void;
    let newId: number;
    if (newLine instanceof Line) {
      newId = newLine.id;
      prevId = target.id;
      newLine.prevLine = target;
      target.nextLine = newLine;
      this.lines.splice(this.lines.indexOf(target) + 1, 0, newLine);
      if (nextLine) {
        newLine.nextLine = nextLine;
        nextLine.prevLine = newLine;
        this._editorElm.insertBefore(newLine.elm, nextLine.elm);
      } else {
        this._editorElm.appendChild(newLine.elm);
      }
      _pushToStack = pushToStack;
    } else {
      newId = target.id;
      const prevLine = tail(this.lines);
      if (prevLine) {
        prevLine.nextLine = target;
        target.prevLine = prevLine;
        prevId = prevLine.id;
      }
      this.lines.push(target);
      this._editorElm.appendChild(target.elm);
      _pushToStack = newLine;
    }
    if (_pushToStack) {
      this._stack.push({
        type: Operation.INSERT_LINE,
        prevId,
        newId,
      });
    }
    return this;
  }
  prependLine(target: Line, newLine: Line, pushToStack = true) {
    const prevLine = this.lines[this.lines.indexOf(target) - 1];
    if (prevLine) {
      prevLine.nextLine = newLine;
      newLine.prevLine = prevLine;
    }
    this.lines.splice(this.lines.indexOf(target), 0, newLine);
    this._editorElm.insertBefore(newLine.elm, target.elm);
    target.prevLine = newLine;
    newLine.nextLine = target;
    if (pushToStack) {
      this._stack.push({
        type: Operation.INSERT_LINE,
        newId: newLine.id,
        nextId: target.id,
      });
    }
    return this;
  }
  removeLine(target: Line, pushToStack = true) {
    const index = this.lines.indexOf(target);
    const prevLine = this.lines[index - 1];
    const nextLine = this.lines[index + 1];
    if (prevLine) {
      prevLine.nextLine = nextLine;
    }
    if (nextLine) {
      nextLine.prevLine = prevLine;
    }
    this.lines.splice(index, 1);
    if (pushToStack) {
      this._stack.push({
        type: Operation.REMOVE_LINE,
        state: target.clone(),
      });
    }
    target.dispose();
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
  getSelectedText() {
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
  deleteSelectedText() {
    const selectedText = this.getSelectedText();
    for (let i = 0; i < this.lines.length; i++) {
      let line: Line | Empty = this.lines[i];
      if (!line.selections.length) {
        continue;
      }
      let selectionsLengh;
      let tailSelection;
      let nextLine: Line | Empty;
      let textLength;
      // Recursively delete selected text for behind
      while (line) {
        selectionsLengh = line.selections.length;
        textLength = line.text.length;
        for (let j = 0; j < selectionsLengh; j++) {
          const selection = line.selections[j];
          line.deleteText(selection[0], selection[1], false);
          line.setCursor(selection[0]);
        }
        tailSelection = tail(line.selections);
        nextLine = line.nextLine;
        if (this.lines[i] !== line) {
          const prevLine = line.prevLine;
          if (prevLine) {
            const startIndex = prevLine.text.length;
            prevLine.insertText(line.text, startIndex, false);
            prevLine.setCursor(startIndex);
          }
          this.removeLine(line);
        }
        if (tailSelection && tailSelection[1] === textLength + 1) {
          line.setSelections([]);
          line = nextLine;
        } else {
          line.setSelections([]);
          line = null;
        }
      }
      this.focus(this.lines[i]);
    }
    return selectedText;
  }
  clearSelections() {
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      line.setSelections([]);
    }
  }
  cut = (pushToStack: Event | boolean = true) => {
    const startLine = this.lines.find(line => line.selections.length);
    const startIndex = startLine ? startLine.cursorIndex : 0;
    const selectedText = this.deleteSelectedText();
    if (startLine && pushToStack) {
      this._stack.push({
        type: Operation.CUT,
        id: startLine.id,
        startIndex,
        text: selectedText,
      });
    }
  }
  deserialize(text: string) {
    let l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      line.dispose();
    }
    this.lines = [];
    const rows = text.replace(/\t/g, ' '.repeat(this.config.tabSize)).split('\n');
    l = rows.length;
    for (let i = 0; i < l; i++) {
      const row = rows[i];
      this.appendLine(new Line(this).setText(row), false);
    }
    const tailLine = tail(this.lines);
    if (tailLine) {
      this.focus(tailLine);
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
    const line = new Line(this);
    this.appendLine(line, false);
    const textarea = h('textarea');
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
    textarea.addEventListener('cut', this.cut);
    this.elm.appendChild(editor);
    this.elm.appendChild(textarea);
    this.shortcutsEmitter.on('ctrl + s', e => {
      e.preventDefault();
      this.emit('save', this.serialize());
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
    this.shortcutsEmitter.on('ctrl + arrowleft', leftMove(this));
    this.shortcutsEmitter.on('arrowright', rightMove(this));
    this.shortcutsEmitter.on('ctrl + arrowright', rightMove(this));
    this.shortcutsEmitter.on('arrowup', upMove(this));
    this.shortcutsEmitter.on('ctrl + arrowup', upMove(this));
    this.shortcutsEmitter.on('arrowdown', downMove(this));
    this.shortcutsEmitter.on('ctrl + arrowdown', downMove(this));

    this._onMounted();
  }
  private _onKeyDown = (e: KeyboardEvent) => {
    const focusedLine = this.findFocusedLine();
    if (!focusedLine || this._isComposing) {
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
    const target = e.target as HTMLTextAreaElement;
    // @ts-ignore
    if (e.isComposing || e.inputType && e.inputType !== 'insertText' && e.inputType !== 'insertFromPaste') {
      // @ts-ignore
      this._isComposing = !!e.isComposing;
      if (!this._isComposing) {
        target.value = '';
      }
      return;
    }
    this._isComposing = false;
    this.userInput = target.value;
    target.value = '';
    const focusedLine = this.findFocusedLine();
    if (!focusedLine) { return; }
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
        const line = this.lines[i];
        if (line.selections.length) {
          line.setSelections([]);
        }
      }
    }
  }
  private _select = (e: MouseEvent) => {
    if (this.selecting) {
      const alt = e.altKey;
      const anchorNumber = this.selectionAnchor.lineNumber;
      const focusedLine = e.composedPath().find(target => {
        const elm = target as HTMLElement;
        return elm.classList && elm.classList.contains('line');
      }) as HTMLElement | Empty;
      if (focusedLine) {
        const focusedNumber = Number(focusedLine.dataset.lineNumber);
        const lineLength = this.lines.length;
        const charWidth = this.charWidth;
        for (let i = 1; i <= lineLength; i++) {
          const line = this.lines[i - 1];
          if ((i < min(anchorNumber, focusedNumber) || i > max(anchorNumber, focusedNumber)) && !alt) {
            line.setSelections([]);
          } else if (i > min(anchorNumber, focusedNumber) && i < max(anchorNumber, focusedNumber)) {
            line.setSelections([[0, line.text.length + 1]]);
          } else if (i === min(anchorNumber, focusedNumber) && focusedNumber !== i) {
            const originX = line.elm.getBoundingClientRect().left + 32;
            const anchorIndex = min(round((this.selectionAnchor.x - originX) / charWidth), line.text.length);
            if (!line.setSelectionFromAnchor(anchorIndex, line.text.length + 1)) {
              alt ?
                line.pushSelection([anchorIndex, line.text.length + 1]) :
                line.setSelections([[anchorIndex, line.text.length + 1]]);
            }
          } else if (i === max(anchorNumber, focusedNumber) && focusedNumber !== i) {
            const originX = line.elm.getBoundingClientRect().left + 32;
            const anchorIndex = min(round((this.selectionAnchor.x - originX) / charWidth), line.text.length);
            if (!line.setSelectionFromAnchor(0, anchorIndex)) {
              alt ?
                line.pushSelection([0, anchorIndex]) :
                line.setSelections([[0, anchorIndex]]);
            }
          }
        }
        this.focus(this.lines[focusedNumber - 1]);
        const originX = focusedLine.getBoundingClientRect().left + 32;
        this.lines[focusedNumber - 1].setCursor(round((e.clientX - originX) / charWidth));
      }
    }
  }
  private _endSelect = () => {
    this.selecting = false;
    const textarea = this.elm.querySelector('textarea');
    if (textarea) {
      textarea.value = this.getSelectedText();
      textarea.select();
    }
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
        this.charWidth = rect.width;
        textNode.textContent = '中';
        range.setStart(textNode, 0);
        range.setEnd(textNode, 1);
        this.twoBytesCharWidth = range.getBoundingClientRect().width;
        selection.removeRange(range);
        range.detach();
        textNode.remove();
      }
    }
  }
}
type Decorator = (line: HTMLElement) => any;
