/**
 * Smart Multi-Room Energy Manager - Master Application Logic & Store
 * Prototype Testbed: 3 Miniature Rooms (LD2410C + DC Fan + LED Light + ESP32)
 */

// ================= GLOBAL STATE =================
const DEFAULT_STATE = {
  activePage: 'overview',
  simulatedFeed: true,
  lastSyncTime: Date.now(),

  rooms: [
    {
      id: 1,
      name: 'Room 1',
      roomType: 'Main Office',
      nodeId: '#R01',
      sensorPin: 'GPIO 21',
      sensorName: 'LD2410C #S-01',
      isOccupied: true,
      lastPresenceText: 'Active now',
      motionType: 'Stationary + Moving',
      range: '1.8m',
      heartbeat: '2s ago',

      // Countdown
      countdownActive: false,
      countdownRemainingSeconds: 300,
      countdownTotalSeconds: 300,

      // Settings
      autoEnergySaving: true,
      vacancyDelaySeconds: 300,
      restoreOnReentry: true,
      manualOverride: false,
      manualOverrideDurationSeconds: 1800,
      manualOverrideRemainingSeconds: 0,

      // Appliances
      fan: {
        id: 'fan-1',
        name: 'Fan 1 - DC Motor',
        type: 'fan',
        enableRequest: true,
        actualState: true,
        autoCutoff: false
      },
      light: {
        id: 'light-1',
        name: 'Light 1 - LED',
        type: 'light',
        enableRequest: true,
        actualState: true,
        autoCutoff: false
      }
    },
    {
      id: 2,
      name: 'Room 2',
      roomType: 'Meeting Space',
      nodeId: '#R02',
      sensorPin: 'GPIO 22',
      sensorName: 'LD2410C #S-02',
      isOccupied: true,
      lastPresenceText: 'Motion detected 10s ago',
      motionType: 'Micro-Motion',
      range: '2.4m',
      heartbeat: '1s ago',

      // Countdown
      countdownActive: false,
      countdownRemainingSeconds: 300,
      countdownTotalSeconds: 300,

      // Settings
      autoEnergySaving: true,
      vacancyDelaySeconds: 300,
      restoreOnReentry: true,
      manualOverride: false,
      manualOverrideDurationSeconds: 1800,
      manualOverrideRemainingSeconds: 0,

      // Appliances
      fan: {
        id: 'fan-2',
        name: 'Fan 2 - DC Motor',
        type: 'fan',
        enableRequest: false,
        actualState: false,
        autoCutoff: false
      },
      light: {
        id: 'light-2',
        name: 'Light 2 - LED',
        type: 'light',
        enableRequest: true,
        actualState: true,
        autoCutoff: false
      }
    },
    {
      id: 3,
      name: 'Room 3',
      roomType: 'Workstation Lab',
      nodeId: '#R03',
      sensorPin: 'GPIO 23',
      sensorName: 'LD2410C #S-03',
      isOccupied: false,
      lastPresenceText: 'Cleared at 14:32:45',
      motionType: 'None',
      range: 'None',
      heartbeat: '2s ago',

      // Countdown (Initialized as active with 03:45 remaining as in PDF)
      countdownActive: true,
      countdownRemainingSeconds: 225, // 03:45
      countdownTotalSeconds: 300,

      // Settings
      autoEnergySaving: true,
      vacancyDelaySeconds: 300,
      restoreOnReentry: false, // Per PDF screenshot page 6: DISABLED for Room 3
      manualOverride: true,    // Per PDF screenshot page 6: Manual Override Active
      manualOverrideDurationSeconds: 1800,
      manualOverrideRemainingSeconds: 1334, // 22m 14s

      // Appliances
      fan: {
        id: 'fan-3',
        name: 'Fan 3 - DC Motor',
        type: 'fan',
        enableRequest: true, // User intended ON
        actualState: false,  // Auto-cutoff executed
        autoCutoff: true
      },
      light: {
        id: 'light-3',
        name: 'Light 3 - LED',
        type: 'light',
        enableRequest: false,
        actualState: false,
        autoCutoff: false
      }
    }
  ],

  // History Event Ledger
  activityHistory: [
    {
      id: 1,
      time: 'Today, 10:35 AM',
      description: 'Room 1 Occupancy Detected',
      target: 'Room 1 Occupancy Sensor',
      type: 'Occupancy',
      typeBadgeClass: 'badge-green',
      iconClass: 'green'
    },
    {
      id: 2,
      time: 'Today, 10:30 AM',
      description: 'Appliances restored after re-entry',
      target: 'All Active Loads',
      type: 'Restoration',
      typeBadgeClass: 'badge-blue',
      iconClass: 'blue'
    },
    {
      id: 3,
      time: 'Today, 09:12 AM',
      description: 'Fan 1 switched ON',
      target: 'Room 1 Fan',
      type: 'Appliance',
      typeBadgeClass: 'badge-blue',
      iconClass: 'blue'
    },
    {
      id: 4,
      time: 'Today, 08:45 AM',
      description: 'Vacancy countdown completed • Auto shutdown',
      target: 'All Room 3 Loads',
      type: 'Automatic',
      typeBadgeClass: 'badge-amber',
      iconClass: 'amber'
    },
    {
      id: 5,
      time: 'Yesterday, 07:15 PM',
      description: 'Light 2 switched OFF',
      target: 'Room 2 Light',
      type: 'Appliance',
      typeBadgeClass: 'badge-blue',
      iconClass: 'blue'
    },
    {
      id: 6,
      time: 'Yesterday, 07:00 PM',
      description: 'Room 3 became vacant',
      target: 'Room 3 Occupancy Sensor',
      type: 'Occupancy',
      typeBadgeClass: 'badge-green',
      iconClass: 'green'
    }
  ]
};

// Initialize State from localStorage if available, or default
let appState = JSON.parse(localStorage.getItem('smart_energy_state') || 'null');
if (!appState || !appState.rooms || appState.rooms.length !== 3) {
  appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
}

// Ensure activePage exists
if (!appState.activePage) appState.activePage = 'overview';

