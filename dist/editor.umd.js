(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Editor = factory());
}(this, function () { 'use strict';

  const $ = (sel) => document.querySelector(sel);
  const h = (tag, props = {}, attrs = {}, text = '') => {
      const elm = document.createElement(tag);
      for (const [key, value] of Object.entries(props)) {
          elm[key] = value;
      }
      for (const [key, value] of Object.entries(attrs)) {
          elm.setAttribute(key, value || '');
      }
      elm.textContent = text.toString();
      return elm;
  };

  const tail = (arr) => arr[arr.length - 1];
  const safetyHTML = (html) => {
      return html.replace('>', '&gt;').replace('<', '&lt;').replace(/ /g, '&nbsp;');
  };
  const microtask = (fn, arg) => Promise.resolve(arg).then(fn);

  const snippet = (input) => {
      return input + (autoCompleteMap[input] || '');
  };
  const autoCompleteMap = {
      '{': '}',
      '[': ']',
      '(': ')',
      '\'': '\'',
      '"': '"',
      '<': '>',
  };
  const autoCompleteKeys = Object.keys(autoCompleteMap);
  const autoCompleteValues = Object.values(autoCompleteMap);
  const autoCompleteEntries = Object.entries(autoCompleteMap).map(([key, value]) => key + value);

  let lid = 0;
  class Line {
      constructor(editor) {
          this.editor = editor;
          this.id = ++lid;
          this.text = '';
          this.focused = false;
          this.indent = 0;
          this.cursorIndex = 0;
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
      setIndent(indent) {
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
      setText(text) {
          this.text = text;
          this.cursorIndex = this.indent + this.text.length;
          this.update();
          return this;
      }
      backspace() {
          if (this.cursorIndex <= this.indent) {
              this.decIndent();
          }
          else {
              this.decText();
          }
          this.update();
      }
      decText() {
          if (this.text.length) {
              const chars = this.text.split('').filter(Boolean);
              const shouleDeleteIndex = this.cursorIndex - this.indent - 1;
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
      appendText(text) {
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
      setCursor(index) {
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
          }
          else {
              this.elm.classList.remove('text-line--focused');
          }
          this.elm.querySelector('.line-number').textContent = num.toString();
          this.elm.querySelector('.text-line--content--inner').innerHTML = safetyHTML(' '.repeat(this.indent) + this.text);
          this.elm.querySelector('.text-line--content--overlay').innerHTML = safetyHTML(' '.repeat(this.cursorIndex));
      }
      _createElm() {
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
          contentElm.appendChild(contentInnerElm);
          contentElm.appendChild(contentOverlayElm);
          lineElm.appendChild(h('span', undefined, { class: 'line-number' }));
          lineElm.appendChild(contentElm);
          this.update();
      }
  }

  class ShortcutsEmitter {
      constructor() {
          this.shortcuts = new Map();
      }
      emit(e) {
          const alt = e.altKey ? 'alt' : '';
          const ctrl = e.ctrlKey ? 'ctrl' : '';
          const shift = e.shiftKey ? 'shift' : '';
          const key = isTextKey(e.keyCode) ? (KeyCodeMap[e.keyCode] || e.key.toLowerCase()) : (isControlKey(e.key) ? '' : e.code.toLowerCase());
          const combined = [ctrl, shift, alt, key].filter(Boolean).join('+');
          const handlers = this.shortcuts.get(combined);
          if (!e.key.startsWith('F')) {
              e.preventDefault();
          }
          if (handlers) {
              for (const handler of handlers) {
                  handler();
              }
          }
      }
      on(shortcuts, handler) {
          shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
          let handlers = this.shortcuts.get(shortcuts);
          if (handlers) {
              handlers.add(handler);
          }
          else {
              handlers = new Set();
              handlers.add(handler);
              this.shortcuts.set(shortcuts, handlers);
          }
      }
      off(shortcuts, handler) {
          shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
          const handlers = this.shortcuts.get(shortcuts);
          if (handlers) {
              handlers.delete(handler);
          }
      }
  }
  const isTextKey = (keyCode) => {
      return keyCode >= 48 && keyCode <= 57 || keyCode >= 65 && keyCode <= 90 || keyCode >= 186 && keyCode <= 192 || keyCode >= 219 && keyCode <= 222;
  };
  const isControlKey = (key) => {
      return ['Control', 'Alt', 'Shift'].includes(key);
  };
  const isControlKeyPressed = (e) => {
      return e.ctrlKey || e.altKey;
  };
  const KeyCodeMap = {
      48: '0',
      49: '1',
      50: '2',
      51: '3',
      52: '4',
      53: '5',
      54: '6',
      55: '7',
      56: '8',
      57: '9',
      187: '=',
      188: ',',
      189: '-',
      190: '.',
      191: '/',
      192: '`',
      219: '[',
      220: '\\',
      221: ']',
      222: '\'',
  };

  function upEnter(editor) {
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
  function downEnter(editor) {
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
                  }
                  else if (autoCompleteValues.includes(focusedLine.getFullText()[focusedLine.cursorIndex])) {
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
  function backspace(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              if (focusedLine.isEmpty()) {
                  const prevLine = editor.findPrevLine(focusedLine);
                  if (prevLine) {
                      editor.removeLine(focusedLine);
                      editor.focus(prevLine);
                  }
              }
              else if (focusedLine.cursorIndex > 0) {
                  focusedLine.backspace();
              }
              else {
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
  function leftMove(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const cursorIndex = focusedLine.cursorIndex;
              if (cursorIndex > 0) {
                  focusedLine.setCursor(focusedLine.cursorIndex - 1);
              }
              else {
                  const prevLine = editor.findPrevLine(focusedLine);
                  if (prevLine) {
                      focusedLine.moveToMaxCursor();
                      editor.focus(prevLine);
                  }
              }
          }
      };
  }
  function rightMove(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const cursorIndex = focusedLine.cursorIndex;
              if (cursorIndex < focusedLine.getMaxCursor()) {
                  focusedLine.setCursor(cursorIndex + 1);
              }
              else {
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
  function upMove(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const cursorIndex = focusedLine.cursorIndex;
              const prevLine = editor.findPrevLine(focusedLine);
              if (prevLine) {
                  if (prevLine.getMaxCursor() >= cursorIndex) {
                      prevLine.setCursor(cursorIndex);
                  }
                  else {
                      prevLine.moveToMaxCursor();
                  }
                  focusedLine.moveToMaxCursor();
                  editor.focus(prevLine);
              }
          }
      };
  }
  function downMove(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const cursorIndex = focusedLine.cursorIndex;
              const nextLine = editor.findNextLine(focusedLine);
              if (nextLine) {
                  if (nextLine.getMaxCursor() >= cursorIndex) {
                      nextLine.setCursor(cursorIndex);
                  }
                  else {
                      nextLine.moveToMaxCursor();
                  }
                  focusedLine.moveToMaxCursor();
                  editor.focus(nextLine);
              }
          }
      };
  }
  function tab(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              if (focusedLine.cursorIndex <= focusedLine.indent) {
                  focusedLine.tabIndent();
              }
              else {
                  focusedLine.appendText(' '.repeat(editor.config.tabSize));
              }
          }
      };
  }
  function space(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              if (focusedLine.indent >= focusedLine.cursorIndex) {
                  focusedLine.incIndent();
              }
              else {
                  focusedLine.appendText(' ');
              }
          }
      };
  }
  function rightIndent(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              focusedLine.tabIndent();
          }
      };
  }
  function leftIndent(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              focusedLine.decTabIndent();
          }
      };
  }

  let eid = 0;
  class Editor {
      constructor(elm, config = {}) {
          this.elm = elm;
          this.lines = [];
          this.userInput = '';
          this.charWidth = 0;
          this.shortcutsEmitter = new ShortcutsEmitter();
          this.id = ++eid;
          config.tabSize = config.tabSize || 2;
          this.config = config;
          this.mount();
      }
      findPrevLine(line) {
          return this.lines[this.lines.indexOf(line) - 1];
      }
      findNextLine(line) {
          return this.lines[this.lines.indexOf(line) + 1];
      }
      findFocusedLine() {
          return this.lines.find(line => line.focused);
      }
      appendLine(target, newLine) {
          if (newLine) {
              this.lines.splice(this.lines.indexOf(target) + 1, 0, newLine);
              const nextSibling = target.elm.nextElementSibling;
              if (nextSibling) {
                  this._editorElm.insertBefore(newLine.elm, nextSibling);
              }
              else {
                  this._editorElm.appendChild(newLine.elm);
              }
          }
          else {
              this.lines.push(target);
              this._editorElm.appendChild(target.elm);
          }
          return this;
      }
      prependLine(target, newLine) {
          this.lines.splice(this.lines.indexOf(target), 0, newLine);
          this._editorElm.insertBefore(newLine.elm, target.elm);
          return this;
      }
      removeLine(target) {
          this.lines.splice(this.lines.indexOf(target), 1);
          this._editorElm.removeChild(target.elm);
          return this;
      }
      focus(line) {
          this.currentLine = line;
          if (line && line.focused) {
              return;
          }
          const textarea = this.elm.querySelector('textarea');
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
      onKeyDown(e) {
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
              const textarea = this.elm.querySelector('textarea');
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
      onInput(e) {
          if (e.isComposing) {
              return;
          }
          const target = e.target;
          this.userInput = target.value.trim();
          target.value = '';
          const focusedLine = this.findFocusedLine();
          if (focusedLine) {
              const nextChar = focusedLine.getFullText()[focusedLine.cursorIndex];
              if (autoCompleteValues.includes(nextChar) && nextChar === this.userInput) {
                  focusedLine.setCursor(focusedLine.cursorIndex + 1);
              }
              else {
                  focusedLine.appendText(snippet(this.userInput));
              }
          }
      }
      startSelect() { }
      mount() {
          const editor = h('div', undefined, { class: 'editor', id: 'editor-' + this.id });
          this._editorElm = editor;
          const linesFragment = document.createDocumentFragment();
          const line = new Line(this);
          this.appendLine(line);
          const textarea = h('textarea');
          editor.appendChild(linesFragment);
          editor.addEventListener('mousedown', () => this.focus());
          editor.addEventListener('mousedown', this.startSelect.bind(this));
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
          const editor = $('#editor-' + this.id);
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

  return Editor;

}));
