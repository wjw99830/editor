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

  const stack = [];
  const Operation = {
      DELETE_TEXT: 'deleteText',
      INSERT_TEXT: 'insertText',
  };

  const tail = (arr) => arr[arr.length - 1];
  const microtask = (fn, arg) => Promise.resolve(arg).then(fn);
  const isArray = Array.isArray;
  const isRefType = (o) => o && typeof o === 'object';
  function deepClone(obj) {
      if (!isRefType(obj)) {
          return obj;
      }
      const copy = isArray(obj) ? [] : {};
      const stack = [{
              copy,
              target: obj,
          }];
      const copiedRefs = [];
      const { set, ownKeys, getOwnPropertyDescriptor } = Reflect;
      while (stack.length) {
          const { target, copy } = stack.pop();
          const keys = ownKeys(target);
          for (const key of keys) {
              const desc = getOwnPropertyDescriptor(target, key);
              if (desc && !desc.enumerable) {
                  continue;
              }
              const val = target[key];
              if (isRefType(val)) {
                  const copied = copiedRefs.find(copied => copied.target === val);
                  if (copied) {
                      set(copy, key, copied.copy);
                      continue;
                  }
                  const copyVal = isArray(val) ? [] : {};
                  set(copy, key, copyVal);
                  stack.push({
                      target: val,
                      copy: copyVal,
                  });
              }
              else {
                  set(copy, key, val);
              }
          }
          copiedRefs.push({
              target,
              copy,
          });
      }
      return copy;
  }

  let lid = 0;
  class Line {
      constructor(editor) {
          this.editor = editor;
          this.id = ++lid;
          this.text = '';
          this.focused = false;
          this.cursorIndex = 0;
          this.lineNumber = 0;
          this.selections = [];
          this._willUpdate = false;
          this._focusHandler = (e) => {
              this.editor.focus(this);
              const target = e.target;
              if (target.classList.contains('line--content')) {
                  this.setCursor(Math.round(e.offsetX / this.editor.charWidth));
              }
              else {
                  if (e.offsetX <= 30) {
                      this.setCursor(0);
                  }
                  else {
                      this.setCursor(this.text.length);
                  }
              }
          };
          this._select = (e) => {
              if (this.editor.selecting) {
                  const target = e.target;
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
                          (this.selections = [[Math.max(focus, 0), this.text.length]]);
                  }
                  else if (lineNumber === anchorNumber) {
                      alt ?
                          this.selections.push([Math.max(0, Math.min(focus, anchor)), Math.min(this.text.length, Math.max(focus, anchor))]) :
                          (this.selections = [[Math.max(0, Math.min(focus, anchor)), Math.min(this.text.length, Math.max(focus, anchor))]]);
                  }
                  else {
                      alt ?
                          this.selections.push([0, Math.min(focus, this.text.length)]) :
                          (this.selections = [[0, Math.min(focus, this.text.length)]]);
                  }
                  this.update();
              }
          };
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
      setText(text) {
          this.text = text;
          this.cursorIndex = text.length;
          this.update();
          return this;
      }
      insertText(text, startIndex = this.cursorIndex, pushToStack = true) {
          this.text = this.text.slice(0, startIndex) + text + this.text.slice(startIndex);
          if (pushToStack) {
              stack.push({
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
      setCursor(index) {
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
              }
              else {
                  this.elm.classList.remove('line--focused');
              }
              this.elm.querySelector('.line--number').textContent = num.toString();
              this.elm.querySelector('.line--content').textContent = this.text;
              this.elm.querySelector('.line--cursor').style.left = this.editor.charWidth * this.cursorIndex + 32 + 'px';
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
      _createElm() {
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

  function upEnter(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const prevLine = editor.findPrevLine(focusedLine);
              const line = new Line(editor);
              editor.prependLine(focusedLine, line);
              editor.focus(line);
              line.setText(prevLine ? prevLine.getIndent() : '');
          }
      };
  }
  function downEnter(editor) {
      return function handler() {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const line = new Line(editor);
              editor.appendLine(focusedLine, line);
              if (focusedLine) {
                  let nextIndent = focusedLine.getIndent().length;
                  if (autoCompleteKeys.concat(['.']).includes(focusedLine.text[focusedLine.cursorIndex - 1])) {
                      nextIndent += editor.config.tabSize;
                      microtask(handler);
                  }
                  else if (autoCompleteValues.includes(focusedLine.text[focusedLine.cursorIndex])) {
                      nextIndent -= editor.config.tabSize;
                      microtask(editor.focus.bind(editor), focusedLine);
                  }
                  line.setText(' '.repeat(nextIndent));
                  if (focusedLine.cursorIndex < focusedLine.text.length) {
                      const textWhichMoveToNextLine = focusedLine.text.slice(focusedLine.cursorIndex, focusedLine.text.length);
                      focusedLine.setText(focusedLine.text.slice(0, focusedLine.cursorIndex));
                      line.insertText(textWhichMoveToNextLine);
                      line.setCursor(nextIndent);
                  }
              }
              editor.focus(line);
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
                  focusedLine.deleteText();
              }
              else {
                  const prevLine = editor.findPrevLine(focusedLine);
                  if (prevLine) {
                      prevLine.insertText(focusedLine.text);
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
                      focusedLine.setCursor(focusedLine.text.length);
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
              focusedLine.setCursor(cursorIndex + 1);
              if (cursorIndex >= focusedLine.text.length) {
                  const nextLine = editor.findNextLine(focusedLine);
                  if (nextLine) {
                      focusedLine.setCursor(focusedLine.text.length);
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
                  prevLine.setCursor(cursorIndex);
                  focusedLine.setCursor(focusedLine.text.length);
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
                  nextLine.setCursor(cursorIndex);
                  focusedLine.setCursor(focusedLine.text.length);
                  editor.focus(nextLine);
              }
          }
      };
  }
  function tab(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              focusedLine.insertText(' '.repeat(editor.config.tabSize));
          }
      };
  }
  function space(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              focusedLine.insertText(' ');
          }
      };
  }
  function rightIndent(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              focusedLine.insertText(' '.repeat(editor.config.tabSize));
          }
      };
  }
  function leftIndent(editor) {
      return () => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              focusedLine.deleteText(0, Math.min(focusedLine.getIndent().length, editor.config.tabSize));
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
          this.selecting = false;
          this.selectionAnchor = {
              x: 0, y: 0, lineNumber: -1,
          };
          this._decorators = new Set();
          this._id = ++eid;
          config.tabSize = config.tabSize || 2;
          this.config = config;
          this.mount();
      }
      useDecorator(decorator) {
          this._decorators.add(decorator);
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
          const textarea = this.elm.querySelector('textarea');
          if (textarea) {
              textarea.focus();
          }
          const l = this.lines.length;
          for (let i = 0; i < l; i++) {
              const line = this.lines[i];
              line.blur();
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
          // @ts-ignore
          if (e.isComposing) {
              return;
          }
          const target = e.target;
          this.userInput = target.value.trim();
          target.value = '';
          const focusedLine = this.findFocusedLine();
          if (focusedLine) {
              const nextChar = focusedLine.text[focusedLine.cursorIndex];
              if (autoCompleteValues.includes(nextChar) && nextChar === this.userInput) {
                  focusedLine.setCursor(focusedLine.cursorIndex + 1);
              }
              else {
                  focusedLine.insertText(snippet(this.userInput));
                  if (autoCompleteKeys.includes(this.userInput)) {
                      focusedLine.setCursor(focusedLine.cursorIndex - 1);
                  }
              }
          }
      }
      startSelect(e) {
          const line = e.composedPath().find(target => {
              const elm = target;
              return elm.classList && elm.classList.contains('line');
          });
          if (line) {
              this.selecting = true;
              this.selectionAnchor = {
                  x: e.offsetX,
                  y: e.offsetY,
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
      select(e) {
          if (this.selecting) {
              const alt = e.altKey;
              const target = e.target;
              const anchor = this.selectionAnchor.lineNumber;
              const focusLine = e.composedPath().find(target => {
                  const elm = target;
                  return elm.classList && elm.classList.contains('line');
              });
              if (focusLine) {
                  const focus = Number(focusLine.dataset.lineNumber);
                  const lineLength = this.lines.length;
                  let offsetX = target.classList.contains('line--content') ? e.offsetX : e.offsetX - 32;
                  if (target.classList.contains('line--cursor')) {
                      offsetX = 0;
                  }
                  const charWidth = this.charWidth;
                  for (let i = 1; i < lineLength + 1; i++) {
                      const line = this.lines[i - 1];
                      if ((i < Math.min(anchor, focus) || i > Math.max(anchor, focus)) && !alt) {
                          line.selections = [];
                          line.update();
                      }
                      else if (i > Math.min(anchor, focus) && i < Math.max(anchor, focus)) {
                          line.selections = [[0, line.text.length]];
                          line.update();
                      }
                      else if (i === Math.min(anchor, focus) && focus !== i) {
                          const anchorIndex = Math.min(Math.round(this.selectionAnchor.x / charWidth), line.text.length);
                          alt ?
                              line.selections.push([anchorIndex, line.text.length]) :
                              (line.selections = [[anchorIndex, line.text.length]]);
                          line.update();
                      }
                      else if (i === Math.max(anchor, focus) && focus !== i) {
                          const anchorIndex = Math.min(Math.round(this.selectionAnchor.x / charWidth), line.text.length);
                          alt ?
                              line.selections.push([0, anchorIndex]) :
                              (line.selections = [[0, anchorIndex]]);
                          line.update();
                      }
                  }
              }
          }
      }
      endSelect() {
          this.selecting = false;
      }
      mount() {
          const editor = h('div', undefined, { class: 'editor', id: 'editor-' + this._id });
          this._editorElm = editor;
          const linesFragment = document.createDocumentFragment();
          const line = new Line(this);
          this.appendLine(line);
          const textarea = h('textarea');
          editor.appendChild(linesFragment);
          editor.addEventListener('mousedown', (e) => {
              const target = e.target;
              if (target.classList.contains('editor')) {
                  this.focus();
              }
          });
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

  return Editor;

}));
