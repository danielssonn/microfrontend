import { Component, OnInit, OnDestroy, ViewChild, ViewContainerRef, ComponentRef } from '@angular/core';
import { EventBusService, MessageEvent } from './event-bus.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('reactContainer', { read: ViewContainerRef }) reactContainer!: ViewContainerRef;

  title = 'Angular Host (Blue)';
  messageInput = '';
  receivedMessage = '';
  lastMessageFrom = '';

  private unsubscribe?: () => void;

  constructor(private eventBus: EventBusService) {
    console.log('[Angular] AppComponent constructor called');
  }

  ngOnInit(): void {
    console.log('[Angular] AppComponent ngOnInit called');
    console.log('[Angular] Title:', this.title);

    // Subscribe to messages from React
    this.unsubscribe = this.eventBus.subscribeToMessages((event: MessageEvent) => {
      if (event.from === 'react') {
        this.receivedMessage = event.message;
        this.lastMessageFrom = 'React (Pink)';
        console.log('[Angular] Received message from React:', event.message);
      }
    });

    console.log('[Angular] Will load React remote in 1 second...');
    // Load React remote after a short delay to ensure everything is initialized
    setTimeout(() => {
      console.log('[Angular] Timeout triggered, loading React remote now...');
      this.loadReactRemote();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  sendMessage(): void {
    if (this.messageInput.trim()) {
      this.eventBus.sendMessage('angular', this.messageInput);
      console.log('[Angular] Sent message:', this.messageInput);
      this.messageInput = '';
    }
  }

  private async loadReactRemote(): Promise<void> {
    try {
      console.log('[Angular] loadReactRemote() called');
      console.log('[Angular] Looking for react-container element...');

      const container = document.getElementById('react-container');
      if (!container) {
        console.error('[Angular] react-container element NOT FOUND in DOM');
        console.log('[Angular] Available elements:', document.body.innerHTML.substring(0, 500));
        return;
      }

      console.log('[Angular] react-container found:', container);
      console.log('[Angular] Attempting to load React remote from Module Federation...');

      // @ts-ignore
      const reactRemote = await import('reactRemote/App');
      console.log('[Angular] React remote loaded successfully!', reactRemote);

      if (reactRemote && reactRemote.mount) {
        console.log('[Angular] Calling reactRemote.mount()...');
        reactRemote.mount(container, {
          eventBus: this.eventBus
        });
        console.log('[Angular] React app mounted successfully!');
      } else {
        console.error('[Angular] reactRemote.mount function not found', reactRemote);
      }
    } catch (error) {
      console.error('[Angular] Error loading React remote:', error);
      console.error('[Angular] Error details:', error instanceof Error ? error.stack : error);

      // Show error in the container
      const container = document.getElementById('react-container');
      if (container) {
        container.innerHTML = `
          <div style="padding: 30px; background: #fee; border: 2px solid #f00; border-radius: 8px;">
            <h3 style="color: #c00;">React Remote Load Failed</h3>
            <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
            <p>Make sure:</p>
            <ul style="text-align: left;">
              <li>React Remote is running on <a href="http://localhost:5001" target="_blank">http://localhost:5001</a></li>
              <li>Module Federation is properly configured</li>
              <li>Check browser console for detailed errors</li>
            </ul>
          </div>
        `;
      }
    }
  }
}
