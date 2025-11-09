# Micro Frontend Demo: Angular Host + React Remote

This project demonstrates a micro frontend architecture where:
- **Angular Host (Blue)**: Angular 17 application that hosts the React remote
- **React Remote (Pink)**: React 18 application embedded in the Angular host
- Both apps communicate via an event bus to exchange messages

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Angular Host (Blue) - Port 4200             │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ Message Input & Send Button                │    │
│  │ Received Messages Display                   │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │    React Remote (Pink) - Port 5001         │    │
│  │  ┌──────────────────────────────────────┐  │    │
│  │  │ Message Input & Send Button          │  │    │
│  │  │ Received Messages Display             │  │    │
│  │  └──────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│          ↕️  Event Bus Communication  ↕️             │
└─────────────────────────────────────────────────────┘
```

## Features

- ✅ Module Federation integration
- ✅ Angular 17 host application
- ✅ React 18 remote application
- ✅ Event-driven communication between apps
- ✅ Blue theme for Angular (gradient background)
- ✅ Pink theme for React (centered in host)
- ✅ Bi-directional message exchange
- ✅ Proper lifecycle management (mount/unmount)

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Quick Start

### Option 1: Automated Setup

Run the setup script from the root directory:

```bash
# Make the script executable (first time only)
chmod +x setup.sh

# Run the setup script
./setup.sh
```

This will:
1. Install dependencies for both applications
2. Start React Remote on port 5001
3. Start Angular Host on port 4200
4. Open http://localhost:4200 in your browser

### Option 2: Manual Setup

#### Step 1: Install Dependencies

```bash
# Install React Remote dependencies
cd react-remote
npm install

# Install Angular Host dependencies
cd ../angular-host
npm install
```

#### Step 2: Start React Remote (Terminal 1)

```bash
cd react-remote
npm start
```

Wait until you see:
```
webpack compiled successfully
Project is running at http://localhost:5001/
```

#### Step 3: Start Angular Host (Terminal 2)

```bash
cd angular-host
npm start
```

Wait until you see:
```
Application bundle generation complete.
** Angular Live Development Server is listening on localhost:4200
```

#### Step 4: Open Browser

Navigate to [http://localhost:4200](http://localhost:4200)

## Usage

1. **Send message from Angular to React**:
   - Type a message in the blue Angular section's text box
   - Click "Send to React" or press Enter
   - The message appears in the pink React app's "Received" section

2. **Send message from React to Angular**:
   - Type a message in the pink React section's text box
   - Click "Send to Angular" or press Enter
   - The message appears in the blue Angular app's "Received" section

## Project Structure

```
microfrontend/
├── angular-host/              # Angular host application
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts        # Main component with React integration
│   │   │   ├── app.component.html      # Template with message UI
│   │   │   ├── app.component.css       # Blue theme styling
│   │   │   ├── app.module.ts           # Angular module
│   │   │   └── event-bus.service.ts    # Event bus for communication
│   │   ├── main.ts
│   │   ├── index.html
│   │   └── styles.css
│   ├── webpack.config.js      # Module Federation config
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── react-remote/              # React remote application
│   ├── src/
│   │   ├── App.tsx            # Main React component
│   │   ├── App.css            # Pink theme styling
│   │   ├── bootstrap.tsx      # Mount/unmount lifecycle
│   │   └── index.tsx          # Entry point
│   ├── public/
│   │   └── index.html
│   ├── webpack.config.js      # Module Federation config
│   ├── package.json
│   └── tsconfig.json
│
├── Claude.md                  # MFE scaffold documentation
├── mfe-abstraction-strategy.md
├── micro-frontend-strategy.md
└── README.md                  # This file
```

## Technical Details

### Module Federation Configuration

**Angular Host (webpack.config.js)**:
```javascript
remotes: {
  "reactRemote": "http://localhost:5001/remoteEntry.js",
}
```

**React Remote (webpack.config.js)**:
```javascript
exposes: {
  './App': './src/bootstrap',
}
```

### Event Bus Communication

The event bus is implemented in the Angular service and shared with React:

```typescript
interface MessageEvent {
  from: 'angular' | 'react';
  message: string;
  timestamp: Date;
}
```

- Angular uses RxJS Subjects for the event bus
- React receives the event bus as a prop during mount
- Both apps can send and receive messages through the shared interface

### Styling

- **Angular Host**: Blue gradient background (`#667eea` to `#764ba2`)
- **React Remote**: Pink gradient background (`#ff6b9d` to `#c06c84`)
- React app is centered horizontally and vertically within the host
- Responsive design with proper spacing and shadows

## Troubleshooting

### React Remote doesn't appear

1. Ensure React Remote is running on port 5001:
   ```bash
   cd react-remote
   npm start
   ```

2. Check browser console for errors:
   - Open DevTools (F12)
   - Look for Module Federation errors
   - Verify remoteEntry.js loads successfully at http://localhost:5001/remoteEntry.js

### Messages not exchanging

1. Check browser console for event bus errors
2. Verify both apps are running
3. Check that the event bus service is properly initialized

### Port already in use

**React (Port 5001)**:
```bash
# Find process
lsof -ti:5001
# Kill process
kill -9 $(lsof -ti:5001)
```

**Angular (Port 4200)**:
```bash
# Find process
lsof -ti:4200
# Kill process
kill -9 $(lsof -ti:4200)
```

### Build errors

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Clear Angular cache:
   ```bash
   cd angular-host
   rm -rf .angular
   ```

## Development Tips

### Running React in Standalone Mode

```bash
cd react-remote
npm start
```
Visit [http://localhost:5001](http://localhost:5001) to see React app independently.

### Testing Event Bus

Open browser console and check for logs:
- `[Angular] Sent message: ...`
- `[React] Received message from Angular: ...`
- `[React] Sent message: ...`
- `[Angular] Received message from React: ...`

### Hot Reloading

Both apps support hot reloading:
- Edit React components → saves → browser auto-refreshes
- Edit Angular components → saves → browser auto-refreshes

## Architecture Patterns Implemented

This demo implements patterns from the [Micro Frontend Strategy](./micro-frontend-strategy.md):

1. **Module Federation**: Runtime integration without build-time coupling
2. **Event-Driven Communication**: Loose coupling via event bus
3. **Framework Agnostic**: Angular and React coexist
4. **Lifecycle Management**: Proper mount/unmount handling
5. **Isolation**: Separate styling and state management
6. **Independent Development**: Each app runs standalone

## Next Steps

To extend this demo:

1. **Add more MFEs**: Create Vue, Svelte, or additional React remotes
2. **Implement routing**: Add Angular routing with lazy-loaded MFEs
3. **Add authentication**: Implement shared auth context
4. **Add monitoring**: Integrate OpenTelemetry
5. **Deploy to production**: Set up CI/CD pipelines
6. **Add error boundaries**: Implement fallback UIs

## Resources

- [Module Federation Docs](https://webpack.js.org/concepts/module-federation/)
- [Angular Architects MF Guide](https://www.angulararchitects.io/en/aktuelles/the-microfrontend-revolution-module-federation-in-webpack-5/)
- [Micro Frontend Strategy Document](./micro-frontend-strategy.md)
- [MFE Abstraction Strategy Document](./mfe-abstraction-strategy.md)

## License

MIT

## Author

Generated with Claude Code
