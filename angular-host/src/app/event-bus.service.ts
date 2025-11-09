import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface MessageEvent {
  from: 'angular' | 'react';
  message: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class EventBusService {
  private messageSubject = new Subject<MessageEvent>();
  public message$: Observable<MessageEvent> = this.messageSubject.asObservable();

  sendMessage(from: 'angular' | 'react', message: string): void {
    const event: MessageEvent = {
      from,
      message,
      timestamp: new Date()
    };
    this.messageSubject.next(event);
    console.log(`[EventBus] Message sent from ${from}:`, message);
  }

  subscribeToMessages(callback: (event: MessageEvent) => void): () => void {
    const subscription = this.message$.subscribe(callback);
    return () => subscription.unsubscribe();
  }
}

// Export singleton instance for React to use
(window as any).eventBus = {
  sendMessage: (from: 'angular' | 'react', message: string) => {
    const instance = new EventBusService();
    instance.sendMessage(from, message);
  },
  subscribe: (callback: (event: MessageEvent) => void) => {
    const instance = new EventBusService();
    return instance.subscribeToMessages(callback);
  }
};
