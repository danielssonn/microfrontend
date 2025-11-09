# 🚀 Micro Frontend Demo - START HERE

## ✅ Port Configuration (VERIFIED)

- **React Remote**: Port **5001** ✅ (Available - Verified)
- **Angular Host**: Port **4200** ✅

> **Note**: Ports 3000-3002 are occupied by Docker container `mock-core-api`

---

## 🎯 Quick Start (3 Simple Steps)

### Step 1: Install Dependencies

Open Terminal and run:

```bash
cd /Users/danielssonn/git/microfrontend

# Install React Remote dependencies
cd react-remote
npm install

# Install Angular Host dependencies
cd ../angular-host
npm install
```

### Step 2: Start React Remote (Terminal 1)

```bash
cd /Users/danielssonn/git/microfrontend/react-remote
npm start
```

✅ **Wait for**: `webpack compiled successfully`
✅ **Port**: Should run on http://localhost:5001

### Step 3: Start Angular Host (Terminal 2)

Open a NEW terminal window:

```bash
cd /Users/danielssonn/git/microfrontend/angular-host
npm start
```

✅ **Wait for**: `Angular Live Development Server is listening on localhost:4200`

### Step 4: Open Browser

Navigate to: **http://localhost:4200**

---

## 🎨 What You Should See

```
┌─────────────────────────────────────────────┐
│   Angular Host (BLUE Gradient Background)   │
│                                             │
│   📝 Label: "Send Message to React:"       │
│   ⬜ Text Input                            │
│   🔵 Button: "Send to React"               │
│                                             │
│   📥 Received from React (Pink): ...       │
│                                             │
│   ┌───────────────────────────────────┐   │
│   │ React Remote (PINK - CENTERED)    │   │
│   │                                   │   │
│   │ 📝 Label: "Send Message to Angular:"│  │
│   │ ⬜ Text Input                     │   │
│   │ 🔴 Button: "Send to Angular"     │   │
│   │                                   │   │
│   │ 📥 Received from Angular: ...    │   │
│   └───────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## ✨ Test the Integration

1. **Type a message** in the Blue Angular text box
2. **Click "Send to React"** or press Enter
3. **See the message appear** in the Pink React app's "Received" section
4. **Type a message** in the Pink React text box
5. **Click "Send to Angular"** or press Enter
6. **See the message appear** in the Blue Angular app's "Received" section

---

## 🔧 Troubleshooting

### React app (pink) not showing?

```bash
# Check React is running
lsof -i :5001

# Check browser console (F12) for errors
# Verify: http://localhost:5001/remoteEntry.js loads
```

### Port conflicts?

```bash
# Check what's using ports
lsof -i :5001  # React Remote
lsof -i :4200  # Angular Host

# Kill if needed
kill -9 $(lsof -ti:5001)
kill -9 $(lsof -ti:4200)
```

### Messages not exchanging?

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for these logs:
   - `[Angular] Sent message: ...`
   - `[React] Received message from Angular: ...`
   - `[React] Sent message: ...`
   - `[Angular] Received message from React: ...`

---

## 📁 Project Structure

```
microfrontend/
├── angular-host/          ← Blue Angular app (host)
│   ├── src/app/
│   │   ├── app.component.ts      # Main component
│   │   ├── event-bus.service.ts  # Communication
│   │   └── ...
│   └── webpack.config.js         # Module Federation
│
├── react-remote/          ← Pink React app (remote)
│   ├── src/
│   │   ├── App.tsx               # Main component
│   │   ├── bootstrap.tsx         # Lifecycle
│   │   └── ...
│   └── webpack.config.js         # Module Federation
│
├── START-HERE.md          ← This file!
├── README.md             ← Full documentation
├── QUICK-START.md        ← Quick reference
└── PORT-CONFLICT-INFO.md ← Port details
```

---

## 🛠️ Alternative: Automated Setup

If you prefer automation:

```bash
cd /Users/danielssonn/git/microfrontend
./start-dev.sh
```

This script will:
- ✅ Check and install dependencies
- ✅ Kill any conflicting processes on ports 5001 and 4200
- ✅ Start React Remote on port 5001
- ✅ Start Angular Host on port 4200
- ✅ Show you the URLs

Press `Ctrl+C` to stop both apps.

---

## 🎓 Key Features

✅ **Module Federation** - Webpack 5 runtime integration
✅ **Framework Heterogeneity** - Angular 17 + React 18
✅ **Event Bus** - Bi-directional message exchange
✅ **Blue Theme** - Angular host with gradient (#667eea → #764ba2)
✅ **Pink Theme** - React remote with gradient (#ff6b9d → #c06c84)
✅ **Centered Layout** - React app horizontally & vertically centered
✅ **Proper Lifecycle** - Clean mount/unmount

---

## 📚 Full Documentation

- [README.md](./README.md) - Complete guide with architecture details
- [QUICK-START.md](./QUICK-START.md) - Visual quick reference
- [PORT-CONFLICT-INFO.md](./PORT-CONFLICT-INFO.md) - Port configuration details
- [Claude.md](./Claude.md) - MFE scaffold template

---

## ⚡ Console Logs to Expect

When everything is working, you should see:

**React Remote Console:**
```
[Angular] Loading React remote...
[Angular] React remote loaded successfully
[Angular] React app mounted
[React Bootstrap] Mounting with props: { eventBus: {...} }
```

**Browser Console (when sending messages):**
```
[Angular] Sent message: Hello from Angular
[React] Received message from Angular: Hello from Angular

[React] Sent message: Hello from React
[Angular] Received message from React: Hello from React
```

---

## 🆘 Need Help?

1. Check the [README.md](./README.md) troubleshooting section
2. Verify ports with `lsof -i :5001` and `lsof -i :4200`
3. Check browser console (F12) for errors
4. Ensure Docker containers aren't blocking ports (3000-3002 are used)

---

**Ready to start?**

Open two terminals and follow Steps 1-3 above! 🎉

**Generated with Claude Code** 🤖
