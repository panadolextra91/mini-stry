/**
 * Generic typed event dispatcher (D-35).
 *
 * Synchronous in-process event bus — no external messaging.
 * Handlers execute sequentially: each `await`ed before the next.
 */
type EventHandler<T> = (event: T) => void | Promise<void>;

export class EventDispatcher<EventMap extends Record<string, unknown>> {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();
  public onError?: (type: string, error: unknown) => void;

  on<K extends keyof EventMap & string>(type: K, handler: EventHandler<EventMap[K]>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(type, list);
  }

  async emit<K extends keyof EventMap & string>(type: K, event: EventMap[K]): Promise<void> {
    for (const h of this.handlers.get(type) ?? []) {
      try {
        await h(event);
      } catch (err) {
        if (this.onError) {
          try {
            this.onError(type, err);
          } catch {
            // Prevent error hook itself from breaking execution of other sibling subscribers
          }
        }
      }
    }
  }
}