// ================= UTILITIES =================
function formatMMSS(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  let iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  if (type === 'success') {
    toast.style.borderLeft = '3px solid #10b981';
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'warning') {
    toast.style.borderLeft = '3px solid #f59e0b';
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }

  toast.innerHTML = `${iconSvg} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function saveState() {
  localStorage.setItem('smart_energy_state', JSON.stringify(appState));
}

function addEventToLog(description, target, type) {
  const now = new Date();
  const timeStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  let typeBadgeClass = 'badge-blue';
  let iconClass = 'blue';

  if (type === 'Occupancy') {
    typeBadgeClass = 'badge-green';
    iconClass = 'green';
  } else if (type === 'Automatic') {
    typeBadgeClass = 'badge-amber';
    iconClass = 'amber';
  } else if (type === 'Restoration') {
    typeBadgeClass = 'badge-purple';
    iconClass = 'blue';
  }

  const newEvent = {
    id: Date.now(),
    time: timeStr,
    description,
    target,
    type,
    typeBadgeClass,
    iconClass
  };

  appState.activityHistory.unshift(newEvent);
  if (appState.activityHistory.length > 50) appState.activityHistory.pop();
  saveState();
}

// ================= CORE AUTOMATION ENGINE =================
function startAutomationTicker() {
  setInterval(() => {
    let stateChanged = false;

    appState.rooms.forEach(room => {
      // 1. Handle Manual Override Timer
      if (room.manualOverride && room.manualOverrideRemainingSeconds > 0) {
        room.manualOverrideRemainingSeconds--;
        stateChanged = true;
        if (room.manualOverrideRemainingSeconds <= 0) {
          room.manualOverride = false;
          showToast(`Manual Override expired for ${room.name}. Automation rules resumed.`, 'warning');
          // If room is vacant and autoEnergySaving is on, start countdown
          if (!room.isOccupied && room.autoEnergySaving) {
            room.countdownActive = true;
            room.countdownRemainingSeconds = room.vacancyDelaySeconds;
            room.countdownTotalSeconds = room.vacancyDelaySeconds;
          }
        }
      }

      // 2. Handle Vacancy Countdown
      if (room.countdownActive && !room.manualOverride) {
        if (room.countdownRemainingSeconds > 0) {
          room.countdownRemainingSeconds--;
          stateChanged = true;
        }

        // Countdown Reached Zero -> Execute Auto Cutoff
        if (room.countdownRemainingSeconds <= 0) {
          room.countdownActive = false;
          room.countdownRemainingSeconds = 0;

          let appliancesTurnedOff = [];

          if (room.fan.actualState) {
            room.fan.actualState = false;
            room.fan.autoCutoff = true;
            appliancesTurnedOff.push('Fan');
          }
          if (room.light.actualState) {
            room.light.actualState = false;
            room.light.autoCutoff = true;
            appliancesTurnedOff.push('Light');
          }

          if (appliancesTurnedOff.length > 0) {
            const desc = `Vacancy countdown completed • Auto shutdown (${appliancesTurnedOff.join(' & ')})`;
            addEventToLog(desc, `${room.name} Loads`, 'Automatic');
            showToast(`Auto Cutoff executed: ${room.name} appliances switched OFF to conserve power.`, 'warning');
          }
          stateChanged = true;
        }
      }
    });

    if (stateChanged) {
      saveState();
      renderCurrentPageDynamicElements();
    }
  }, 1000);
}

// ================= OCCUPANCY ACTIONS =================
function setOccupancy(roomId, isOccupied) {
  const room = appState.rooms.find(r => r.id === roomId);
  if (!room) return;

  if (room.isOccupied === isOccupied) {
    showToast(`${room.name} is already ${isOccupied ? 'Occupied' : 'Vacant'}.`);
    return;
  }

  room.isOccupied = isOccupied;

  if (isOccupied) {
    // Occupancy returns:
    // 1. Cancel countdown
    room.countdownActive = false;
    room.countdownRemainingSeconds = room.vacancyDelaySeconds;
    room.lastPresenceText = 'Continuous presence detected';
    room.motionType = 'Stationary + Moving';
    room.range = roomId === 1 ? '1.8m' : '2.4m';

    // 2. Restore enabled appliances if restoreOnReentry is active
    let restoredItems = [];
    if (room.restoreOnReentry) {
      if (room.fan.autoCutoff && room.fan.enableRequest) {
        room.fan.actualState = true;
        room.fan.autoCutoff = false;
        restoredItems.push('Fan');
      }
      if (room.light.autoCutoff && room.light.enableRequest) {
        room.light.actualState = true;
        room.light.autoCutoff = false;
        restoredItems.push('Light');
      }

      if (restoredItems.length > 0) {
        addEventToLog(`Appliances restored after re-entry (${restoredItems.join(' & ')})`, `${room.name} Loads`, 'Restoration');
        showToast(`${room.name} occupied: Enabled appliances automatically restored!`, 'success');
      } else {
        addEventToLog(`${room.name} Occupancy Detected`, `${room.name} Occupancy Sensor`, 'Occupancy');
        showToast(`${room.name} is now OCCUPIED.`, 'info');
      }
    } else {
      // Re-entry restoration disabled
      room.fan.autoCutoff = false;
      room.light.autoCutoff = false;
      addEventToLog(`${room.name} Occupancy Detected (Restoration Disabled)`, `${room.name} Occupancy Sensor`, 'Occupancy');
      showToast(`${room.name} is OCCUPIED (Restoration disabled: switches remain OFF).`, 'info');
    }

  } else {
    // Room becomes Vacant:
    const now = new Date();
    room.lastPresenceText = `Cleared at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    room.motionType = 'None';
    room.range = 'None';

    if (room.manualOverride) {
      room.countdownActive = false;
      addEventToLog(`${room.name} became vacant (Manual Override Active)`, `${room.name} Sensor`, 'Occupancy');
      showToast(`${room.name} is VACANT (Manual Override active: countdown suspended).`, 'warning');
    } else if (room.autoEnergySaving) {
      room.countdownActive = true;
      room.countdownRemainingSeconds = room.vacancyDelaySeconds;
      room.countdownTotalSeconds = room.vacancyDelaySeconds;

      addEventToLog(`${room.name} Vacancy Countdown Started (${formatMMSS(room.vacancyDelaySeconds)})`, `${room.name} Sensor`, 'Occupancy');
      showToast(`${room.name} is VACANT. Vacancy countdown started (${formatMMSS(room.vacancyDelaySeconds)}).`, 'warning');
    } else {
      room.countdownActive = false;
      addEventToLog(`${room.name} became vacant (Auto Energy Saving Disabled)`, `${room.name} Sensor`, 'Occupancy');
      showToast(`${room.name} is VACANT (Auto Energy Saving is OFF).`);
    }
  }

  saveState();
  renderAll();
}

function toggleOccupancy(roomId) {
  const room = appState.rooms.find(r => r.id === roomId);
  if (room) setOccupancy(roomId, !room.isOccupied);
}

function triggerFastCountdownTest() {
  let anyVacant = false;
  appState.rooms.forEach(room => {
    if (!room.isOccupied) {
      room.countdownActive = true;
      room.countdownRemainingSeconds = 10;
      room.countdownTotalSeconds = 10;
      room.manualOverride = false;
      anyVacant = true;
    }
  });

  if (!anyVacant) {
    // If no room is vacant, make Room 3 vacant for fast demonstration
    setOccupancy(3, false);
    const r3 = appState.rooms.find(r => r.id === 3);
    r3.countdownRemainingSeconds = 10;
    r3.countdownTotalSeconds = 10;
    showToast('Room 3 set to Vacant with 10s Fast Demo countdown!', 'warning');
  } else {
    showToast('Fast 10-Second Demo countdown activated on vacant rooms!', 'warning');
  }

  saveState();
  renderAll();
}

// ================= APPLIANCE ACTIONS =================
function toggleAppliance(roomId, applianceType) {
  const room = appState.rooms.find(r => r.id === roomId);
  if (!room) return;

  const appliance = room[applianceType];
  if (!appliance) return;

  // Toggle user intent
  appliance.enableRequest = !appliance.enableRequest;
  appliance.actualState = appliance.enableRequest;
  appliance.autoCutoff = false;

  const stateStr = appliance.actualState ? 'switched ON' : 'switched OFF';
  addEventToLog(`${appliance.name} ${stateStr}`, `${room.name} ${appliance.type === 'fan' ? 'Fan' : 'Light'}`, 'Appliance');
  showToast(`${appliance.name} in ${room.name} ${stateStr}.`, appliance.actualState ? 'success' : 'info');

  saveState();
  renderAll();
}

