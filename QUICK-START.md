# Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Install Dependencies

```bash
cd react-remote
npm install
```

```bash
cd ../angular-host
npm install
```

### Step 2: Start React Remote (Terminal 1)

```bash
cd react-remote
npm start
```

**Wait for**: `webpack compiled successfully`

### Step 3: Start Angular Host (Terminal 2)

```bash
cd angular-host
npm start
```

**Wait for**: `Angular Live Development Server is listening on localhost:4200`

### Step 4: Open Browser

Navigate to: **http://localhost:4200**

---

## 🎨 What You'll See

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Angular Host (Blue Background)                     ┃
┃  ┌─────────────────────────────────────────────┐   ┃
┃  │ Send Message to React: [text input]         │   ┃
┃  │ [Send to React Button]                      │   ┃
┃  │                                              │   ┃
┃  │ Received from React (Pink): "Hello!"        │   ┃
┃  └─────────────────────────────────────────────┘   ┃
┃                                                     ┃
┃  ┌────────────────────────────────────────────┐    ┃
┃  │    React Remote (Pink Background)          │    ┃
┃  │    ┌──────────────────────────────────┐    │    ┃
┃  │    │ Send Message to Angular:         │    │    ┃
┃  │    │ [text input]                     │    │    ┃
┃  │    │ [Send to Angular Button]         │    │    ┃
┃  │    │                                  │    │    ┃
┃  │    │ Received from Angular (Blue):    │    │    ┃
┃  │    │ "Hi there!"                      │    │    ┃
┃  │    └──────────────────────────────────┘    │    ┃
┃  └────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## ✨ Features

- **Blue Angular App**: Gradient background (#667eea → #764ba2)
- **Pink React App**: Gradient background (#ff6b9d → #c06c84)
- **React app is centered** inside the Angular host
- **Bi-directional messaging**: Type and send messages between apps
- **Real-time communication** via event bus

---

## 🧪 Test the Integration

1. In the **Blue Angular section**:
   - Type "Hello from Angular"
   - Click "Send to React" or press Enter
   - See the message appear in the Pink React section

2. In the **Pink React section**:
   - Type "Hello from React"
   - Click "Send to Angular" or press Enter
   - See the message appear in the Blue Angular section

---

## 🐛 Troubleshooting

### React app not showing?

1. Check React is running on port 5001
2. Open DevTools (F12) and check console for errors
3. Verify `http://localhost:5001/remoteEntry.js` is accessible

### Messages not working?

1. Check browser console for event bus errors
2. Look for `[Angular] Sent message:` and `[React] Received message:` logs

### Port conflicts?

```bash
# Kill port 5001
kill -9 $(lsof -ti:5001)

# Kill port 4200
kill -9 $(lsof -ti:4200)
```

---

## 📝 Architecture

- **Module Federation**: Webpack 5 for runtime integration
- **Event Bus**: RxJS-based communication layer
- **Lifecycle Management**: Proper mount/unmount
- **Framework Agnostic**: Angular 17 + React 18

---

## 🎯 Key Files

### Angular Host
- `angular-host/src/app/app.component.ts` - Main component
- `angular-host/src/app/event-bus.service.ts` - Communication layer
- `angular-host/webpack.config.js` - Module Federation config

### React Remote
- `react-remote/src/App.tsx` - React component
- `react-remote/src/bootstrap.tsx` - Mount/unmount lifecycle
- `react-remote/webpack.config.js` - Module Federation config

---

## 📚 Full Documentation

See [README.md](./README.md) for complete documentation.

---

**Generated with Claude Code** 🤖
