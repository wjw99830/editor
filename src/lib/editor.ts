import { h, $ } from "../dom";
import { EditorConfig, Empty } from "../types";
import { Line } from "./line";
import { tail } from "../util";
import { ShortcutsEmitter, isControlKeyPressed, isTextKey } from "./shortcuts-emitter";
import { snippet, autoCompleteValues } from "./snippet";
import { downEnter, upEnter, rightIndent, leftIndent, backspace, space, leftMove, rightMove, upMove, downMove, tab } from "./shortcuts";

let eid = 0;
export class Editor {
  public lines: Line[] = [];
  public config!: EditorConfig;
  public userInput = '';
  public charWidth = 0;
  public shortcutsEmitter = new ShortcutsEmitter();
  public currentLine?: Line;
  private _id = ++eid;
  private _selecting = false;
  private _selectionAnchor = {
    x: 0, y: 0,
  };
  private _editorElm!: HTMLElement;

  constructor(
    public elm: HTMLElement,
    config: Partial<EditorConfig> = {},
  ) {
    config.tabSize = config.tabSize || 2;
    this.config = config as EditorConfig;
    this.mount();
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
  focus(line?: Line) {
    this.currentLine = line;
    if (line && line.focused) {
      return;
    }
    const textarea = this.elm.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
    }
    const l = this.lines.length;
    for (let i = 0; i < l; i++) {
      const line = this.lines[i];
      line.focused = false;
      line.update();
    }
    if (!line) {
      const lastLine = tail(this.lines);
      if (lastLine) {
        lastLine.focus();
        this.currentLine = lastLine;
      }
      return;
    }
    line.focus();
  }
  onKeyDown(e: KeyboardEvent) {
    const focusedLine = this.findFocusedLine();
    if (!focusedLine) {
      return;
    }
    if (isControlKeyPressed(e) || !isTextKey(e.keyCode)) {
      this.shortcutsEmitter.emit(e);
    }
  }
  onBlur() {
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
  onInput(e: any) {
    if (e.isComposing) {
      return;
    }
    const target = e.target as HTMLTextAreaElement;
    this.userInput = target.value.trim();
    target.value = '';
    const focusedLine = this.findFocusedLine();
    if (focusedLine) {
      const nextChar = focusedLine.getFullText()[focusedLine.cursorIndex];
      if (autoCompleteValues.includes(nextChar) && nextChar === this.userInput) {
        focusedLine.setCursor(focusedLine.cursorIndex + 1);
      } else {
        focusedLine.appendText(snippet(this.userInput));
      }
    }
  }
  startSelect(e: MouseEvent) {
    this._selecting = true;
    this._selectionAnchor = {
      x: e.clientX,
      y: e.clientY,
    };
  }
  select(e: MouseEvent) {
    if (this._selecting) {
      let targetLine: HTMLElement;
      const dx = e.clientX - this._selectionAnchor.x;
      const dy = e.clientY - this._selectionAnchor.y;
      if (dx <= 0 && dy > 0) {
        targetLine = e.target as HTMLElement;
        let line = e.composedPath().find(target => {
          const elm = target as HTMLElement;
          return elm.classList && elm.classList.contains('text-line');
        }) as HTMLElement | Empty;
        if (line) {
          targetLine = line;
        }
      }
    }
  }
  endSelect() {
    this._selecting = false;
  }

  mount() {
    const editor = h('div', undefined, { class: 'editor', id: 'editor-' + this._id });
    this._editorElm = editor;
    const linesFragment = document.createDocumentFragment();
    const line = new Line(this);
    this.appendLine(line);
    const textarea = h('textarea');
    editor.appendChild(linesFragment);
    editor.addEventListener('mousedown', () => this.focus());
    editor.addEventListener('mousedown', this.startSelect.bind(this));
    editor.addEventListener('mousemove', this.select.bind(this));
    editor.addEventListener('mouseup', this.endSelect.bind(this));
    editor.addEventListener('keydown', this.onKeyDown.bind(this));
    textarea.addEventListener('blur', this.onBlur.bind(this));
    textarea.addEventListener('input', this.onInput.bind(this));
    textarea.addEventListener('compositionend', this.onInput.bind(this));
    textarea.addEventListener('keydown', this.onKeyDown.bind(this));
    this.elm.appendChild(editor);
    this.elm.appendChild(textarea);
    this.shortcutsEmitter.on('ctrl + shift + enter', upEnter(this));
    this.shortcutsEmitter.on('enter', downEnter(this));
    this.shortcutsEmitter.on('ctrl + ]', rightIndent(this));
    this.shortcutsEmitter.on('ctrl + [', leftIndent(this));
    this.shortcutsEmitter.on('backspace', backspace(this));
    this.shortcutsEmitter.on('space', space(this));
    this.shortcutsEmitter.on('tab', tab(this));
    this.shortcutsEmitter.on('arrowleft', leftMove(this));
    this.shortcutsEmitter.on('arrowright', rightMove(this));
    this.shortcutsEmitter.on('arrowup', upMove(this));
    this.shortcutsEmitter.on('arrowdown', downMove(this));
    
    this.onMounted();
  }
  onMounted() {
    this.focus(this.lines[0]);
    this.calcCharRect();
  }
  calcCharRect() {
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
