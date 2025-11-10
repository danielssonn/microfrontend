import { Component, OnInit, OnDestroy, ViewChild, ViewContainerRef, ComponentRef } from '@angular/core';
import { EventBusService, MessageEvent } from './event-bus.service';
import { MFELoaderService } from './mfe-loader.service';
import { MFEInstance } from 'mfe-core';

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
  currentMFE: 'pink' | 'orange' = 'pink';

  private unsubscribe?: () => void;
  private mfeInstance?: MFEInstance;

  constructor(
    private eventBus: EventBusService,
    private mfeLoader: MFELoaderService
  ) {
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
      this.loadMFE(this.currentMFE);
    }, 1000);
  }

  async ngOnDestroy(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    // Unload the MFE if it was loaded
    if (this.mfeInstance) {
      try {
        await this.mfeLoader.unloadMFE(this.mfeInstance.mfeName);
        console.log('[Angular] MFE unloaded successfully');
      } catch (error) {
        console.error('[Angular] Error unloading MFE:', error);
      }
    }
  }

  sendMessage(): void {
    if (this.messageInput.trim()) {
      this.eventBus.sendMessage('angular', this.messageInput);
      console.log('[Angular] Sent message:', this.messageInput);
      this.messageInput = '';
    }
  }

  async switchMFE(mfe: 'pink' | 'orange'): Promise<void> {
    console.log(`[Angular] Switching MFE to: ${mfe}`);

    // Unload current MFE if loaded
    if (this.mfeInstance) {
      try {
        await this.mfeLoader.unloadMFE(this.mfeInstance.mfeName);
        console.log('[Angular] Current MFE unloaded');
      } catch (error) {
        console.error('[Angular] Error unloading current MFE:', error);
      }
    }

    // Update current MFE and load new one
    this.currentMFE = mfe;
    await this.loadMFE(mfe);
  }

  private async loadMFE(mfe: 'pink' | 'orange'): Promise<void> {
    try {
      console.log(`[Angular] loadMFE() called for ${mfe} - using MFE Abstraction Layer`);
      console.log('[Angular] Looking for react-container element...');

      const container = document.getElementById('react-container');
      if (!container) {
        console.error('[Angular] react-container element NOT FOUND in DOM');
        console.log('[Angular] Available elements:', document.body.innerHTML.substring(0, 500));
        return;
      }

      console.log('[Angular] react-container found:', container);
      console.log(`[Angular] Loading ${mfe} React MFE via MFELoaderService...`);

      // Determine which MFE to load based on selection
      const config = mfe === 'pink'
        ? {
            name: 'reactRemote',
            remoteUrl: 'http://localhost:5001/remoteEntry.js',
            module: './App',
            framework: 'react' as const,
            version: '1.0.0'
          }
        : {
            name: 'reactOrange',
            remoteUrl: 'http://localhost:5002/remoteEntry.js',
            module: './App',
            framework: 'react' as const,
            version: '1.0.0'
          };

      // Use the MFE Abstraction Layer to load the React remote
      this.mfeInstance = await this.mfeLoader.loadMFE(config, container);

      console.log(`[Angular] ${mfe} React MFE loaded and mounted successfully!`, this.mfeInstance);
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
