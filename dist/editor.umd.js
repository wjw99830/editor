(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.Editor = factory());
}(this, function () { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function __values(o) {
        var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
        if (m) return m.call(o);
        return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }

    var $ = function (sel) { return document.querySelector(sel); };
    var h = function (tag, props, attrs, text) {
        var e_1, _a, e_2, _b;
        if (props === void 0) { props = {}; }
        if (attrs === void 0) { attrs = {}; }
        if (text === void 0) { text = ''; }
        var elm = document.createElement(tag);
        try {
            for (var _c = __values(Object.entries(props)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = __read(_d.value, 2), key = _e[0], value = _e[1];
                elm[key] = value;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var _f = __values(Object.entries(attrs)), _g = _f.next(); !_g.done; _g = _f.next()) {
                var _h = __read(_g.value, 2), key = _h[0], value = _h[1];
                elm.setAttribute(key, value || '');
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
            }
            finally { if (e_2) throw e_2.error; }
        }
        elm.textContent = text.toString();
        return elm;
    };

    var Operation = {
        DELETE_TEXT: 'deleteText',
        INSERT_TEXT: 'insertText',
        CUT: 'cut',
        INSERT_LINE: 'insertLine',
        APPEND_LINE: 'appendLine',
        REMOVE_LINE: 'removeLine',
        PREPEND_LINE: 'prependLine',
    };
    var Stack = /** @class */ (function () {
        function Stack(_editor) {
            var _this = this;
            this._editor = _editor;
            this._innerStack = [];
            this.ptr = -1;
            this.undo = function () {
                var opt = _this._innerStack[_this.ptr];
                if (opt) {
                    switch (opt.type) {
                        case Operation.INSERT_TEXT: {
                            var line = _this._editor.lines.find(function (line) { return line.id === opt.id; });
                            if (line) {
                                line.deleteText(opt.startIndex, opt.startIndex + opt.text.length, false);
                                line.setCursor(opt.cursorIndex);
                                line.setSelections(opt.selections);
                            }
                            _this.ptr--;
                            break;
                        }
                        case Operation.DELETE_TEXT: {
                            var line = _this._editor.lines.find(function (line) { return line.id === opt.id; });
                            if (line) {
                                line.insertText(opt.text, opt.startIndex, false);
                                line.setCursor(opt.cursorIndex);
                                line.setSelections(opt.selections);
                            }
                            _this.ptr--;
                            break;
                        }
                        case Operation.CUT: {
                            var line = _this._editor.lines.find(function (line) { return line.id === opt.id; });
                            if (line) {
                                var rows = opt.text.split('\n');
                                var l = rows.length;
                                for (var i = 0; i < l; i++) {
                                    var row = rows[i];
                                    if (i === 0) {
                                        var selectionEnd = opt.startIndex + row.length;
                                        if (l > 1) {
                                            // const newLine = new Line(this._editor);
                                            // line.deleteText(opt.startIndex, line.text.length, false);
                                            // this._editor.appendLine(line, newLine, false);
                                            selectionEnd++;
                                        }
                                        line.insertText(row, opt.startIndex, false);
                                        line.setCursor(opt.startIndex);
                                        line.pushSelection([opt.startIndex, selectionEnd]);
                                    }
                                    else if (i < l - 1) {
                                        var newLine = new Line(_this._editor).setText(row);
                                        newLine.pushSelection([0, newLine.text.length + 1]);
                                        _this._editor.appendLine(line, newLine, false);
                                    }
                                    else {
                                        var newLine = new Line(_this._editor).setText(row);
                                        // line.insertText(row, 0, false);
                                        newLine.pushSelection([0, row.length]);
                                        _this._editor.appendLine(line, newLine, false);
                                    }
                                    if (line.nextLine && i !== 0) {
                                        line = line.nextLine;
                                    }
                                }
                            }
                            _this.ptr--;
                            break;
                        }
                        case Operation.INSERT_LINE: {
                            var line = _this._editor.lines.find(function (line) { return line.id === opt.newId; });
                            if (line) {
                                var shouldFocusId_1 = opt.prevId || opt.nextId;
                                var shouldFocusLine = _this._editor.lines.find(function (line) { return line.id === shouldFocusId_1; });
                                shouldFocusLine && _this._editor.focus(shouldFocusLine);
                                _this._editor.removeLine(line, false);
                            }
                            _this.ptr--;
                            break;
                        }
                        default: break;
                    }
                }
            };
            this.redo = function () { };
        }
        Stack.prototype.push = function (opt) {
            this._innerStack.push(opt);
            this.ptr = this._innerStack.length - 1;
        };
        return Stack;
    }());

    var tail = function (arr) { return arr[arr.length - 1]; };
    var microtask = function (fn, arg) { return Promise.resolve(arg).then(fn); };
    var isArray = Array.isArray;
    var isRefType = function (o) { return o && typeof o === 'object'; };
    function deepClone(obj) {
        var e_1, _a;
        if (!isRefType(obj)) {
            return obj;
        }
        var copy = isArray(obj) ? [] : {};
        var stack = [{
                copy: copy,
                target: obj,
            }];
        var copiedRefs = [];
        var set = Reflect.set, ownKeys = Reflect.ownKeys, getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
        while (stack.length) {
            var _b = stack.pop(), target = _b.target, copy_1 = _b.copy;
            var keys = ownKeys(target);
            var _loop_1 = function (key) {
                var desc = getOwnPropertyDescriptor(target, key);
                if (desc && !desc.enumerable) {
                    return "continue";
                }
                var val = target[key];
                if (isRefType(val)) {
                    var copied = copiedRefs.find(function (copied) { return copied.target === val; });
                    if (copied) {
                        set(copy_1, key, copied.copy);
                        return "continue";
                    }
                    var copyVal = isArray(val) ? [] : {};
                    set(copy_1, key, copyVal);
                    stack.push({
                        target: val,
                        copy: copyVal,
                    });
                }
                else {
                    set(copy_1, key, val);
                }
            };
            try {
                for (var keys_1 = (e_1 = void 0, __values(keys)), keys_1_1 = keys_1.next(); !keys_1_1.done; keys_1_1 = keys_1.next()) {
                    var key = keys_1_1.value;
                    _loop_1(key);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (keys_1_1 && !keys_1_1.done && (_a = keys_1.return)) _a.call(keys_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            copiedRefs.push({
                target: target,
                copy: copy_1,
            });
        }
        return copy;
    }

    var min = Math.min, max = Math.max, round = Math.round, abs = Math.abs;
    var lid = 0;
    var Line = /** @class */ (function () {
        function Line(editor) {
            var _this = this;
            this.editor = editor;
            this.id = ++lid;
            this.text = '';
            this.focused = false;
            this.cursorIndex = 0;
            this.lineNumber = 0;
            this.selections = [];
            this._willUpdate = false;
            this._focusHandler = function (e) {
                _this.editor.focus(_this);
                var originX = _this.elm.getBoundingClientRect().left + 32;
                var cursorIndex = round((e.clientX - originX) / _this.editor.charWidth);
                _this.setCursor(cursorIndex);
            };
            this._select = function (e) {
                if (_this.editor.selecting) {
                    var target = e.target;
                    if (target.classList.contains('line--cursor')) {
                        return;
                    }
                    var alt = e.altKey;
                    var lineNumber = _this.lineNumber;
                    var anchorNumber = _this.editor.selectionAnchor.lineNumber;
                    var charWidth = _this.editor.charWidth;
                    var originX = _this.elm.getBoundingClientRect().left + 32;
                    var focus_1 = round((e.clientX - originX) / charWidth);
                    var anchor = min(round((_this.editor.selectionAnchor.x - originX) / charWidth), _this.text.length);
                    if (lineNumber < anchorNumber && !_this.setSelectionFromAnchor(max(focus_1, 0), _this.text.length + 1)) {
                        alt ?
                            _this.pushSelection([max(focus_1, 0), _this.text.length + 1]) :
                            _this.setSelections([[max(focus_1, 0), _this.text.length + 1]]);
                    }
                    else if (lineNumber === anchorNumber && !_this.setSelectionFromAnchor(max(0, min(focus_1, anchor)), min(_this.text.length, max(focus_1, anchor)))) {
                        alt ?
                            _this.pushSelection([max(0, min(focus_1, anchor)), min(_this.text.length, max(focus_1, anchor))]) :
                            _this.setSelections([[max(0, min(focus_1, anchor)), min(_this.text.length, max(focus_1, anchor))]]);
                    }
                    else if (lineNumber > anchorNumber && !_this.setSelectionFromAnchor(0, min(focus_1, _this.text.length))) {
                        alt ?
                            _this.pushSelection([0, min(focus_1, _this.text.length)]) :
                            _this.setSelections([[0, min(focus_1, _this.text.length)]]);
                    }
                }
            };
            this.editorConfig = editor.config;
            this._createElm();
        }
        Line.prototype.clone = function () {
            var _a = this, id = _a.id, text = _a.text, lineNumber = _a.lineNumber, selections = _a.selections, cursorIndex = _a.cursorIndex;
            return {
                id: id,
                text: text,
                lineNumber: lineNumber,
                cursorIndex: cursorIndex,
                selections: deepClone(selections),
            };
        };
        Line.prototype.isEmpty = function () {
            return !this.text.length;
        };
        Line.prototype.blur = function () {
            this.focused = false;
            this.update();
            return this;
        };
        Line.prototype.focus = function (e) {
            this.focused = true;
            e && this._focusHandler(e);
            this.update();
            return this;
        };
        Line.prototype.setSelections = function (selections) {
            var _this = this;
            var ptrs = selections.flat().sort(function (a, b) { return a - b; }).filter(function (ptr) { return ptr <= _this.text.length + 1; });
            this.selections = [];
            var l = ptrs.length;
            for (var i = 0; i < l; i++) {
                var ptr = ptrs[i];
                if (i % 2) {
                    var selection = tail(this.selections);
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
        };
        Line.prototype.setSelectionFromAnchor = function (anchor, focus) {
            var selection = this.selections.find(function (selection) { return selection[0] === anchor; });
            if (selection) {
                selection[1] = focus;
                this.setSelections(this.selections);
                return true;
            }
            return false;
        };
        Line.prototype.pushSelection = function (selection) {
            this.setSelections(__spread(this.selections, [selection]));
            return this;
        };
        Line.prototype.getIndent = function () {
            return (this.text.match(/^ */) || [])[0] || '';
        };
        Line.prototype.setText = function (text) {
            this.text = text;
            this.cursorIndex = text.length;
            this.update();
            return this;
        };
        Line.prototype.insertText = function (text, startIndex, pushToStack) {
            if (startIndex === void 0) { startIndex = this.cursorIndex; }
            if (pushToStack === void 0) { pushToStack = true; }
            this.text = this.text.slice(0, startIndex) + text + this.text.slice(startIndex);
            if (pushToStack) {
                this.editor._stack.push({
                    type: Operation.INSERT_TEXT,
                    id: this.id,
                    text: text,
                    startIndex: startIndex,
                    cursorIndex: this.cursorIndex,
                    selections: deepClone(this.selections),
                });
            }
            this.cursorIndex += text.length;
            this.update();
            return this;
        };
        Line.prototype.deleteText = function (startIndex, endIndex, pushToStack) {
            if (startIndex === void 0) { startIndex = this.cursorIndex; }
            if (endIndex === void 0) { endIndex = this.cursorIndex - 1; }
            if (pushToStack === void 0) { pushToStack = true; }
            var arr = this.text.split('');
            var deleted = arr.splice(min(startIndex, endIndex), abs(startIndex - endIndex));
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
        };
        Line.prototype.setCursor = function (index) {
            index = max(0, min(index, this.text.length));
            this.cursorIndex = index;
            this.update();
            return this;
        };
        Line.prototype.update = function () {
            var _this = this;
            if (this._willUpdate) {
                return;
            }
            this._willUpdate = true;
            microtask(function () {
                var e_1, _a, e_2, _b;
                var num = _this.editor.lines.indexOf(_this) + 1;
                _this.lineNumber = num;
                _this.elm.setAttribute('data-line-number', num.toString());
                if (_this.focused) {
                    _this.elm.classList.add('line--focused');
                }
                else {
                    _this.elm.classList.remove('line--focused');
                }
                _this.elm.querySelector('.line--number').textContent = num.toString();
                _this.elm.querySelector('.line--content').textContent = _this.text;
                _this.elm.querySelector('.line--cursor').style.left = _this.editor.charWidth * _this.cursorIndex + 32 + 'px';
                var selectionsLength = _this.selections.length;
                var charWidth = _this.editor.charWidth;
                try {
                    for (var _c = __values(__spread(_this.elm.children)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var child = _d.value;
                        if (child.classList.contains('line--selected')) {
                            child.remove();
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                for (var i = 0; i < selectionsLength; i++) {
                    var selection = _this.selections[i];
                    var selected = h('span', undefined, { class: 'line--selected' });
                    selected.style.left = selection[0] * charWidth + 32 + 'px';
                    selected.style.width = (selection[1] - selection[0]) * charWidth + 'px';
                    _this.elm.appendChild(selected);
                }
                try {
                    for (var _e = __values(_this.editor._decorators), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var decorator = _f.value;
                        decorator(_this.elm);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                _this._willUpdate = false;
            });
        };
        Line.prototype.dispose = function () {
            this.elm.removeEventListener('mousedown', this._focusHandler);
            this.elm.removeEventListener('mousemove', this._select);
            this.elm.remove();
        };
        Line.prototype._createElm = function () {
            var line = h('div', undefined, { class: 'line', id: 'line-' + this.id.toString() });
            var number = h('span', undefined, { class: 'line--number' }, this.editor.lines.indexOf(this) + 1);
            var content = h('pre', undefined, { class: 'line--content' });
            var cursor = h('span', undefined, { class: 'line--cursor' });
            cursor.style.left = '30px';
            line.appendChild(number);
            line.appendChild(content);
            line.appendChild(cursor);
            line.addEventListener('mousedown', this._focusHandler);
            line.addEventListener('mousemove', this._select);
            this.elm = line;
            this.update();
        };
        return Line;
    }());

    var EventEmitter = /** @class */ (function () {
        function EventEmitter() {
            this._listeners = {};
        }
        EventEmitter.prototype.on = function (event, handler) {
            if (this._listeners[event]) {
                this._listeners[event].add(handler);
            }
            else {
                this._listeners[event] = new Set().add(handler);
            }
            return this;
        };
        EventEmitter.prototype.once = function (event, handler) {
            var _this = this;
            var wrapper = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                handler.call.apply(handler, __spread([undefined], args));
                _this.off(event, wrapper);
            };
            this.on(event, wrapper);
            return this;
        };
        EventEmitter.prototype.off = function (event, handler) {
            var e_1, _a;
            try {
                for (var _b = __values(Object.entries(this._listeners)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = __read(_c.value, 2), name_1 = _d[0], handlers = _d[1];
                    if (name_1 === event) {
                        if (handler) {
                            handlers.delete(handler);
                        }
                        else {
                            delete this._listeners[name_1];
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return this;
        };
        EventEmitter.prototype.emit = function (event) {
            var e_2, _a, e_3, _b;
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            try {
                for (var _c = __values(Object.entries(this._listeners)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var _e = __read(_d.value, 2), name_2 = _e[0], handlers = _e[1];
                    if (name_2 === event) {
                        try {
                            for (var handlers_1 = (e_3 = void 0, __values(handlers)), handlers_1_1 = handlers_1.next(); !handlers_1_1.done; handlers_1_1 = handlers_1.next()) {
                                var handler = handlers_1_1.value;
                                handler.apply(void 0, __spread(args));
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (handlers_1_1 && !handlers_1_1.done && (_b = handlers_1.return)) _b.call(handlers_1);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                        break;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return this;
        };
        return EventEmitter;
    }());

    var ShortcutsEmitter = /** @class */ (function (_super) {
        __extends(ShortcutsEmitter, _super);
        function ShortcutsEmitter() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        ShortcutsEmitter.sort = function (shortcuts) {
            var keys = shortcuts.split('+');
            var alt = keys.includes('alt');
            var ctrl = keys.includes('ctrl');
            var shift = keys.includes('shift');
            return [ctrl && 'ctrl', shift && 'shift', alt && 'alt', keys.find(function (key) { return !['ctrl', 'shift', 'alt'].includes(key); })].filter(Boolean).join('+');
        };
        ShortcutsEmitter.prototype.on = function (shortcuts, handler) {
            shortcuts = shortcuts.split('+').map(function (key) { return key.toLowerCase().trim(); }).join('+');
            _super.prototype.on.call(this, ShortcutsEmitter.sort(shortcuts), handler);
            return this;
        };
        ShortcutsEmitter.prototype.off = function (shortcuts, handler) {
            shortcuts = shortcuts.split('+').map(function (key) { return key.toLowerCase().trim(); }).join('+');
            this.off(ShortcutsEmitter.sort(shortcuts), handler);
            return this;
        };
        return ShortcutsEmitter;
    }(EventEmitter));
    var isTextKey = function (keyCode) {
        return keyCode >= 48 && keyCode <= 57 || keyCode >= 65 && keyCode <= 90 || keyCode >= 186 && keyCode <= 192 || keyCode >= 219 && keyCode <= 222;
    };
    var isControlKey = function (key) {
        return ['Control', 'Alt', 'Shift'].includes(key);
    };
    var isControlKeyPressed = function (e) {
        return e.ctrlKey || e.altKey;
    };
    var KeyCodeMap = {
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

    var snippet = function (input) {
        return input + (autoCompleteMap[input] || '');
    };
    var autoCompleteMap = {
        '{': '}',
        '[': ']',
        '(': ')',
        '\'': '\'',
        '"': '"',
        '<': '>',
    };
    var autoCompleteKeys = Object.keys(autoCompleteMap);
    var autoCompleteValues = Object.values(autoCompleteMap);
    var autoCompleteEntries = Object.entries(autoCompleteMap).map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        return key + value;
    });

    function upEnter(editor) {
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var prevLine = editor.findPrevLine(focusedLine);
                var line = new Line(editor);
                editor.prependLine(focusedLine, line);
                editor.focus(line);
                line.setText(prevLine ? prevLine.getIndent() : '');
            }
        };
    }
    function downEnter(editor) {
        return function handler() {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var line = new Line(editor);
                editor.appendLine(focusedLine, line);
                if (focusedLine) {
                    var nextIndent = focusedLine.getIndent().length;
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
                        var textWhichMoveToNextLine = focusedLine.text.slice(focusedLine.cursorIndex, focusedLine.text.length);
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
        return function (e) {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                if (focusedLine.isEmpty()) {
                    var prevLine = editor.findPrevLine(focusedLine);
                    if (prevLine) {
                        editor.removeLine(focusedLine);
                        editor.focus(prevLine);
                    }
                }
                else if (focusedLine.cursorIndex > 0) {
                    if (e.ctrlKey) {
                        var tokens = focusedLine.text.slice(0, focusedLine.cursorIndex).split('').filter(Boolean);
                        var splitter = ' .+*&|/%?:;=\'"`,~-_(){}[]<>]/';
                        var i = focusedLine.cursorIndex;
                        while (!splitter.includes(tokens[i - 1]) && i >= 1) {
                            i--;
                        }
                        if (!tokens.join('').trim()) {
                            i = 0;
                        }
                        else if (i >= 1 && i === focusedLine.cursorIndex) {
                            i--;
                        }
                        focusedLine.deleteText(focusedLine.cursorIndex, i);
                    }
                    else {
                        focusedLine.deleteText();
                    }
                }
                else {
                    var prevLine = editor.findPrevLine(focusedLine);
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
        return function (e) {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var cursorIndex = focusedLine.cursorIndex;
                if (focusedLine.isEmpty()) {
                    var prevLine = editor.findPrevLine(focusedLine);
                    if (prevLine) {
                        editor.removeLine(focusedLine);
                        editor.focus(prevLine);
                    }
                }
                else if (cursorIndex > 0) {
                    if (e.ctrlKey) {
                        var tokens = focusedLine.text.split('').filter(Boolean);
                        var splitter = ' .+*&|/%?:=\'"`,~-_(){}[]<>]/';
                        var i = cursorIndex;
                        while (!splitter.includes(tokens[i]) && i <= focusedLine.text.length) {
                            i++;
                        }
                        if (i === cursorIndex) {
                            i++;
                        }
                        focusedLine.deleteText(cursorIndex, i);
                    }
                    else {
                        focusedLine.deleteText(cursorIndex, cursorIndex + 1);
                    }
                }
                else {
                    var prevLine = editor.findPrevLine(focusedLine);
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
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var cursorIndex = focusedLine.cursorIndex;
                if (cursorIndex > 0) {
                    focusedLine.setCursor(focusedLine.cursorIndex - 1);
                }
                else {
                    var prevLine = editor.findPrevLine(focusedLine);
                    if (prevLine) {
                        focusedLine.setCursor(focusedLine.text.length);
                        editor.focus(prevLine);
                    }
                }
            }
        };
    }
    function rightMove(editor) {
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var cursorIndex = focusedLine.cursorIndex;
                focusedLine.setCursor(cursorIndex + 1);
                if (cursorIndex >= focusedLine.text.length) {
                    var nextLine = editor.findNextLine(focusedLine);
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
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var cursorIndex = focusedLine.cursorIndex;
                var prevLine = editor.findPrevLine(focusedLine);
                if (prevLine) {
                    prevLine.setCursor(cursorIndex);
                    focusedLine.setCursor(focusedLine.text.length);
                    editor.focus(prevLine);
                }
            }
        };
    }
    function downMove(editor) {
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                var cursorIndex = focusedLine.cursorIndex;
                var nextLine = editor.findNextLine(focusedLine);
                if (nextLine) {
                    nextLine.setCursor(cursorIndex);
                    focusedLine.setCursor(focusedLine.text.length);
                    editor.focus(nextLine);
                }
            }
        };
    }
    function tab(editor) {
        return function (e) {
            e.preventDefault();
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                focusedLine.insertText(' '.repeat(editor.config.tabSize));
            }
        };
    }
    function rightIndent(editor) {
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                focusedLine.insertText(' '.repeat(editor.config.tabSize), 0);
            }
        };
    }
    function leftIndent(editor) {
        return function () {
            var focusedLine = editor.findFocusedLine();
            if (focusedLine) {
                focusedLine.deleteText(Math.min(focusedLine.getIndent().length, editor.config.tabSize), 0);
            }
        };
    }

    var min$1 = Math.min, max$1 = Math.max, round$1 = Math.round;
    var eid = 0;
    var Editor = /** @class */ (function (_super) {
        __extends(Editor, _super);
        function Editor(elm, config) {
            if (config === void 0) { config = {}; }
            var _this = _super.call(this) || this;
            _this.elm = elm;
            _this.lines = [];
            _this.userInput = '';
            _this.charWidth = 0;
            _this.shortcutsEmitter = new ShortcutsEmitter();
            _this.selecting = false;
            _this.selectionAnchor = {
                x: 0, lineNumber: -1,
            };
            _this._decorators = new Set();
            _this._stack = new Stack(_this);
            _this._id = ++eid;
            _this.focus = function (line, e) {
                _this.currentLine = line;
                var textarea = _this.elm.querySelector('textarea');
                if (textarea) {
                    textarea.focus();
                }
                var l = _this.lines.length;
                for (var i = 0; i < l; i++) {
                    var line_1 = _this.lines[i];
                    line_1.blur();
                }
                line.focus(e);
            };
            _this._onKeyDown = function (e) {
                var focusedLine = _this.findFocusedLine();
                if (!focusedLine) {
                    return;
                }
                if (isControlKeyPressed(e) || !isTextKey(e.keyCode)) {
                    var alt = e.altKey ? 'alt' : '';
                    var ctrl = e.ctrlKey ? 'ctrl' : '';
                    var shift = e.shiftKey ? 'shift' : '';
                    var key = isTextKey(e.keyCode) ? (KeyCodeMap[e.keyCode] || e.key.toLowerCase()) : (isControlKey(e.key) ? '' : e.code.toLowerCase());
                    var combined = [ctrl, shift, alt, key].filter(Boolean).join('+');
                    _this.shortcutsEmitter.emit(combined, e);
                }
            };
            _this._onBlur = function () {
                if (_this.currentLine) {
                    var textarea = _this.elm.querySelector('textarea');
                    if (textarea) {
                        textarea.focus();
                    }
                }
                var l = _this.lines.length;
                for (var i = 0; i < l; i++) {
                    var line = _this.lines[i];
                    var focused = _this.currentLine === line;
                    if (line.focused !== focused) {
                        line.focused = focused;
                        line.update();
                    }
                }
                _this.currentLine = undefined;
            };
            _this._onInput = function (e) {
                // @ts-ignore
                if (e.isComposing || e.inputType !== 'insertText' && e.inputType !== 'insertFromPaste') {
                    return;
                }
                var target = e.target;
                _this.userInput = target.value;
                target.value = '';
                var focusedLine = _this.findFocusedLine();
                if (focusedLine) {
                    if (_this.userInput.length === 1 && !_this.userInput.includes('\n')) {
                        var nextChar = focusedLine.text[focusedLine.cursorIndex];
                        if (autoCompleteValues.includes(nextChar) && nextChar === _this.userInput) {
                            focusedLine.setCursor(focusedLine.cursorIndex + 1);
                        }
                        else {
                            focusedLine.insertText(snippet(_this.userInput));
                            if (autoCompleteKeys.includes(_this.userInput)) {
                                focusedLine.setCursor(focusedLine.cursorIndex - 1);
                            }
                        }
                    }
                    else if (!_this.userInput.includes('\n') && _this.userInput.length > 1) {
                        focusedLine.insertText(_this.userInput);
                    }
                    else if (_this.userInput.includes('\n') && _this.userInput.trim().length > 1) {
                        var focusedIndex = _this.lines.indexOf(focusedLine);
                        var rows = _this.userInput.split('\n').filter(Boolean);
                        var l = rows.length;
                        for (var i = l - 1; i >= 0; i--) {
                            var row = rows[i];
                            if (i === 0) {
                                focusedLine.insertText(row);
                            }
                            else {
                                _this.appendLine(focusedLine, new Line(_this).setText(row));
                            }
                        }
                        _this.focus(_this.lines[focusedIndex + l - 1]);
                    }
                }
            };
            _this._startSelect = function (e) {
                var line = e.composedPath().find(function (target) {
                    var elm = target;
                    return elm.classList && elm.classList.contains('line');
                });
                if (line) {
                    _this.selecting = true;
                    _this.selectionAnchor = {
                        x: e.clientX,
                        lineNumber: Number(line.dataset.lineNumber),
                    };
                }
                if (!e.altKey) {
                    var l = _this.lines.length;
                    for (var i = 0; i < l; i++) {
                        var line_2 = _this.lines[i];
                        line_2.setSelections([]);
                    }
                }
            };
            _this._select = function (e) {
                if (_this.selecting) {
                    var alt = e.altKey;
                    var anchorNumber = _this.selectionAnchor.lineNumber;
                    var focusedLine = e.composedPath().find(function (target) {
                        var elm = target;
                        return elm.classList && elm.classList.contains('line');
                    });
                    if (focusedLine) {
                        var focusedNumber = Number(focusedLine.dataset.lineNumber);
                        var lineLength = _this.lines.length;
                        var charWidth = _this.charWidth;
                        for (var i = 1; i <= lineLength; i++) {
                            var line = _this.lines[i - 1];
                            if ((i < min$1(anchorNumber, focusedNumber) || i > max$1(anchorNumber, focusedNumber)) && !alt) {
                                line.setSelections([]);
                            }
                            else if (i > min$1(anchorNumber, focusedNumber) && i < max$1(anchorNumber, focusedNumber)) {
                                line.setSelections([[0, line.text.length + 1]]);
                            }
                            else if (i === min$1(anchorNumber, focusedNumber) && focusedNumber !== i) {
                                var originX_1 = line.elm.getBoundingClientRect().left + 32;
                                var anchorIndex = min$1(round$1((_this.selectionAnchor.x - originX_1) / charWidth), line.text.length);
                                if (!line.setSelectionFromAnchor(anchorIndex, line.text.length + 1)) {
                                    alt ?
                                        line.pushSelection([anchorIndex, line.text.length + 1]) :
                                        line.setSelections([[anchorIndex, line.text.length + 1]]);
                                }
                            }
                            else if (i === max$1(anchorNumber, focusedNumber) && focusedNumber !== i) {
                                var originX_2 = line.elm.getBoundingClientRect().left + 32;
                                var anchorIndex = min$1(round$1((_this.selectionAnchor.x - originX_2) / charWidth), line.text.length);
                                if (!line.setSelectionFromAnchor(0, anchorIndex)) {
                                    alt ?
                                        line.pushSelection([0, anchorIndex]) :
                                        line.setSelections([[0, anchorIndex]]);
                                }
                            }
                        }
                        _this.focus(_this.lines[focusedNumber - 1]);
                        var originX = focusedLine.getBoundingClientRect().left + 32;
                        _this.lines[focusedNumber - 1].setCursor(round$1((e.clientX - originX) / charWidth));
                    }
                }
            };
            _this._endSelect = function () {
                _this.selecting = false;
                var textarea = _this.elm.querySelector('textarea');
                if (textarea) {
                    textarea.value = _this._getSelectedText();
                    textarea.select();
                }
            };
            _this._cut = function () {
                var selectedText = _this._getSelectedText();
                var startIndex = 0;
                var startLine = null;
                for (var i = 0; i < _this.lines.length; i++) {
                    var line = _this.lines[i];
                    if (!line.selections.length) {
                        continue;
                    }
                    startLine = line;
                    startIndex = line.selections[0][0];
                    var selectionsLengh = void 0;
                    var tailSelection = void 0;
                    var nextLine = void 0;
                    var textLength = void 0;
                    // Recursively delete selected text for behind 
                    while (line) {
                        selectionsLengh = line.selections.length;
                        textLength = line.text.length;
                        for (var j = 0; j < selectionsLengh; j++) {
                            var selection = line.selections[j];
                            line.deleteText(selection[0], selection[1], false);
                            line.setCursor(selection[0]);
                        }
                        tailSelection = tail(line.selections);
                        nextLine = line.nextLine;
                        if (_this.lines[i] !== line) {
                            var prevLine = line.prevLine;
                            if (prevLine) {
                                var startIndex_1 = prevLine.text.length;
                                prevLine.insertText(line.text, startIndex_1, false);
                                prevLine.setCursor(startIndex_1);
                            }
                            _this.removeLine(line);
                        }
                        if (tailSelection && tailSelection[1] === textLength + 1) {
                            line.setSelections([]);
                            line = nextLine;
                        }
                        else {
                            line.setSelections([]);
                            line = null;
                        }
                    }
                    _this.focus(_this.lines[i]);
                }
                if (startLine) {
                    _this._stack.push({
                        type: Operation.CUT,
                        id: startLine.id,
                        startIndex: startIndex,
                        text: selectedText,
                    });
                }
            };
            config.tabSize = config.tabSize || 2;
            _this.config = config;
            _this._mount();
            return _this;
        }
        Editor.prototype.useDecorator = function (decorator) {
            this._decorators.add(decorator);
            return this;
        };
        Editor.prototype.findPrevLine = function (line) {
            return this.lines[this.lines.indexOf(line) - 1];
        };
        Editor.prototype.findNextLine = function (line) {
            return this.lines[this.lines.indexOf(line) + 1];
        };
        Editor.prototype.findFocusedLine = function () {
            return this.lines.find(function (line) { return line.focused; });
        };
        Editor.prototype.appendLine = function (target, newLine, pushToStack) {
            if (newLine === void 0) { newLine = true; }
            if (pushToStack === void 0) { pushToStack = true; }
            var nextLine = this.lines[this.lines.indexOf(target) + 1];
            var _pushToStack = true;
            var prevId = undefined;
            var newId;
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
                }
                else {
                    this._editorElm.appendChild(newLine.elm);
                }
                _pushToStack = pushToStack;
            }
            else {
                newId = target.id;
                var prevLine = tail(this.lines);
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
                    prevId: prevId,
                    newId: newId,
                });
            }
            return this;
        };
        Editor.prototype.prependLine = function (target, newLine, pushToStack) {
            if (pushToStack === void 0) { pushToStack = true; }
            var prevLine = this.lines[this.lines.indexOf(target) - 1];
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
        };
        Editor.prototype.removeLine = function (target, pushToStack) {
            if (pushToStack === void 0) { pushToStack = true; }
            var index = this.lines.indexOf(target);
            var prevLine = this.lines[index - 1];
            var nextLine = this.lines[index + 1];
            prevLine.nextLine = nextLine;
            nextLine.prevLine = prevLine;
            this.lines.splice(index, 1);
            if (pushToStack) {
                this._stack.push({
                    type: Operation.REMOVE_LINE,
                    state: target.clone(),
                });
            }
            target.dispose();
            return this;
        };
        Editor.prototype.deserialize = function (text) {
            var l = this.lines.length;
            for (var i = 0; i < l; i++) {
                var line = this.lines[i];
                line.dispose();
            }
            this.lines = [];
            var rows = text.split('\n');
            l = rows.length;
            for (var i = 0; i < l; i++) {
                var row = rows[i];
                this.appendLine(new Line(this).setText(row), false);
            }
        };
        Editor.prototype.serialize = function () {
            var text = [];
            var l = this.lines.length;
            for (var i = 0; i < l; i++) {
                var line = this.lines[i];
                text.push(line.text);
            }
            return text.join('\n');
        };
        Editor.prototype.dispose = function () {
            var editor = this._editorElm;
            var textarea = this.elm.querySelector('textarea');
            document.removeEventListener('mouseup', this._endSelect);
            editor.removeEventListener('mousedown', this._startSelect);
            editor.removeEventListener('mousemove', this._select);
            editor.removeEventListener('keydown', this._onKeyDown);
            document.removeEventListener('mouseup', this._endSelect);
            textarea.removeEventListener('blur', this._onBlur);
            textarea.removeEventListener('input', this._onInput);
            textarea.removeEventListener('compositionend', this._onInput);
            textarea.removeEventListener('keydown', this._onKeyDown);
            var l = this.lines.length;
            for (var i = 0; i < l; i++) {
                var line = this.lines[i];
                line.dispose();
            }
            editor.remove();
            textarea.remove();
        };
        Editor.prototype._mount = function () {
            var _this = this;
            var editor = h('div', undefined, { class: 'editor', id: 'editor-' + this._id });
            this._editorElm = editor;
            var linesFragment = document.createDocumentFragment();
            var line = new Line(this);
            this.appendLine(line);
            var textarea = h('textarea');
            editor.appendChild(linesFragment);
            editor.addEventListener('mousedown', function (e) {
                var target = e.target;
                if (target.classList.contains('editor')) {
                    var lastLine = tail(_this.lines);
                    if (lastLine) {
                        _this.focus(lastLine, e);
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
            textarea.addEventListener('cut', this._cut);
            this.elm.appendChild(editor);
            this.elm.appendChild(textarea);
            this.shortcutsEmitter.on('ctrl + s', function (e) {
                e.preventDefault();
                _this.emit('save', _this.serialize());
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
        };
        Editor.prototype._getSelectedText = function () {
            var text = [];
            var l = this.lines.length;
            for (var i = 0; i < l; i++) {
                var line = this.lines[i];
                for (var j = 0; j < line.selections.length; j++) {
                    var selection = line.selections[j];
                    text.push((line.text || '').slice(selection[0], selection[1]));
                }
            }
            return text.join('\n');
        };
        Editor.prototype._onMounted = function () {
            this.focus(this.lines[0]);
            this._calcCharRect();
        };
        Editor.prototype._calcCharRect = function () {
            var range = document.createRange();
            var textNode = document.createTextNode('0');
            range.setStart(textNode, 0);
            range.setEnd(textNode, 1);
            var editor = $('#editor-' + this._id);
            if (editor) {
                editor.appendChild(textNode);
                var selection = window.getSelection();
                if (selection) {
                    selection.addRange(range);
                    var rect = range.getBoundingClientRect();
                    selection.removeRange(range);
                    range.detach();
                    textNode.remove();
                    this.charWidth = rect.width;
                }
            }
        };
        return Editor;
    }(EventEmitter));

    return Editor;

}));
