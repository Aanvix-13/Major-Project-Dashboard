# Smart Multi-Room Energy Manager - IoT Dashboard

A comprehensive web dashboard for monitoring and managing energy consumption across a miniature multi-room testbed using simulated ESP32 controller and LD2410C mmWave occupancy sensors.

Built for the College Major Project Demonstration.

---

## 🏛️ System Configuration

Our prototype testbed consists of:
- **3 Miniature Rooms**: Room 1 (Main Office / #R01), Room 2 (Meeting Space / #R02), Room 3 (Workstation Lab / #R03)
- **3 LD2410C mmWave Radar Sensors**: 1 per room (GPIO 21, 22, 23)
- **3 DC Motors (Fans)**: 1 per room
- **3 LEDs (Lights)**: 1 per room
- **1 Central ESP32 Controller** (Demo / Simulation Mode)

---

## 🚀 Features

1. **Overview Dashboard**:
   - Monitored Units: 3 Rooms
   - Active Sensor Occupancy Detection
   - Real-time Appliances Active count out of 6 (3 Fans + 3 Lights)
   - Simulated ESP32 Controller Link (Online Status)
   - Live Activity Ledger & Telemetry status
2. **Appliance Control**:
   - Independent ON/OFF toggles for DC Fans and LED Lights
   - Tracking of **Enable Request** (User Intent) vs **Actual State** (Relay state)
   - Automatic cutoff preservation logic
   - Master controls: **All Appliances ON** & **All Appliances OFF**
3. **Occupancy Monitoring**:
   - Simulated testing toggles: `Occupied` vs `Vacant`
   - Independent vacancy countdown timers with visual progress bars
   - 3-chamber spatial radar visualization with mmWave beam arcs and presence detection
   - Hardware Pin table with GPIO mapping and heartbeat telemetry
4. **Energy Analytics**:
   - 12V DC Low-Voltage Rail telemetry
   - Benchmark power consumption area chart with peak annotations
   - Weekly energy usage bar chart
   - Topology status for each room node on the 12V DC bus
5. **History & Reports**:
   - Event audit ledger with search and category filters (Occupancy, Appliance Control, Automatic Actions)
   - One-click **Download CSV** report generation
   - Printable **Download PDF** report layout
6. **Room-wise Automation Settings**:
   - Configurable per-room Automatic Energy Saving
   - Custom Vacancy Delays (10s Demo, 1m, 3m, 5m, 10m, 15m)
   - Restore on Re-entry toggle
   - Manual Override with countdown timer

---

## ⚡ How to Run Locally

### Option 1: Direct File Opening
Double-click `index.html` to open in any web browser.

### Option 2: Local HTTP Server
Run with Python:
```bash
python -m http.server 3000
```
Then navigate to `http://localhost:3000`.

---

## 📁 Repository Structure
```
├── index.html       # Single-page application structure and UI views
├── styles.css       # Complete custom styles matching official UI specifications
├── app.js           # Reactive state management, automation engine, and SVG charts
├── Pages UI.pdf     # Reference UI design documentation
└── README.md        # Project documentation
```

