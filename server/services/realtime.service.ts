import { EventEmitter } from "events";
import type { RealtimeEvent } from "@shared/api";

/**
 * In-memory realtime bus (per server instance).
 * Good enough for MVP; if you scale horizontally, replace with Redis/pubsub.
 */
class RealtimeService {
  private emitter = new EventEmitter();

  emit(event: RealtimeEvent) {
    this.emitter.emit(this.channel(event.clinicId), event);
  }

  subscribe(clinicId: string, listener: (event: RealtimeEvent) => void) {
    const ch = this.channel(clinicId);
    this.emitter.on(ch, listener);
    return () => this.emitter.off(ch, listener);
  }

  private channel(clinicId: string) {
    return `clinic:${clinicId}`;
  }
}

export const realtimeService = new RealtimeService();