function setMasterAppliances(turnOn) {
  appState.rooms.forEach(room => {
    room.fan.enableRequest = turnOn;
    room.fan.actualState = turnOn;
    room.fan.autoCutoff = false;

    room.light.enableRequest = turnOn;
    room.light.actualState = turnOn;
    room.light.autoCutoff = false;
  });

  const actionStr = turnOn ? 'All appliances switched ON' : 'All appliances switched OFF';
  addEventToLog(`Master control: ${actionStr}`, 'All Rooms Loads', 'Appliance');
  showToast(`Master Command: ${actionStr}!`, turnOn ? 'success' : 'info');

  saveState();
  renderAll();
}

// ================= NAVIGATION =================
function navigateToPage(pageId) {
  appState.activePage = pageId;

  // Update sidebar active classes
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update page visibility
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${pageId}`);
  if (targetView) targetView.classList.add('active');

  // Update topbar status text per page specification
  const topbarText = document.getElementById('topbar-status-text');
  if (topbarText) {
    if (pageId === 'overview') {
      topbarText.textContent = 'ESP32 CONTROLLER: ONLINE • Hardware Testbed';
    } else if (pageId === 'appliance' || pageId === 'occupancy') {
      topbarText.textContent = 'ONLINE - Live Hardware Link | Latency: 14ms';
    } else if (pageId === 'analytics') {
      topbarText.textContent = 'ESP32 Controller: Online';
    } else if (pageId === 'history') {
      topbarText.textContent = 'ONLINE • PZEM-016 Modbus Stream Synchronized';
    } else if (pageId === 'settings') {
      topbarText.textContent = 'ONLINE - ESP32 Controller: Online';
    }
  }

  saveState();
  renderAll();
}

// ================= UI RENDERING =================
function renderAll() {
  renderOverviewPage();
  renderAppliancePage();
  renderOccupancyPage();
  renderAnalyticsPage();
  renderHistoryPage();
  renderSettingsPage();
  renderFloatingDemoBar();
}

function renderCurrentPageDynamicElements() {
  // Lightweight second-by-second updates for active timers & progress bars
  const p = appState.activePage;
  if (p === 'overview') renderOverviewPage();
  else if (p === 'appliance') renderAppliancePage();
  else if (p === 'occupancy') renderOccupancyPage();
  else if (p === 'analytics') renderAnalyticsPage();
  else if (p === 'history') renderHistoryTableOnly();
  else if (p === 'settings') renderSettingsPage();
  renderFloatingDemoBar();
}

// ----------------- 1. OVERVIEW PAGE -----------------
function renderOverviewPage() {
  const totalRooms = appState.rooms.length;
  const occupiedRooms = appState.rooms.filter(r => r.isOccupied).length;

  let totalOn = 0;
  let fansOn = 0;
  let lightsOn = 0;

  appState.rooms.forEach(r => {
    if (r.fan.actualState) { totalOn++; fansOn++; }
    if (r.light.actualState) { totalOn++; lightsOn++; }
  });

  // Stat metrics
  const occEl = document.getElementById('overview-occupied-rooms');
  if (occEl) occEl.textContent = `${occupiedRooms} / ${totalRooms}`;

  const occPctEl = document.getElementById('overview-occupied-percent');
  if (occPctEl) {
    const pct = Math.round((occupiedRooms / totalRooms) * 100);
    occPctEl.textContent = `${pct}% Active`;
  }

  const appOnEl = document.getElementById('overview-appliances-on');
  if (appOnEl) appOnEl.textContent = `${totalOn} / 6`;

  const appDetEl = document.getElementById('overview-appliances-detail');
  if (appDetEl) appDetEl.textContent = `${fansOn} Fan, ${lightsOn} Light${lightsOn !== 1 ? 's' : ''} active`;

  // 3 Room Overview Cards
  const roomGrid = document.getElementById('overview-room-cards');
  if (roomGrid) {
    roomGrid.innerHTML = appState.rooms.map(room => {
      const isOcc = room.isOccupied;
      const occBadge = isOcc
        ? `<span class="badge badge-blue">● Occupied</span>`
        : `<span class="badge badge-grey">● Vacant</span>`;

      const fanStateStr = room.fan.actualState ? '<span class="state-on">ON</span>' : '<span class="state-off">OFF</span>';
      const lightStateStr = room.light.actualState ? '<span class="state-on">ON</span>' : '<span class="state-off">OFF</span>';

      let footerText = `<span>● Demonstration Data</span><span>Real-time Sync</span>`;
      if (!isOcc && room.countdownActive) {
        footerText = `<span>● DEMO DATA</span><span style="color: var(--warning); font-weight: 600;">Auto-cutoff active (${formatMMSS(room.countdownRemainingSeconds)})</span>`;
      } else if (!isOcc) {
        footerText = `<span>● DEMO DATA</span><span>Auto-cutoff executed</span>`;
      }

      return `
        <div class="room-card">
          <div class="room-card-header">
            <div class="room-card-title-group">
              <div class="room-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                </svg>
              </div>
              <div>
                <div class="room-name">${room.name}</div>
                <div class="room-subname">${room.roomType} • ${room.nodeId}</div>
              </div>
            </div>
            ${occBadge}
          </div>

          <div class="room-item-row">
            <div class="room-item-info">
              <div class="room-item-icon ${isOcc ? 'active' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.93 19.07A10 10 0 0 1 19.07 4.93M7.76 16.24a6 6 0 0 1 8.48-8.48"></path><circle cx="12" cy="12" r="2"></circle></svg>
              </div>
              <div>
                <div class="room-item-name">LD2410C Sensor</div>
                <div class="room-item-sub">${room.name} / ${room.roomType}</div>
              </div>
            </div>
            <div class="room-item-state">${isOcc ? '<span class="state-on">● Occupied</span>' : '<span class="state-off">● Vacant</span>'}</div>
          </div>

          <div class="room-item-row">
            <div class="room-item-info">
              <div class="room-item-icon ${room.fan.actualState ? 'active' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c2-2 5-2 5 0s-3 2-5 0zm0 0c-2 2-2 5 0 5s2-3 0-5zm0 0c-2-2-5-2-5 0s3 2 5 0zm0 0c2-2 2-5 0-5s-2 3 0 5z"></path></svg>
              </div>
              <div>
                <div class="room-item-name">DC Motor (Fan)</div>
                <div class="room-item-sub">${room.name} / ${room.roomType}</div>
              </div>
            </div>
            <div class="room-item-state">${fanStateStr}</div>
          </div>

          <div class="room-item-row">
            <div class="room-item-info">
              <div class="room-item-icon ${room.light.actualState ? 'active' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6m-3-15a6 6 0 0 0-6 6c0 3 2 5 3 6v1h6v-1c1-1 3-3 3-6a6 6 0 0 0-6-6z"></path></svg>
              </div>
              <div>
                <div class="room-item-name">LED Light</div>
                <div class="room-item-sub">${room.name} / ${room.roomType}</div>
              </div>
            </div>
            <div class="room-item-state">${lightStateStr}</div>
          </div>

          <div class="room-card-footer">
            ${footerText}
          </div>
        </div>
      `;
    }).join('');
  }

  // Recent Activity in Overview
  const actEl = document.getElementById('overview-recent-activity');
  if (actEl) {
    const recents = appState.activityHistory.slice(0, 3);
    actEl.innerHTML = recents.map(item => `
      <div class="activity-item">
        <div class="activity-icon-badge ${item.iconClass}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${item.type === 'Occupancy' ? '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' : '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>'}
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-header">
            <span class="activity-title">${item.description}</span>
            <span class="activity-time">${item.time}</span>
          </div>
          <div class="activity-desc">${item.target} • ${item.type} telemetry validated</div>
        </div>
      </div>
    `).join('');
  }

  const storedEl = document.getElementById('overview-events-stored');
  if (storedEl) storedEl.textContent = `Events: ${appState.activityHistory.length} Stored`;
}

// ----------------- 2. APPLIANCE CONTROL PAGE -----------------
function renderAppliancePage() {
  let activeCount = 0;
  let activeDetails = [];
  let offDetails = [];

  appState.rooms.forEach(r => {
    if (r.fan.actualState) { activeCount++; activeDetails.push(`Fan ${r.id}`); }
    else { offDetails.push(`Fan ${r.id}`); }

    if (r.light.actualState) { activeCount++; activeDetails.push(`Light ${r.id}`); }
    else { offDetails.push(`Light ${r.id}`); }
  });

  const actCountEl = document.getElementById('appliance-active-count');
  if (actCountEl) actCountEl.textContent = `${activeCount} ON`;

  const actDetEl = document.getElementById('appliance-active-detail');
  if (actDetEl) actDetEl.textContent = activeDetails.length > 0 ? activeDetails.join(', ') : 'None';

  const offCountEl = document.getElementById('appliance-off-count');
  if (offCountEl) offCountEl.textContent = `${6 - activeCount} OFF`;

  const offDetEl = document.getElementById('appliance-off-detail');
  if (offDetEl) offDetEl.textContent = offDetails.length > 0 ? offDetails.join(', ') : 'None';

  const roomGrid = document.getElementById('appliance-room-cards');
  if (roomGrid) {
    roomGrid.innerHTML = appState.rooms.map(room => {
      const isOcc = room.isOccupied;
      const occBadge = isOcc
        ? `<span class="badge badge-blue">● OCCUPIED</span>`
        : `<span class="badge badge-grey">● VACANT</span>`;

      // Auto-cutoff banner
      const autoCutoffBanner = (!isOcc && (room.fan.autoCutoff || room.light.autoCutoff))
        ? `<div class="auto-cutoff-banner">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
             <div>Auto-cutoff active (${room.autoEnergySaving ? 'vacancy timeout elapsed' : 'manual'})</div>
           </div>`
        : '';

      // Fan state details
      const fanReq = room.fan.enableRequest ? 'ON' : 'OFF';
      const fanActual = room.fan.actualState ? 'ON' : (room.fan.autoCutoff ? 'OFF (Auto-Cutoff)' : 'OFF');
      const fanBadge = room.fan.actualState
        ? '<span class="badge badge-blue">Running</span>'
        : (room.fan.autoCutoff ? '<span class="badge badge-amber">Auto-Cutoff</span>' : '<span class="badge badge-grey">Idle / Standby</span>');

      // Light state details
      const lightReq = room.light.enableRequest ? 'ON' : 'OFF';
      const lightActual = room.light.actualState ? 'ON' : (room.light.autoCutoff ? 'OFF (Auto-Cutoff)' : 'OFF');
      const lightBadge = room.light.actualState
        ? '<span class="badge badge-blue">Illuminated</span>'
        : (room.light.autoCutoff ? '<span class="badge badge-amber">Auto-Cutoff</span>' : '<span class="badge badge-grey">Idle / Standby</span>');

      return `
        <div class="room-card">
          <div class="room-card-header">
            <div>
              <div class="room-name">${room.name}</div>
              <div class="room-subname">Node: ${room.nodeId}</div>
            </div>
            ${occBadge}
          </div>

          ${autoCutoffBanner}

          <!-- FAN MODULE -->
          <div class="appliance-module">
            <div class="appliance-header">
              <div class="appliance-title-box">
                <span class="appliance-name">${room.fan.name}</span>
                <span class="appliance-sub">Status: ${room.fan.autoCutoff ? 'Auto-Cutoff Activated' : (room.fan.actualState ? 'Online' : 'Standby')}</span>
              </div>
              <label class="switch">
                <input type="checkbox" ${room.fan.actualState ? 'checked' : ''} onchange="toggleAppliance(${room.id}, 'fan')">
                <span class="slider"></span>
              </label>
            </div>

            <table class="appliance-details-table">
              <tr>
                <td class="label-col">Enable Request:</td>
                <td class="val-col ${room.fan.enableRequest ? 'on' : 'off'}">${room.fan.autoCutoff ? 'ON (User Intent)' : fanReq}</td>
              </tr>
              <tr>
                <td class="label-col">Actual State:</td>
                <td class="val-col ${room.fan.actualState ? 'on' : 'off'}">${fanActual}</td>
              </tr>
            </table>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
              ${fanBadge}
              <span style="font-size: 10.5px; color: var(--text-muted);">${room.fan.autoCutoff ? 'Preserved' : 'Synchronized'}</span>
            </div>

            ${room.fan.autoCutoff ? `
              <div style="margin-top: 8px; padding: 6px 8px; background: #fffbeb; border-radius: 6px; font-size: 10.5px; color: #92400e; line-height: 1.35;">
                <strong>Reason:</strong> Room is vacant and automatic shutdown has activated. Preserved for restoration upon re-entry.
              </div>
            ` : ''}
          </div>

          <!-- LIGHT MODULE -->
          <div class="appliance-module">
            <div class="appliance-header">
              <div class="appliance-title-box">
                <span class="appliance-name">${room.light.name}</span>
                <span class="appliance-sub">Status: ${room.light.autoCutoff ? 'Auto-Cutoff Activated' : (room.light.actualState ? 'Online' : 'Standby')}</span>
              </div>
              <label class="switch">
                <input type="checkbox" ${room.light.actualState ? 'checked' : ''} onchange="toggleAppliance(${room.id}, 'light')">
                <span class="slider"></span>
              </label>
            </div>

            <table class="appliance-details-table">
              <tr>
                <td class="label-col">Enable Request:</td>
                <td class="val-col ${room.light.enableRequest ? 'on' : 'off'}">${room.light.autoCutoff ? 'ON (User Intent)' : lightReq}</td>
              </tr>
              <tr>
                <td class="label-col">Actual State:</td>
                <td class="val-col ${room.light.actualState ? 'on' : 'off'}">${lightActual}</td>
              </tr>
            </table>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
              ${lightBadge}
              <span style="font-size: 10.5px; color: var(--text-muted);">${room.light.autoCutoff ? 'Preserved' : 'Synchronized'}</span>
            </div>

            ${room.light.autoCutoff ? `
              <div style="margin-top: 8px; padding: 6px 8px; background: #fffbeb; border-radius: 6px; font-size: 10.5px; color: #92400e; line-height: 1.35;">
                <strong>Reason:</strong> Room is vacant and automatic shutdown has activated. Preserved for restoration upon re-entry.
              </div>
            ` : ''}
          </div>

          <div class="room-card-footer">
            <span>Restoration on Occupancy: <strong>${room.restoreOnReentry ? 'Enabled' : 'Disabled'}</strong></span>
            <span>DEMO DATA</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ----------------- 3. OCCUPANCY MONITORING PAGE -----------------
function renderOccupancyPage() {
  const occupiedCount = appState.rooms.filter(r => r.isOccupied).length;
  const activeCountdowns = appState.rooms.filter(r => !r.isOccupied && r.countdownActive).length;

  const kpiRatio = document.getElementById('occupancy-kpi-ratio');
  if (kpiRatio) kpiRatio.textContent = `${occupiedCount} / 3 Rooms Occupied`;

  const kpiRatioSub = document.getElementById('occupancy-kpi-ratio-sub');
  if (kpiRatioSub) {
    const occNames = appState.rooms.filter(r => r.isOccupied).map(r => r.name);
    const vacNames = appState.rooms.filter(r => !r.isOccupied).map(r => r.name);
    kpiRatioSub.textContent = `${occNames.join(' & ') || 'None'} • ${vacNames.join(' & ') || 'None'} Vacant`;
  }

  const kpiCount = document.getElementById('occupancy-kpi-countdown');
  if (kpiCount) kpiCount.textContent = `${activeCountdowns} Active Countdown${activeCountdowns !== 1 ? 's' : ''}`;

  const kpiCountSub = document.getElementById('occupancy-kpi-countdown-sub');
  if (kpiCountSub) {
    const firstActive = appState.rooms.find(r => !r.isOccupied && r.countdownActive);
    if (firstActive) {
      kpiCountSub.textContent = `${firstActive.name}: ${formatMMSS(firstActive.countdownRemainingSeconds)} remaining (${formatMMSS(firstActive.countdownTotalSeconds)} base)`;
    } else {
      kpiCountSub.textContent = 'All timers in standby';
    }
  }

  // Simulator bar buttons state
  appState.rooms.forEach(r => {
    const occBtn = document.getElementById(`sim-btn-r${r.id}-occ`);
    const vacBtn = document.getElementById(`sim-btn-r${r.id}-vac`);
    if (occBtn && vacBtn) {
      if (r.isOccupied) {
        occBtn.className = 'btn-sim active-occ';
        vacBtn.className = 'btn-sim';
      } else {
        occBtn.className = 'btn-sim';
        vacBtn.className = 'btn-sim active-vac';
      }
    }
  });

  // Room Cards
  const roomGrid = document.getElementById('occupancy-room-cards');
  if (roomGrid) {
    roomGrid.innerHTML = appState.rooms.map(room => {
      const isOcc = room.isOccupied;
      const pct = room.countdownTotalSeconds > 0
        ? Math.max(0, Math.min(100, Math.round(((room.countdownTotalSeconds - room.countdownRemainingSeconds) / room.countdownTotalSeconds) * 100)))
        : 0;

      let timerDisplay = `
        <div class="countdown-box">
          <div class="countdown-top">
            <span style="color: var(--text-muted); font-weight: 600;">VACANCY COUNTDOWN</span>
            <span class="badge badge-grey">${formatMMSS(room.vacancyDelaySeconds)} standby</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted);">Timer Paused • Paused while occupied</div>
        </div>
      `;

      if (!isOcc && room.countdownActive) {
        timerDisplay = `
          <div class="countdown-box" style="border-color: #bfdbfe; background: #eff6ff;">
            <div class="countdown-top">
              <span style="color: #1e3a8a; font-weight: 700;">VACANCY COUNTDOWN</span>
              <span class="countdown-timer-val">${formatMMSS(room.countdownRemainingSeconds)} remaining</span>
            </div>
            <div class="countdown-bar-bg">
              <div class="countdown-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px;">
              <span>${pct}% elapsed</span>
              <span>Cutoff at 00:00</span>
            </div>
          </div>
        `;
      } else if (!isOcc) {
        timerDisplay = `
          <div class="countdown-box" style="border-color: #fde68a; background: #fffbeb;">
            <div class="countdown-top">
              <span style="color: #92400e; font-weight: 700;">VACANCY COUNTDOWN</span>
              <span class="badge badge-amber">Completed (00:00)</span>
            </div>
            <div style="font-size: 11px; color: #92400e;">Automatic cutoff has isolated this room node.</div>
          </div>
        `;
      }

      return `
        <div class="room-card">
          <div class="room-card-header">
            <div>
              <div class="room-name">${room.name}</div>
              <div class="room-subname">Node: ${room.nodeId}</div>
            </div>
            <span class="badge ${isOcc ? 'badge-blue' : 'badge-grey'}">● ${isOcc ? 'OCCUPIED' : 'VACANT'}</span>
          </div>

          <!-- Quick Test Toggles inside Card -->
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button class="btn btn-sm ${isOcc ? 'btn-primary' : 'btn-outline-secondary'}" style="flex: 1;" onclick="setOccupancy(${room.id}, true)">Simulate Occupied</button>
            <button class="btn btn-sm ${!isOcc ? 'btn-outline-danger' : 'btn-outline-secondary'}" style="flex: 1;" onclick="setOccupancy(${room.id}, false)">Simulate Vacant</button>
          </div>

          <div style="padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border-light); margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <strong>${room.sensorName}</strong>
              <span style="color: var(--success); font-weight: 600;">● Online (12ms)</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">
              Presence Status: <strong style="color: ${isOcc ? 'var(--primary)' : 'var(--text-main)'};">${room.lastPresenceText}</strong>
            </div>
          </div>

          ${timerDisplay}

          ${(!isOcc && room.countdownActive) ? `
            <div style="font-size: 11px; color: #92400e; padding: 6px 8px; background: #fffbeb; border-radius: 6px; margin-bottom: 10px;">
              <strong>Action Pending:</strong> Automatic shutdown triggers when timer reaches 00:00 (Will turn OFF ${room.fan.name} & ${room.light.name}).
            </div>
          ` : ''}

          <div class="room-card-footer">
            <span>Fan: <strong>${room.fan.actualState ? 'ON' : 'OFF'}</strong> • Light: <strong>${room.light.actualState ? 'ON' : 'OFF'}</strong></span>
            <span>${room.restoreOnReentry ? 'Auto-restore active' : 'Manual restore'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Prototype Visualization Chambers
  const chambers = document.getElementById('occupancy-chambers-container');
  if (chambers) {
    chambers.innerHTML = appState.rooms.map(room => {
      const isOcc = room.isOccupied;

      return `
        <div class="chamber-box">
          <div class="chamber-header">
            <span>${room.name} - ${isOcc ? 'Occupied' : 'Vacant'}</span>
            <span class="badge badge-grey">R0${room.id} CHAMBER</span>
          </div>

          <div class="radar-arena">
            <div class="sensor-emitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93M7.76 16.24a6 6 0 0 1 8.48-8.48"></path>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
            </div>

            <!-- Concentric SVG radar arcs -->
            <svg class="radar-arcs" viewBox="0 0 200 120">
              <path d="M 30,110 A 80,80 0 0,1 170,110" fill="none" stroke="${isOcc ? 'rgba(37,99,235,0.4)' : 'rgba(148,163,184,0.3)'}" stroke-width="1.5" stroke-dasharray="${isOcc ? 'none' : '3,3'}"></path>
              <path d="M 55,110 A 55,55 0 0,1 145,110" fill="none" stroke="${isOcc ? 'rgba(37,99,235,0.6)' : 'rgba(148,163,184,0.3)'}" stroke-width="1.5"></path>
              <path d="M 75,110 A 30,30 0 0,1 125,110" fill="none" stroke="${isOcc ? 'rgba(37,99,235,0.8)' : 'rgba(148,163,184,0.3)'}" stroke-width="1.5"></path>
            </svg>

            <!-- Target Indicator -->
            <div class="target-person">
              <div class="target-icon ${isOcc ? '' : 'vacant'}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <span class="badge ${isOcc ? 'badge-green' : 'badge-grey'}" style="font-size: 9.5px;">
                ${isOcc ? 'Presence Detected' : 'No motion detected'}
              </span>
            </div>
          </div>

          <div class="chamber-telemetry">
            <span>Target: <strong>${room.motionType}</strong></span>
            <span>Range: <strong>${room.range}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Occupancy recent events
  const occEvList = document.getElementById('occupancy-recent-events');
  if (occEvList) {
    const occEvs = appState.activityHistory.filter(e => e.type === 'Occupancy' || e.type === 'Automatic').slice(0, 3);
    occEvList.innerHTML = occEvs.map(e => `
      <div class="activity-item">
        <div class="activity-icon-badge ${e.iconClass}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-header">
            <span class="activity-title">${e.description}</span>
            <span class="activity-time">${e.time}</span>
          </div>
          <div class="activity-desc">${e.target}</div>
        </div>
      </div>
    `).join('');
  }
}

// ----------------- 4. ENERGY ANALYTICS PAGE -----------------
function toggleSimFeed(checked) {
  appState.simulatedFeed = checked;
  saveState();
  renderAnalyticsPage();
  showToast(`Simulated benchmark telemetry feed ${checked ? 'enabled' : 'paused'}.`);
}

function switchPowerChart(range) {
  const btnToday = document.getElementById('chart-btn-today');
  const btn7d = document.getElementById('chart-btn-7d');
  if (range === 'today') {
    btnToday.classList.add('active');
    btn7d.classList.remove('active');
  } else {
    btnToday.classList.remove('active');
    btn7d.classList.add('active');
  }
  renderPowerAreaChart(range);
}

function renderAnalyticsPage() {
  // Correlate simulated power values with actual active loads
  let activeAppliances = 0;
  appState.rooms.forEach(r => {
    if (r.fan.actualState) activeAppliances++;
    if (r.light.actualState) activeAppliances++;
  });

  // 12V DC calculations: baseline ~2.1W + ~4.8W per fan + ~3.1W per light
  const currentPowerWatts = appState.simulatedFeed ? (2.1 + (activeAppliances * 5.1)).toFixed(1) : '0.0';
  const currentAmps = appState.simulatedFeed ? (parseFloat(currentPowerWatts) / 12.0).toFixed(2) : '0.00';

  const vEl = document.getElementById('analytics-voltage');
  if (vEl) vEl.textContent = appState.simulatedFeed ? '12.0 V' : '-- V';

  const cEl = document.getElementById('analytics-current');
  if (cEl) cEl.textContent = `${currentAmps} A`;

  const pEl = document.getElementById('analytics-power');
  if (pEl) pEl.textContent = `${currentPowerWatts} W`;

  const eEl = document.getElementById('analytics-energy');
  if (eEl) eEl.textContent = '186.2 Wh';

  // Render SVG charts
  renderPowerAreaChart('today');
  renderEnergyBarChart();

  // Topology Cards
  const topGrid = document.getElementById('analytics-topology-cards');
  if (topGrid) {
    topGrid.innerHTML = appState.rooms.map(room => {
      const isOcc = room.isOccupied;

      let subNote = 'Both appliances active on DC bus';
      if (!room.fan.actualState && !room.light.actualState) {
        subNote = isOcc ? 'Appliances in standby' : 'Auto-cutoff active (0 W draw)';
      } else if (!room.fan.actualState || !room.light.actualState) {
        subNote = '1 of 2 appliances active on DC bus';
      }

      return `
        <div class="room-card">
          <div class="room-card-header">
            <div>
              <div class="room-name">${room.name}</div>
              <div class="room-subname">${room.roomType} • 12V Bus</div>
            </div>
            <span class="badge ${isOcc ? 'badge-blue' : 'badge-grey'}">● ${isOcc ? 'OCCUPIED' : 'VACANT'}</span>
          </div>

          <div class="room-item-row">
            <span style="font-size: 11px; color: var(--text-muted);">LD2410C Presence:</span>
            <strong style="font-size: 11px; color: ${isOcc ? 'var(--primary)' : 'var(--text-muted)'};">${isOcc ? room.motionType : 'No Target Detected'}</strong>
          </div>

          <div class="room-item-row">
            <span style="font-size: 11px; color: var(--text-muted);">${room.fan.name}:</span>
            <strong style="font-size: 11px;" class="${room.fan.actualState ? 'state-on' : 'state-off'}">${room.fan.actualState ? 'ON (~5.2W)' : 'OFF (0W)'}</strong>
          </div>

          <div class="room-item-row">
            <span style="font-size: 11px; color: var(--text-muted);">${room.light.name}:</span>
            <strong style="font-size: 11px;" class="${room.light.actualState ? 'state-on' : 'state-off'}">${room.light.actualState ? 'ON (~3.2W)' : 'OFF (0W)'}</strong>
          </div>

          <div class="room-card-footer">
            <span>${subNote}</span>
            <span>DEMO DATA</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderPowerAreaChart(range) {
  const container = document.getElementById('power-chart-container');
  if (!container) return;

  // Clean SVG Area Chart
  const svg = `
    <svg viewBox="0 0 540 180" width="100%" height="100%">
      <defs>
        <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2563eb" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0"/>
        </linearGradient>
      </defs>

      <!-- Horizontal gridlines -->
      <line x1="40" y1="30" x2="520" y2="30" stroke="#f1f5f9" stroke-width="1"/>
      <line x1="40" y1="70" x2="520" y2="70" stroke="#f1f5f9" stroke-width="1"/>
      <line x1="40" y1="110" x2="520" y2="110" stroke="#f1f5f9" stroke-width="1"/>
      <line x1="40" y1="150" x2="520" y2="150" stroke="#e2e8f0" stroke-width="1"/>

      <!-- Y-Axis labels -->
      <text x="32" y="34" fill="#94a3b8" font-size="10" text-anchor="end">30W</text>
      <text x="32" y="74" fill="#94a3b8" font-size="10" text-anchor="end">20W</text>
      <text x="32" y="114" fill="#94a3b8" font-size="10" text-anchor="end">10W</text>
      <text x="32" y="154" fill="#94a3b8" font-size="10" text-anchor="end">0W</text>

      <!-- Baseline Standby Line (~2.1W) -->
      <line x1="40" y1="142" x2="520" y2="142" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>

      <!-- Area Path -->
      <path d="M 40,140 Q 90,135 130,110 T 210,120 T 300,55 T 390,85 T 460,95 T 520,105 L 520,150 L 40,150 Z" fill="url(#powerGrad)"/>

      <!-- Smooth Line Path -->
      <path d="M 40,140 Q 90,135 130,110 T 210,120 T 300,55 T 390,85 T 460,95 T 520,105" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Peak Callout Point at (300, 55) -->
      <circle cx="300" cy="55" r="4.5" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
      
      <!-- Callout box -->
      <rect x="255" y="24" width="90" height="22" rx="4" fill="#0f172a"/>
      <text x="300" y="38" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle">22.8 W (14:15)</text>

      <!-- X-Axis labels -->
      <text x="40" y="168" fill="#94a3b8" font-size="10" text-anchor="start">00:00</text>
      <text x="120" y="168" fill="#94a3b8" font-size="10" text-anchor="middle">04:00</text>
      <text x="200" y="168" fill="#94a3b8" font-size="10" text-anchor="middle">08:00</text>
      <text x="300" y="168" fill="#94a3b8" font-size="10" text-anchor="middle">12:00</text>
      <text x="390" y="168" fill="#94a3b8" font-size="10" text-anchor="middle">16:00</text>
      <text x="470" y="168" fill="#94a3b8" font-size="10" text-anchor="middle">20:00</text>
      <text x="520" y="168" fill="#94a3b8" font-size="10" text-anchor="end">Now</text>
    </svg>
  `;
  container.innerHTML = svg;
}

function renderEnergyBarChart() {
  const container = document.getElementById('energy-bar-chart-container');
  if (!container) return;

  const days = [
    { name: 'Mon', val: 135, h: 65 },
    { name: 'Tue', val: 150, h: 72 },
    { name: 'Wed', val: 190, h: 90 },
    { name: 'Thu', val: 175, h: 84 },
    { name: 'Fri', val: 210, h: 102 },
    { name: 'Sat', val: 186, h: 88 },
    { name: 'Sun', val: 151, h: 74, isToday: true }
  ];

  const svg = `
    <svg viewBox="0 0 540 180" width="100%" height="100%">
      <!-- Grid line -->
      <line x1="30" y1="145" x2="520" y2="145" stroke="#e2e8f0" stroke-width="1"/>
      <line x1="30" y1="95" x2="520" y2="95" stroke="#f1f5f9" stroke-width="1"/>
      <line x1="30" y1="45" x2="520" y2="45" stroke="#f1f5f9" stroke-width="1"/>

      <!-- Bars -->
      ${days.map((d, i) => {
    const x = 50 + (i * 68);
    const y = 145 - d.h;
    const color = d.isToday ? '#2563eb' : '#38bdf8';
    return `
          <g>
            <rect x="${x}" y="${y}" width="36" height="${d.h}" rx="4" fill="${color}"/>
            <text x="${x + 18}" y="${y - 6}" fill="#64748b" font-size="9.5" font-weight="600" text-anchor="middle">${d.val}</text>
            <text x="${x + 18}" y="162" fill="${d.isToday ? '#2563eb' : '#64748b'}" font-size="10" font-weight="${d.isToday ? '700' : '500'}" text-anchor="middle">${d.name}</text>
            ${d.isToday ? `<text x="${x + 18}" y="172" fill="#2563eb" font-size="8.5" font-weight="700" text-anchor="middle">(Today)</text>` : ''}
          </g>
        `;
  }).join('')}
    </svg>
  `;
  container.innerHTML = svg;
}

// ----------------- 5. HISTORY & REPORTS PAGE -----------------
let historyFilterType = 'all';
let historySearchTerm = '';

function setHistoryRange(range, btn) {
  if (btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  showToast(`Report range set to: ${range.toUpperCase()}`);
}

function filterHistoryTable(type, btn) {
  historyFilterType = type;
  if (btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  renderHistoryTableOnly();
}

function handleHistorySearch(term) {
  historySearchTerm = term.toLowerCase().trim();
  renderHistoryTableOnly();
}

function applyHistorySearch() {
  renderHistoryTableOnly();
}

function renderHistoryPage() {
  const container = document.getElementById('history-chart-container');
  if (container) {
    const days = [
      { day: 'Sat 19', val: 2.1, h: 50 },
      { day: 'Sun 20', val: 2.4, h: 58 },
      { day: 'Mon 21', val: 2.9, h: 70 },
      { day: 'Tue 22', val: 3.4, h: 88, peak: true },
      { day: 'Wed 23', val: 3.1, h: 76 },
      { day: 'Today', val: 2.3, h: 55, isToday: true }
    ];

    container.innerHTML = `
      <svg viewBox="0 0 500 180" width="100%" height="100%">
        <line x1="20" y1="145" x2="480" y2="145" stroke="#e2e8f0" stroke-width="1"/>
        <line x1="20" y1="95" x2="480" y2="95" stroke="#f1f5f9" stroke-width="1"/>
        <line x1="20" y1="45" x2="480" y2="45" stroke="#f1f5f9" stroke-width="1"/>

        ${days.map((d, i) => {
      const x = 40 + (i * 74);
      const y = 145 - d.h;
      const color = d.peak ? '#0284c7' : (d.isToday ? '#2563eb' : '#38bdf8');
      return `
            <g>
              <rect x="${x}" y="${y}" width="38" height="${d.h}" rx="4" fill="${color}"/>
              <text x="${x + 19}" y="${y - 6}" fill="#64748b" font-size="9.5" font-weight="600" text-anchor="middle">${d.val}</text>
              ${d.peak ? `<text x="${x + 19}" y="${y - 18}" fill="#0284c7" font-size="9" font-weight="700" text-anchor="middle">★ Peak</text>` : ''}
              <text x="${x + 19}" y="162" fill="#64748b" font-size="10" font-weight="600" text-anchor="middle">${d.day}</text>
            </g>
          `;
    }).join('')}
      </svg>
    `;
  }

  renderHistoryTableOnly();
}

function renderHistoryTableOnly() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  let items = appState.activityHistory;

  if (historyFilterType !== 'all') {
    items = items.filter(i => i.type.toLowerCase().includes(historyFilterType.toLowerCase()));
  }

  if (historySearchTerm) {
    items = items.filter(i =>
      i.description.toLowerCase().includes(historySearchTerm) ||
      i.target.toLowerCase().includes(historySearchTerm) ||
      i.type.toLowerCase().includes(historySearchTerm)
    );
  }

  const paginationLabel = document.getElementById('history-pagination-label');
  if (paginationLabel) {
    paginationLabel.textContent = `Showing ${Math.min(items.length, 6)} of ${items.length} events`;
  }

  const displayItems = items.slice(0, 6);

  if (displayItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No events matched your search filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = displayItems.map(item => `
    <tr>
      <td style="color: var(--text-muted); font-size: 11px;">${item.time}</td>
      <td><strong>${item.description}</strong></td>
      <td style="color: #475569;">${item.target}</td>
      <td><span class="badge ${item.typeBadgeClass}">● ${item.type}</span></td>
    </tr>
  `).join('');
}

function exportCSVReport() {
  let csvContent = "data:text/csv;charset=utf-8,ID,Timestamp,Event Description,Appliance Target,Event Type\n";
  appState.activityHistory.forEach(item => {
    const row = [
      item.id,
      `"${item.time}"`,
      `"${item.description}"`,
      `"${item.target}"`,
      `"${item.type}"`
    ].join(',');
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `smart_energy_activity_report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast("CSV Activity Report downloaded successfully!", "success");
}

function exportPDFReport() {
  showToast("Preparing printable PDF view...", "info");
  setTimeout(() => window.print(), 300);
}

// ----------------- 6. SETTINGS PAGE -----------------
function setRoomVacancyDelay(roomId, seconds) {
  const room = appState.rooms.find(r => r.id === roomId);
  if (!room) return;

  room.vacancyDelaySeconds = seconds;
  if (!room.isOccupied && room.countdownActive) {
    room.countdownTotalSeconds = seconds;
    room.countdownRemainingSeconds = Math.min(room.countdownRemainingSeconds, seconds);
  }
  saveState();
  renderSettingsPage();
  showToast(`${room.name} Vacancy Delay updated to ${seconds < 60 ? seconds + 's' : (seconds / 60) + ' min'}.`);
}

function toggleSetting(roomId, settingKey) {
  const room = appState.rooms.find(r => r.id === roomId);
  if (!room) return;

  room[settingKey] = !room[settingKey];

  if (settingKey === 'manualOverride') {
    if (room.manualOverride) {
      room.manualOverrideRemainingSeconds = room.manualOverrideDurationSeconds;
      room.countdownActive = false;
      showToast(`${room.name}: Manual Override enabled. Energy cutoff suspended.`, 'warning');
    } else {
      room.manualOverrideRemainingSeconds = 0;
      showToast(`${room.name}: Manual Override disabled. Automation rules apply.`, 'info');
      if (!room.isOccupied && room.autoEnergySaving) {
        room.countdownActive = true;
        room.countdownRemainingSeconds = room.vacancyDelaySeconds;
      }
    }
  }

  saveState();
  renderSettingsPage();
}

function renderSettingsPage() {
  const container = document.getElementById('settings-room-cards');
  if (!container) return;

  container.innerHTML = appState.rooms.map(room => {
    const isOcc = room.isOccupied;

    const delayOptions = [
      { label: '10s Demo', val: 10 },
      { label: '1m', val: 60 },
      { label: '3m', val: 180 },
      { label: '5m', val: 300 },
      { label: '10m', val: 600 },
      { label: '15m', val: 900 }
    ];

    const currentDelayText = room.vacancyDelaySeconds < 60
      ? `${room.vacancyDelaySeconds} seconds (Demo)`
      : `${Math.round(room.vacancyDelaySeconds / 60)} minutes`;

    return `
      <div class="settings-room-card">
        <div class="room-card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="user-avatar" style="width: 24px; height: 24px; font-size: 11px;">${room.id}</span>
            <div>
              <div class="room-name">${room.name}</div>
              <div class="room-subname">Node: ${room.nodeId}</div>
            </div>
          </div>
          <span class="badge ${isOcc ? 'badge-blue' : 'badge-grey'}">● ${isOcc ? 'Occupied' : 'Vacant'}</span>
        </div>

        <!-- Setting 1: Auto Energy Saving -->
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-label-title">Automatic Energy Saving</div>
              <div class="settings-label-desc">Automatically turns off ${room.fan.name} and ${room.light.name} when vacancy delay expires.</div>
            </div>
            <label class="switch">
              <input type="checkbox" ${room.autoEnergySaving ? 'checked' : ''} onchange="toggleSetting(${room.id}, 'autoEnergySaving')">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Setting 2: Vacancy Delay -->
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-label-title">Vacancy Delay</div>
              <div class="settings-label-desc">Duration to wait after motion ceases before triggering shutoff.</div>
            </div>
            <span class="badge badge-grey">${currentDelayText}</span>
          </div>

          <div class="delay-pills">
            ${delayOptions.map(opt => `
              <button class="delay-pill-btn ${room.vacancyDelaySeconds === opt.val ? 'active' : ''}" onclick="setRoomVacancyDelay(${room.id}, ${opt.val})">${opt.label}</button>
            `).join('')}
          </div>
        </div>

        <!-- Setting 3: Restore on Re-entry -->
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-label-title">Restore on Re-entry</div>
              <div class="settings-label-desc">${room.restoreOnReentry ? 'Restores previous appliance states immediately when presence is detected.' : 'Relays stay off upon re-entry; occupant must trigger switch manually.'}</div>
            </div>
            <label class="switch">
              <input type="checkbox" ${room.restoreOnReentry ? 'checked' : ''} onchange="toggleSetting(${room.id}, 'restoreOnReentry')">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Setting 4: Manual Override -->
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-label-title">Manual Override ${room.manualOverride ? '<span class="badge badge-amber">Active</span>' : ''}</div>
              <div class="settings-label-desc">${room.manualOverride ? 'Automated energy cutoff suspended until timer expires or toggle disabled.' : 'Override inactive • Standard rules apply'}</div>
            </div>
            <label class="switch">
              <input type="checkbox" ${room.manualOverride ? 'checked' : ''} onchange="toggleSetting(${room.id}, 'manualOverride')">
              <span class="slider"></span>
            </label>
          </div>

          ${room.manualOverride ? `
            <div style="margin-top: 8px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 11px; color: #92400e; display: flex; justify-content: space-between;">
              <span>Timer in progress:</span>
              <strong>${formatMMSS(room.manualOverrideRemainingSeconds)} remaining</strong>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function saveSettings() {
  saveState();
  showToast("All 3 room configurations saved and validated on controller!", "success");
}

function resetSettingsToDefault() {
  appState.rooms.forEach(r => {
    r.autoEnergySaving = true;
    r.vacancyDelaySeconds = 300;
    r.restoreOnReentry = true;
    r.manualOverride = false;
    r.manualOverrideRemainingSeconds = 0;
  });
  saveState();
  renderSettingsPage();
  showToast("Settings reset to factory defaults.", "info");
}

// ----------------- FLOATING PRESENTATION BAR -----------------
function renderFloatingDemoBar() {
  appState.rooms.forEach(room => {
    const btn = document.getElementById(`float-r${room.id}-btn`);
    if (btn) {
      if (room.isOccupied) {
        btn.className = 'room-quick-btn';
        btn.textContent = `R${room.id}: Occupied`;
      } else {
        btn.className = 'room-quick-btn vacant';
        const timerText = room.countdownActive ? ` (${formatMMSS(room.countdownRemainingSeconds)})` : ' (Cutoff)';
        btn.textContent = `R${room.id}: Vacant${timerText}`;
      }
    }
  });
}

// ----------------- PROFILE & TELEMETRY SYNC -----------------
function triggerTelemetrySync() {
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.style.transform = 'rotate(360deg)';
    syncBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => { syncBtn.style.transform = 'none'; }, 600);
  }

  showToast('Polling ESP32 controller heartbeat: 3 nodes synced (14ms latency).', 'success');
  appState.lastSyncTime = Date.now();
  saveState();
  renderAll();
}

function resetDemoState() {
  if (confirm("Reset prototype dashboard to initial demo configuration?")) {
    localStorage.removeItem('smart_energy_state');
    appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    renderAll();
    showToast("Prototype reset to initial demo configuration.", "success");
  }
}

// ================= INITIALIZATION & EVENT LISTENERS =================
document.addEventListener('DOMContentLoaded', () => {
  // Navigation clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.getAttribute('data-page');
      if (pageId) navigateToPage(pageId);
    });
  });

  // Topbar sync button
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', triggerTelemetrySync);
  }

  // Topbar notifications button
  const notifBtn = document.getElementById('btn-notifications');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      showToast('Notifications: 3 Sensor nodes nominal. ESP32 buffer 100% synchronized.');
    });
  }

  // Profile dropdown toggle
  const profileBtn = document.getElementById('btn-profile-toggle');
  const dropdown = document.getElementById('profile-dropdown');
  if (profileBtn && dropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('active');
    });
  }

  // Initial render
  navigateToPage(appState.activePage || 'overview');
  renderAll();

  // Start background ticker
  startAutomationTicker();
});

