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
  function writeClipboard(text) {
      const clipboard = h('textarea', { value: text }, { readonly: '', class: 'editor--clipboard' });
      document.body.appendChild(clipboard);
      clipboard.select();
      document.execCommand('copy');
      clipboard.remove();
  }

  const Operation = {
      DELETE_TEXT: 'deleteText',
      INSERT_TEXT: 'insertText',
  };
  class Stack {
      constructor(_editor) {
          this._editor = _editor;
          this._innerStack = [];
          this.ptr = -1;
          this.undo = () => {
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
          };
      }
      push(opt) {
          this._innerStack.push(opt);
          this.ptr = this._innerStack.length - 1;
      }
      redo() { }
  }

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

  const { min, max, round, abs } = Math;
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
              const originX = this.elm.getBoundingClientRect().left + 32;
              const cursorIndex = round((e.clientX - originX) / this.editor.charWidth);
              this.setCursor(cursorIndex);
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
                  const charWidth = this.editor.charWidth;
                  const originX = this.elm.getBoundingClientRect().left + 32;
                  const focus = round((e.clientX - originX) / charWidth);
                  const anchor = min(round((this.editor.selectionAnchor.x - originX) / charWidth), this.text.length);
                  if (lineNumber < anchorNumber && !this.setSelectionFromAnchor(max(focus, 0), this.text.length)) {
                      alt ?
                          this.pushSelection([max(focus, 0), this.text.length]) :
                          this.setSelections([[max(focus, 0), this.text.length]]);
                  }
                  else if (lineNumber === anchorNumber && !this.setSelectionFromAnchor(max(0, min(focus, anchor)), min(this.text.length, max(focus, anchor)))) {
                      alt ?
                          this.pushSelection([max(0, min(focus, anchor)), min(this.text.length, max(focus, anchor))]) :
                          this.setSelections([[max(0, min(focus, anchor)), min(this.text.length, max(focus, anchor))]]);
                  }
                  else if (lineNumber > anchorNumber && !this.setSelectionFromAnchor(0, min(focus, this.text.length))) {
                      alt ?
                          this.pushSelection([0, min(focus, this.text.length)]) :
                          this.setSelections([[0, min(focus, this.text.length)]]);
                  }
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
      focus(e) {
          this.focused = true;
          e && this._focusHandler(e);
          this.update();
          return this;
      }
      setSelections(selections) {
          const ptrs = selections.flat().sort((a, b) => a - b).filter(ptr => ptr <= this.text.length);
          this.selections = [];
          const l = ptrs.length;
          for (let i = 0; i < l; i++) {
              const ptr = ptrs[i];
              if (i % 2) {
                  const selection = tail(this.selections);
                  if (selection) {
                      selection[1] = ptr;
                  }
              }
              else {
                  this.selections.push([ptr, 0]);
              }
          }
          this.update();
          return this;
      }
      setSelectionFromAnchor(anchor, focus) {
          const selection = this.selections.find(selection => selection[0] === anchor);
          if (selection) {
              selection[1] = focus;
              this.setSelections(this.selections);
              return true;
          }
          return false;
      }
      pushSelection(selection) {
          this.setSelections([...this.selections, selection]);
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
      setCursor(index) {
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
      dispose() {
          this.elm.removeEventListener('mousedown', this._focusHandler);
          this.elm.removeEventListener('mousemove', this._select);
          this.elm.remove();
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

  class EventEmitter {
      constructor() {
          this._listeners = {};
      }
      on(event, handler) {
          if (this._listeners[event]) {
              this._listeners[event].add(handler);
          }
          else {
              this._listeners[event] = new Set().add(handler);
          }
          return this;
      }
      once(event, handler) {
          const wrapper = () => {
              handler.call(undefined, ...arguments);
              this.off(event, wrapper);
          };
          this.on(event, wrapper);
          return this;
      }
      off(event, handler) {
          for (const [name, handlers] of Object.entries(this._listeners)) {
              if (name === event) {
                  if (handler) {
                      handlers.delete(handler);
                  }
                  else {
                      delete this._listeners[name];
                  }
              }
          }
          return this;
      }
      emit(event, ...args) {
          for (const [name, handlers] of Object.entries(this._listeners)) {
              if (name === event) {
                  for (const handler of handlers) {
                      handler(...args);
                  }
                  break;
              }
          }
          return this;
      }
  }

  class ShortcutsEmitter extends EventEmitter {
      static sort(shortcuts) {
          const keys = shortcuts.split('+');
          const alt = keys.includes('alt');
          const ctrl = keys.includes('ctrl');
          const shift = keys.includes('shift');
          return [ctrl && 'ctrl', shift && 'shift', alt && 'alt', keys.find(key => !['ctrl', 'shift', 'alt'].includes(key))].filter(Boolean).join('+');
      }
      on(shortcuts, handler) {
          shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
          super.on(ShortcutsEmitter.sort(shortcuts), handler);
          return this;
      }
      off(shortcuts, handler) {
          shortcuts = shortcuts.split('+').map(key => key.toLowerCase().trim()).join('+');
          this.off(ShortcutsEmitter.sort(shortcuts), handler);
          return this;
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
  function leftDelete(editor) {
      return (e) => {
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
                  if (e.ctrlKey) {
                      const tokens = focusedLine.text.slice(0, focusedLine.cursorIndex).split('').filter(Boolean);
                      const splitter = ' .+*&|/%?:=\'"`,~-_(){}[]<>]/';
                      let i = focusedLine.cursorIndex - 1;
                      while (!splitter.includes(tokens[i]) && i >= 0) {
                          tokens.pop();
                          i--;
                      }
                      if (i >= 0) {
                          tokens.pop();
                      }
                      focusedLine.setText(tokens.join(''));
                  }
                  else {
                      focusedLine.deleteText();
                  }
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
  function rightDelete(editor) {
      return (e) => {
          const focusedLine = editor.findFocusedLine();
          if (focusedLine) {
              const cursorIndex = focusedLine.cursorIndex;
              if (focusedLine.isEmpty()) {
                  const prevLine = editor.findPrevLine(focusedLine);
                  if (prevLine) {
                      editor.removeLine(focusedLine);
                      editor.focus(prevLine);
                  }
              }
              else if (cursorIndex > 0) {
                  if (e.ctrlKey) {
                      const tokens = focusedLine.text.split('').filter(Boolean);
                      const splitter = ' .+*&|/%?:=\'"`,~-_(){}[]<>]/';
                      let i = cursorIndex;
                      while (!splitter.includes(tokens[i]) && i < tokens.length) {
                          tokens.splice(i, 1);
                      }
                      if (tokens.length === focusedLine.text.length) {
                          tokens.splice(i, 1);
                      }
                      focusedLine.setText(tokens.join(''));
                      focusedLine.cursorIndex = cursorIndex;
                  }
                  else {
                      focusedLine.deleteText(cursorIndex, cursorIndex + 1);
                  }
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

  const { min: min$1, max: max$1, round: round$1 } = Math;
  let eid = 0;
  class Editor extends EventEmitter {
      constructor(elm, config = {}) {
          super();
          this.elm = elm;
          this.lines = [];
          this.userInput = '';
          this.charWidth = 0;
          this.shortcutsEmitter = new ShortcutsEmitter();
          this.selecting = false;
          this.selectionAnchor = {
              x: 0, lineNumber: -1,
          };
          this._decorators = new Set();
          this._stack = new Stack(this);
          this._id = ++eid;
          this.focus = (line, e) => {
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
              line.focus(e);
          };
          this._onKeyDown = (e) => {
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
          };
          this._onBlur = () => {
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
          };
          this._onInput = (e) => {
              // @ts-ignore
              if (e.isComposing || e.inputType !== 'insertText') {
                  return;
              }
              const target = e.target;
              this.userInput = target.value;
              target.value = '';
              const focusedLine = this.findFocusedLine();
              if (focusedLine) {
                  if (this.userInput.length === 1 && !this.userInput.includes('\n')) {
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
                  else if (!this.userInput.includes('\n') && this.userInput.length > 1) {
                      focusedLine.insertText(this.userInput);
                  }
                  else if (this.userInput.includes('\n') && this.userInput.trim().length > 1) {
                      const focusedIndex = this.lines.indexOf(focusedLine);
                      const rows = this.userInput.split('\n').filter(Boolean);
                      const l = rows.length;
                      for (let i = l - 1; i >= 0; i--) {
                          const row = rows[i];
                          if (i === 0) {
                              focusedLine.insertText(row);
                          }
                          else {
                              this.appendLine(focusedLine, new Line(this).setText(row));
                          }
                      }
                      this.focus(this.lines[focusedIndex + l - 1]);
                  }
              }
          };
          this._startSelect = (e) => {
              const line = e.composedPath().find(target => {
                  const elm = target;
                  return elm.classList && elm.classList.contains('line');
              });
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
          };
          this._select = (e) => {
              if (this.selecting) {
                  const alt = e.altKey;
                  const anchorNumber = this.selectionAnchor.lineNumber;
                  const focusLine = e.composedPath().find(target => {
                      const elm = target;
                      return elm.classList && elm.classList.contains('line');
                  });
                  if (focusLine) {
                      const focusNumber = Number(focusLine.dataset.lineNumber);
                      const lineLength = this.lines.length;
                      const charWidth = this.charWidth;
                      for (let i = 1; i < lineLength + 1; i++) {
                          const line = this.lines[i - 1];
                          if ((i < min$1(anchorNumber, focusNumber) || i > max$1(anchorNumber, focusNumber)) && !alt) {
                              line.setSelections([]);
                          }
                          else if (i > min$1(anchorNumber, focusNumber) && i < max$1(anchorNumber, focusNumber)) {
                              line.setSelections([[0, line.text.length]]);
                          }
                          else if (i === min$1(anchorNumber, focusNumber) && focusNumber !== i) {
                              const originX = line.elm.getBoundingClientRect().left + 32;
                              const anchorIndex = min$1(round$1((this.selectionAnchor.x - originX) / charWidth), line.text.length);
                              if (!line.setSelectionFromAnchor(anchorIndex, line.text.length)) {
                                  alt ?
                                      line.pushSelection([anchorIndex, line.text.length]) :
                                      line.setSelections([[anchorIndex, line.text.length]]);
                              }
                          }
                          else if (i === max$1(anchorNumber, focusNumber) && focusNumber !== i) {
                              const originX = line.elm.getBoundingClientRect().left + 32;
                              const anchorIndex = min$1(round$1((this.selectionAnchor.x - originX) / charWidth), line.text.length);
                              if (!line.setSelectionFromAnchor(0, anchorIndex)) {
                                  alt ?
                                      line.pushSelection([0, anchorIndex]) :
                                      line.setSelections([[0, anchorIndex]]);
                              }
                          }
                      }
                  }
              }
          };
          this._endSelect = () => {
              this.selecting = false;
          };
          config.tabSize = config.tabSize || 2;
          this.config = config;
          this._mount();
      }
      useDecorator(decorator) {
          this._decorators.add(decorator);
          return this;
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
      deserialize(text) {
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
          const text = [];
          const l = this.lines.length;
          for (let i = 0; i < l; i++) {
              const line = this.lines[i];
              text.push(line.text);
          }
          return text.join('\n');
      }
      dispose() {
          const editor = this._editorElm;
          const textarea = this.elm.querySelector('textarea');
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
      _mount() {
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
      _getSelectedText() {
          const text = [];
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
      _clipSelectedText() {
          const text = [];
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
      _onMounted() {
          this.focus(this.lines[0]);
          this._calcCharRect();
      }
      _calcCharRect() {
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
