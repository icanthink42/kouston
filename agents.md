# Kouston

Real-time KSP telemetry visualization system.

## Architecture

```
KSP Mod (C#) ──WebSocket──► Go Server ◄──WebSocket── Angular Web Client
```

## Components

### `/mod` - KSP Mod
Sends vessel telemetry (position, orbit, EDL data) via WebSocket.

### `/server` - Go Server
Relays telemetry from KSP to web clients. Endpoints: `/ksp`, `/web`

### `/kouston-web` - Angular Client
Three views:
- **Ground Track** `/` - Orbital path on Kerbin map
- **Orbital View** `/orbital` - Top-down orbit visualization
- **EDL** `/edl` - Landing display with attitude/velocity

## Build

```bash
cd mod && ./build.sh           # KSP mod
cd server && go run .          # Server
cd kouston-web && npm start    # Web client
```
