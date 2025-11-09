import { Component, OnInit, OnDestroy } from '@angular/core';
import { EventBusService, MessageEvent } from './event-bus.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Angular Host (Blue)';
  messageInput = '';
  receivedMessage = '';
  lastMessageFrom = '';
  reactLoadError = '';

  private unsubscribe?: () => void;

  constructor(private eventBus: EventBusService) {
    console.log('[Angular] AppComponent constructed');
  }

  ngOnInit(): void {
    console.log('[Angular] AppComponent initialized');

    // Subscribe to messages from React
    this.unsubscribe = this.eventBus.subscribeToMessages((event: MessageEvent) => {
      if (event.from === 'react') {
        this.receivedMessage = event.message;
        this.lastMessageFrom = 'React (Pink)';
        console.log('[Angular] Received message from React:', event.message);
      }
    });

    // Try to load React remote after initialization
    setTimeout(() => this.loadReactRemote(), 1000);
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
      console.log('[Angular] Attempting to load React remote from http://localhost:5001/remoteEntry.js');

      const container = document.getElementById('react-container');
      if (!container) {
        console.error('[Angular] react-container element not found');
        this.reactLoadError = 'Container element not found';
        return;
      }

      // Check if React remote is accessible
      const response = await fetch('http://localhost:5001/remoteEntry.js');
      if (!response.ok) {
        throw new Error(`React remote not accessible: ${response.status}`);
      }
      console.log('[Angular] React remote is accessible');

      // Load the remote entry script
      await this.loadScript('http://localhost:5001/remoteEntry.js');
      console.log('[Angular] Remote entry script loaded');

      // @ts-ignore - Access the federated module
      if (!(window as any).reactRemote) {
        throw new Error('reactRemote not found on window');
      }

      const reactRemoteContainer = (window as any).reactRemote;
      await reactRemoteContainer.init(__webpack_share_scopes__.default);

      const factory = await reactRemoteContainer.get('./App');
      const module = factory();

      if (module && module.mount) {
        module.mount(container, {
          eventBus: this.eventBus
        });
        console.log('[Angular] React app mounted successfully');
      } else {
        throw new Error('React module does not expose mount function');
      }
    } catch (error) {
      console.error('[Angular] Error loading React remote:', error);
      this.reactLoadError = error instanceof Error ? error.message : 'Unknown error';

      // Show error message in the container
      const container = document.getElementById('react-container');
      if (container) {
        container.innerHTML = `
          <div style="padding: 20px; background: #fee; border: 2px solid #f00; border-radius: 8px;">
            <h3 style="color: #c00;">React Remote Load Error</h3>
            <p>${this.reactLoadError}</p>
            <p>Make sure React Remote is running on port 5001</p>
            <pre style="background: #fff; padding: 10px; overflow-x: auto;">${error}</pre>
          </div>
        `;
      }
    }
  }

  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.type = 'text/javascript';
      script.onload = () => {
        console.log(`[Angular] Script loaded: ${url}`);
        resolve();
      };
      script.onerror = (error) => {
        console.error(`[Angular] Script load error: ${url}`, error);
        reject(new Error(`Failed to load script: ${url}`));
      };
      document.head.appendChild(script);
    });
  }
}

// Declare webpack share scopes for TypeScript
declare const __webpack_share_scopes__: any;
