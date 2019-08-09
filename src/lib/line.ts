import { EditorConfig } from "../types";
import { safetyHTML } from "../util";
import { Editor } from "./editor";
import { h } from "../dom";
import { autoCompleteEntries, autoCompleteMap } from "./snippet";

let lid = 0;
export class Line {
  public id: number = ++lid;
  public text = '';
  public focused = false;
  public indent = 0;
  public cursorIndex = 0;
  public elm!: HTMLElement;
  public editorConfig!: EditorConfig;
  constructor(
    public editor: Editor,
  ) {
    this.editorConfig = editor.config;
    this._createElm();
  }
  isEmpty() {
    return !(this.text.length + this.indent);
  }
  focus() {
    this.focused = true;
    this.update();
    return this;
  }
  setIndent(indent: number) {
    this.indent = indent;
    this.cursorIndex = this.indent + this.text.length;
    this.update();
    return this;
  }
  incIndent() {
    this.indent += 1;
    this.cursorIndex += 1;
    this.update();
    return this;
  }
  decIndent() {
    if (this.indent) {
      this.indent -= 1;
      this.cursorIndex -= 1;
    }
    this.update();
    return this;
  }
  tabIndent() {
    this.indent += this.editorConfig.tabSize;
    this.cursorIndex += this.editorConfig.tabSize;
    this.update();
    return this;
  }
  decTabIndent() {
    if (this.indent) {
      this.indent -= this.editorConfig.tabSize;
      this.cursorIndex -= this.editorConfig.tabSize;
    }
    this.update();
    return this;
  }
  getFullText() {
    return ' '.repeat(this.indent) + this.text;
  }
  setText(text: string) {
    this.text = text;
    this.cursorIndex = this.indent + this.text.length;
    this.update();
    return this;
  }
  backspace() {
    if (this.cursorIndex <= this.indent) {
      this.decIndent();
    } else {
      this.decText();
    }
    this.update();
  }
  decText() {
    if (this.text.length) {
      const chars = this.text.split('').filter(Boolean);
      const shouleDeleteIndex = this.cursorIndex - this.indent - 1
      const rightChar = chars[shouleDeleteIndex + 1];
      const leftChar = chars[shouleDeleteIndex];
      let deleteCount = autoCompleteMap[leftChar] === rightChar ? 2 : 1;
      chars.splice(shouleDeleteIndex, deleteCount);
      this.text = chars.join('');
      this.cursorIndex -= 1;
    }
    this.update();
    return this;
  }
  appendText(text: string) {
    if (!this.text.length) {
      const spaceStart = text.match(/^ */);
      if (spaceStart) {
        this.indent += spaceStart[0].length;
      }
    }
    text = this.text.length ? text : text.replace(/^ */g, '');
    const chars = this.text.split('').filter(Boolean);
    chars.splice(this.cursorIndex - this.indent, 0, ...text.split('').filter(Boolean));
    this.text = chars.join('');
    this.cursorIndex += autoCompleteEntries.includes(text) ? 1 : text.split('').filter(Boolean).length;
    this.update();
    return this;
  }
  setCursor(index: number) {
    this.cursorIndex = index;
    this.update();
    return this;
  }
  moveToMaxCursor() {
    this.cursorIndex = this.indent + this.text.length;
    this.update();
    return this;
  }
  getMaxCursor() {
    return this.indent + this.text.length;
  }
  update() {
    const num = this.editor.lines.indexOf(this) + 1;
    if (this.focused) {
      this.elm.classList.add('text-line--focused');
    } else {
      this.elm.classList.remove('text-line--focused');
    }
    this.elm.querySelector('.line-number')!.textContent = num.toString();
    this.elm.querySelector('.text-line--content--inner')!.innerHTML = safetyHTML(' '.repeat(this.indent) + this.text);
    this.elm.querySelector('.text-line--content--overlay')!.innerHTML = safetyHTML(' '.repeat(this.cursorIndex))
  }
  private _createElm() {
    const lineElm = h('div', undefined, { class: 'text-line', id: 'line-' + this.id.toString() });
    lineElm.addEventListener('mousedown', e => {
      e.stopPropagation();
      this.editor.focus(this);
    });
    this.elm = lineElm;
    const contentElm = h('span', undefined, { class: 'text-line--content' });
    const contentInnerElm = h('span', {
      innerHTML: safetyHTML(' '.repeat(this.indent) + this.text),
    }, { class: 'text-line--content--inner' });
    const contentOverlayElm = h('span', {
      innerHTML: safetyHTML(' '.repeat(this.cursorIndex)),
    }, { class: 'text-line--content--overlay' });
    contentElm.appendChild(contentInnerElm)
    contentElm.appendChild(contentOverlayElm);
    lineElm.appendChild(h('span', undefined, { class: 'line-number' }));
    lineElm.appendChild(contentElm);
    this.update();
  }
}
