import React, { useState, useEffect } from 'react';
import './App.css';

interface MessageEvent {
  from: 'angular' | 'react';
  message: string;
  timestamp: Date;
}

interface EventBus {
  sendMessage: (from: 'angular' | 'react', message: string) => void;
  subscribeToMessages: (callback: (event: MessageEvent) => void) => () => void;
}

interface AppProps {
  eventBus?: EventBus;
}

const App: React.FC<AppProps> = ({ eventBus }) => {
  const [messageInput, setMessageInput] = useState('');

  // Load persisted message state from localStorage on mount
  const [receivedMessage, setReceivedMessage] = useState(() => {
    const saved = localStorage.getItem('react-orange-receivedMessage');
    return saved || '';
  });

  const [lastMessageFrom, setLastMessageFrom] = useState(() => {
    const saved = localStorage.getItem('react-orange-lastMessageFrom');
    return saved || '';
  });

  // Persist message state to localStorage whenever it changes
  useEffect(() => {
    if (receivedMessage) {
      localStorage.setItem('react-orange-receivedMessage', receivedMessage);
    }
  }, [receivedMessage]);

  useEffect(() => {
    if (lastMessageFrom) {
      localStorage.setItem('react-orange-lastMessageFrom', lastMessageFrom);
    }
  }, [lastMessageFrom]);

  useEffect(() => {
    if (!eventBus) {
      console.warn('[React] No event bus provided');
      return;
    }

    // Subscribe to messages from Angular
    const unsubscribe = eventBus.subscribeToMessages((event: MessageEvent) => {
      if (event.from === 'angular') {
        setReceivedMessage(event.message);
        setLastMessageFrom('Angular (Blue)');
        console.log('[React Orange] Received message from Angular:', event.message);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventBus]);

  const sendMessage = () => {
    if (messageInput.trim() && eventBus) {
      eventBus.sendMessage('react', messageInput);
      console.log('[React Orange] Sent message:', messageInput);
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="react-app">
      <h1>React Remote (Orange)</h1>

      <div className="message-box">
        <label htmlFor="react-input">Send Message to Angular:</label>
        <input
          id="react-input"
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
          className="input-field"
        />
        <button onClick={sendMessage} className="send-button">
          Send to Angular
        </button>
      </div>

      {receivedMessage && (
        <div className="received-box">
          <h3>Received from {lastMessageFrom}:</h3>
          <p className="received-message">{receivedMessage}</p>
        </div>
      )}
    </div>
  );
};

export default App;
