export type Event = {
  type: string;
};
export type EventHandler = (...args: any[]) => void;
export class EventEmitter {
  private _listeners: Record<string, Set<EventHandler>> = {};
  public on(event: string, handler: EventHandler) {
    if (this._listeners[event]) {
      this._listeners[event].add(handler);
    } else {
      this._listeners[event] = new Set<EventHandler>().add(handler);
    }
    return this;
  }
  public once(event: string, handler: EventHandler) {
    const wrapper = (...args: any[]) => {
      handler.call(undefined, ...args);
      this.off(event, wrapper);
    }
    this.on(event, wrapper);
    return this;
  }
  public off(event: string, handler?: EventHandler) {
    for (const [name, handlers] of Object.entries(this._listeners)) {
      if (name === event) {
        if (handler) {
          handlers.delete(handler);
        } else {
          delete this._listeners[name];
        }
      }
    }
    return this;
  }
  public emit(event: string, ...args: any[]) {
    for (const [name, handlers] of Object.entries(this._listeners)) {
      if (name === event) {
        for (const handler of handlers) {
          handler(...args);
        }
        break;
      }
    };
    return this;
  }
}
