// HOA Guard - Premium Interactive Prototype Controller

// State Management
let currentTier = 'basic'; // Start as basic to allow Stripe checkout flow testing
let scannerMode = 'violation'; // 'clean' or 'violation'
let scanCount = 0;
let chatQuestionCount = 0;

// Stripe & AI API Gateway State
const PAYMENT_GATEWAY_URL = 'http://localhost:3000';
let stripeInstance = null;
let stripeCardElement = null;
let isRealStripeEnabled = false;
let isRealOpenAIEnabled = false;
let selectedScanImageBase64 = null;

// Elements Cache
const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');
const paywallModal = document.getElementById('paywallModal');
const tierStatusCard = document.getElementById('tierStatusCard');
const currentTierText = document.getElementById('currentTierText');
const tierBadge = document.getElementById('tierBadge');
const tierBadgeSettings = document.getElementById('tierBadgeSettings');
const btnSettingsChangePlan = document.getElementById('btnSettingsChangePlan');
const btnPaywallClose = document.getElementById('btnPaywallClose');
const btnStripeCheckout = document.getElementById('btnStripeCheckout');
const btnApplePay = document.getElementById('btnApplePay');

// Card Info Inputs for Validation
const cardNameInput = document.getElementById('cardName');
const cardNumberInput = document.getElementById('cardNumber');
const cardExpiryInput = document.getElementById('cardExpiry');
const cardCVCInput = document.getElementById('cardCVC');
const cardZipInput = document.getElementById('cardZip');

// Camera Scanner Elements (Realistic Image-Swapping)
const cameraImage = document.getElementById('cameraImage');
const scanLaser = document.getElementById('scanLaser');
const scanResultModal = document.getElementById('scanResultModal');
const resultsViolationList = document.getElementById('resultsViolationList');
const resultMainTitle = document.getElementById('resultMainTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const resultStatusIconCircle = document.getElementById('resultStatusIconCircle');
const btnTriggerCameraScan = document.getElementById('btnTriggerCameraScan');
const btnResetScanner = document.getElementById('btnResetScanner');
const btnFixResolveAppeal = document.getElementById('btnFixResolveAppeal');
const btnMockCleanScan = document.getElementById('btnMockCleanScan');
const btnMockViolationScan = document.getElementById('btnMockViolationScan');

// Hotspots
const hotspots = {
  grass: document.getElementById('hotspot-grass'),
  trash: document.getElementById('hotspot-trash'),
  paint: document.getElementById('hotspot-paint')
};

// Legal Shield Elements
const legalUploadArea = document.getElementById('legalUploadArea');
const legalOrDivider = document.getElementById('legalOrDivider');
const btnLoadMockLetter = document.getElementById('btnLoadMockLetter');
const legalProcessingState = document.getElementById('legalProcessingState');
const processingDetail = document.getElementById('processingDetail');
const legalLetterPreview = document.getElementById('legalLetterPreview');
const appealLetterText = document.getElementById('appealLetterText');
const btnDownloadPDF = document.getElementById('btnDownloadPDF');
const btnResetAppeal = document.getElementById('btnResetAppeal');

// CC&R Decoder Elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');
const btnVoiceInput = document.getElementById('btnVoiceInput');
const chatTypingIndicator = document.getElementById('chatTypingIndicator');

// Watch / Community Elements
const btnBroadcastInspector = document.getElementById('btnBroadcastInspector');
const watchAlertsList = document.getElementById('watchAlertsList');

// History Timeline Elements
const historyTimelineList = document.getElementById('historyTimelineList');
const historyEmptyState = document.getElementById('historyEmptyState');
const btnClearHistory = document.getElementById('btnClearHistory');

// Initialize Dynamic Clock
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  hours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  const timeElem = document.getElementById('statusBarTime');
  if (timeElem) timeElem.textContent = `${hours}:${minutes}`;
}
setInterval(updateClock, 1000);
updateClock();

// ==============================================================
// ACTIVITY LOGGING SYSTEM (LocalStorage Backend)
// ==============================================================
function getHistory() {
  try {
    const raw = localStorage.getItem('hoa_guard_history');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(historyList) {
  try {
    localStorage.setItem('hoa_guard_history', JSON.stringify(historyList));
  } catch (e) {
    console.error("Failed to save history:", e);
  }
}

function logActivity(type, title, description) {
  const historyList = getHistory();
  const newLog = {
    id: Date.now(),
    type: type, // 'scan-ok', 'scan-warn', 'appeal', 'chat', 'alert', 'billing'
    title: title,
    description: description,
    timestamp: new Date().toISOString()
  };
  
  // Add to start, cap at 50 logs
  historyList.unshift(newLog);
  if (historyList.length > 50) historyList.pop();
  
  saveHistory(historyList);
  renderHistory();
}

function formatRelativeTime(isoString) {
  const past = new Date(isoString);
  const now = new Date();
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 15) return "Just Now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderHistory() {
  if (!historyTimelineList) return;
  
  const historyList = getHistory();
  
  // Clear list except empty state
  const items = historyTimelineList.querySelectorAll('.history-item');
  items.forEach(el => el.remove());
  
  if (historyList.length === 0) {
    if (historyEmptyState) historyEmptyState.style.display = 'block';
    return;
  }
  
  if (historyEmptyState) historyEmptyState.style.display = 'none';
  
  historyList.forEach(log => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    // Choose status class and icon
    let colorClass = 'blue';
    let iconSvg = '';
    
    if (log.type === 'scan-ok') {
      colorClass = 'green';
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
    } else if (log.type === 'scan-warn') {
      colorClass = 'yellow';
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    } else if (log.type === 'appeal') {
      colorClass = 'blue';
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>`;
    } else if (log.type === 'chat') {
      colorClass = 'blue';
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`;
    } else if (log.type === 'alert') {
      colorClass = 'red';
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    } else if (log.type === 'billing') {
      colorClass = 'green';
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>`;
    }
    
    item.innerHTML = `
      <div class="history-icon-circle ${colorClass}">
        ${iconSvg}
      </div>
      <div class="history-item-details">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <h4 style="font-size: 13.5px; font-weight: 700;">${log.title}</h4>
          <span class="history-timestamp">${formatRelativeTime(log.timestamp)}</span>
        </div>
        <p style="font-size: 11.5px; margin-top: 2px; color: var(--text-secondary); line-height: 1.4;">${log.description}</p>
      </div>
    `;
    historyTimelineList.appendChild(item);
  });
}

// Clear History Handler
if (btnClearHistory) {
  btnClearHistory.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear your local activity history? This action is permanent.")) {
      localStorage.removeItem('hoa_guard_history');
      renderHistory();
    }
  });
}

// ==============================================================
// TAB NAVIGATION ROUTING SYSTEM (6 tabs + settings)
// ==============================================================
function switchTab(targetTabId) {
  // Check Freemium gate for Legal Shield Appeals
  if (currentTier === 'basic' && targetTabId === 'legal') {
    openPaywall('Appeal Letter disputes require Protection Plus. Upgrade now to generate formal rebuttals.');
    return;
  }

  // Deactivate all screens
  screens.forEach(screen => screen.classList.remove('active'));
  
  // Find correct screen to activate
  const targetScreen = document.getElementById(`screen-${targetTabId}`);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  // Highlight corresponding navbar item
  navItems.forEach(item => {
    item.classList.remove('active');
    const label = item.querySelector('span').textContent.toLowerCase();
    
    if (targetTabId === 'home' && label === 'home') item.classList.add('active');
    if (targetTabId === 'scanner' && label === 'scanner') item.classList.add('active');
    if (targetTabId === 'legal' && label === 'appeals') item.classList.add('active');
    if (targetTabId === 'ccr' && label === 'decoder') item.classList.add('active');
    if (targetTabId === 'history' && label === 'history') item.classList.add('active');
    if (targetTabId === 'pro' && label === 'pros') item.classList.add('active');
  });

  // Action hook on navigation
  if (targetTabId === 'history') {
    renderHistory();
  }
}

// Bind switchTab and helpers to window so inline onclicks function correctly
window.switchTab = switchTab;
window.sendQuickQuestion = sendQuickQuestion;
window.selectPayOption = selectPayOption;

// ==============================================================
// DOCK STATUS CHECKLISTS & INSPECTOR SIGHTINGS
// ==============================================================
const initialWatchAlerts = [
  {
    type: 'red',
    title: 'HOA Inspector spotted in Sector 3 (Shady Oaks)',
    meta: 'Reported 12m ago by user #8902'
  },
  {
    type: 'green',
    title: 'Mow Crew dispatched at 1410 Shady Oaks Ln',
    meta: 'Resolved 3h ago by GreenLeaf contractor'
  }
];

function setupWatchEvents() {
  if (btnBroadcastInspector) {
    btnBroadcastInspector.addEventListener('click', triggerInspectorAlert);
  }
  
  // Populating initial Sentinal Board list
  if (watchAlertsList) {
    watchAlertsList.innerHTML = '';
    initialWatchAlerts.forEach(alertData => {
      const alertItem = document.createElement('div');
      alertItem.className = 'feed-item';
      alertItem.innerHTML = `
        <div class="feed-dot ${alertData.type}"></div>
        <div style="flex: 1;">
          <p style="font-size: 13px; font-weight: 700; color: ${alertData.type === 'red' ? 'var(--status-red)' : 'var(--status-green)'};">${alertData.title}</p>
          <p style="font-size: 11px; color: var(--text-muted);">${alertData.meta}</p>
        </div>
      `;
      watchAlertsList.appendChild(alertItem);
    });
  }
  
  // Dashboard warning click triggers navigation to Settings (where Sentry alert board is)
  const btnInspectorAlert = document.getElementById('btnInspectorAlert');
  if (btnInspectorAlert) {
    btnInspectorAlert.addEventListener('click', () => {
      switchTab('settings');
    });
  }
}

function triggerInspectorAlert() {
  const confirmReport = confirm("Confirm broadcast: Send real-time anonymous HOA inspector sighting alert to 148 neighbors in Shady Oaks?");
  if (!confirmReport) return;

  btnBroadcastInspector.disabled = true;
  btnBroadcastInspector.innerHTML = `<span class="spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:8px;"></span>Broadcasting alert...`;

  setTimeout(() => {
    btnBroadcastInspector.disabled = false;
    btnBroadcastInspector.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      Report Inspector Active
    `;

    // Prepend to watch feed list
    if (watchAlertsList) {
      const alertItem = document.createElement('div');
      alertItem.className = 'feed-item';
      alertItem.innerHTML = `
        <div class="feed-dot red"></div>
        <div style="flex: 1;">
          <p style="font-size: 13px; font-weight: 700; color: var(--status-red);">HOA Inspector active near 1422 Shady Oaks Ln</p>
          <p style="font-size: 11px; color: var(--text-muted);">Reported Just Now by Eleanor Vance (You)</p>
        </div>
      `;
      watchAlertsList.insertBefore(alertItem, watchAlertsList.firstChild);
    }

    logActivity('alert', 'Inspector Active Broadcasted', 'You broadcasted a live inspector sighting to 148 nearby homes.');
    alert("Alert successfully broadcasted! Neighbors notified via local sentry feed.");
  }, 1200);
}

// Checklist Item Toggling
window.toggleCheckItem = function(element) {
  element.classList.toggle('done');
  const taskText = element.querySelector('p').textContent;
  const isDone = element.classList.contains('done');
  logActivity('chat', isDone ? 'Task Completed' : 'Task Reopened', `Reminder task: "${taskText}" marked ${isDone ? 'completed' : 'incomplete'}.`);
};


// ==============================================================
// ACTIVE SCANNER SYSTEM (Realistic Image-Swapping)
// ==============================================================
function setupScannerEvents() {
  if (btnMockCleanScan) {
    btnMockCleanScan.addEventListener('click', () => {
      scannerMode = 'clean';
      selectedScanImageBase64 = null;
      if (cameraImage) cameraImage.src = 'hoa_yard_clean.png';
      resetScannerState();
      
      btnMockCleanScan.style.borderColor = 'var(--status-green)';
      btnMockCleanScan.style.background = 'rgba(0, 245, 160, 0.05)';
      btnMockViolationScan.style.borderColor = 'var(--border-color)';
      btnMockViolationScan.style.background = 'rgba(255, 255, 255, 0.04)';
    });
  }

  if (btnMockViolationScan) {
    btnMockViolationScan.addEventListener('click', () => {
      scannerMode = 'violation';
      selectedScanImageBase64 = null;
      if (cameraImage) cameraImage.src = 'hoa_yard_violation.png';
      resetScannerState();
      
      btnMockViolationScan.style.borderColor = 'var(--status-yellow)';
      btnMockViolationScan.style.background = 'rgba(255, 159, 67, 0.05)';
      btnMockCleanScan.style.borderColor = 'var(--border-color)';
      btnMockCleanScan.style.background = 'rgba(255, 255, 255, 0.04)';
    });
  }

  const btnUploadYardPhoto = document.getElementById('btnUploadYardPhoto');
  const scannerCameraInput = document.getElementById('scannerCameraInput');

  if (btnUploadYardPhoto && scannerCameraInput) {
    btnUploadYardPhoto.addEventListener('click', () => {
      scannerCameraInput.click();
    });

    scannerCameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        selectedScanImageBase64 = evt.target.result;
        if (cameraImage) cameraImage.src = selectedScanImageBase64;
        resetScannerState();

        // Clear active borders on mock buttons
        if (btnMockCleanScan) {
          btnMockCleanScan.style.borderColor = 'var(--border-color)';
          btnMockCleanScan.style.background = 'rgba(255, 255, 255, 0.04)';
        }
        if (btnMockViolationScan) {
          btnMockViolationScan.style.borderColor = 'var(--border-color)';
          btnMockViolationScan.style.background = 'rgba(255, 255, 255, 0.04)';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnTriggerCameraScan) {
    btnTriggerCameraScan.addEventListener('click', triggerScanExecution);
  }

  if (btnResetScanner) {
    btnResetScanner.addEventListener('click', resetScannerState);
  }

  if (btnFixResolveAppeal) {
    btnFixResolveAppeal.addEventListener('click', () => {
      resetScannerState();
      switchTab('legal');
      // If upgraded, start appeal generation automatically
      if (currentTier === 'premium') {
        // Trigger file input click to let them upload fine letter, or run simulation
        const fileNoticeInput = document.getElementById('fileNoticeInput');
        if (fileNoticeInput) {
          fileNoticeInput.click();
        } else {
          simulateMockFineLoad();
        }
      }
    });
  }
}

async function triggerScanExecution() {
  // Check Freemium restriction
  if (currentTier === 'basic' && scanCount >= 1) {
    openPaywall('Standard Free tier permits only 1 yard scan per month. Upgrade to Protection Plus for infinite AI facade audits.');
    return;
  }

  // Visual scan state
  btnTriggerCameraScan.disabled = true;
  btnTriggerCameraScan.innerHTML = `<span class="spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:8px;"></span>AI Inspecting Yard...`;
  
  if (scanLaser) scanLaser.style.display = 'block';

  // Apply visual scanning overlay/blur filter to the live image
  if (cameraImage) {
    cameraImage.style.filter = 'brightness(1.1) saturate(1.2) contrast(1.1)';
  }

  try {
    if (selectedScanImageBase64 && isRealOpenAIEnabled) {
      // 1. Live OpenAI Vision API Scanner Flow
      const response = await fetch(`${PAYMENT_GATEWAY_URL}/analyze-property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: selectedScanImageBase64 })
      });

      if (!response.ok) throw new Error("Backend scanner API failed");
      
      const realData = await response.json();
      
      setTimeout(() => {
        finishScanUI();
        showScanResults(realData);
      }, 2200);

    } else if (selectedScanImageBase64) {
      // 2. Custom Photo Scanner Fallback
      const simulatedCustomData = {
        status: 'warning',
        summary: 'Action Needed: 1 Flag',
        issues: [
          {
            zone: 'lawn',
            title: 'Potential Turf Violation',
            description: 'AI analyzed your uploaded image and flagged minor compliance concern regarding weed growth or lawn height (Section 3.1).',
            action: 'Inspect Lawn',
            severity: 'yellow'
          }
        ]
      };
      setTimeout(() => {
        finishScanUI();
        showScanResults(simulatedCustomData);
      }, 2200);
    } else {
      // 3. Preloaded Mock View Scan
      setTimeout(() => {
        finishScanUI();
        showScanResults(null);
      }, 2200);
    }
  } catch (err) {
    console.error("Scanner error:", err);
    setTimeout(() => {
      finishScanUI();
      alert("AI inspection failed due to network. Defaulting to mock assessment.");
      showScanResults(null);
    }, 2200);
  }
}

function finishScanUI() {
  if (scanLaser) scanLaser.style.display = 'none';
  btnTriggerCameraScan.disabled = false;
  btnTriggerCameraScan.innerHTML = `
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
    </svg>
    Analyze Front Facade
  `;
  if (cameraImage) cameraImage.style.filter = 'none';
  scanCount++;
}

function showScanResults(realData = null) {
  if (scanResultModal) scanResultModal.classList.add('active');

  if (realData) {
    // Render dynamic results from API or Custom Simulated photo
    resultMainTitle.textContent = realData.summary;
    resultSubtitle.textContent = realData.status === 'clean' ? 'No violations were detected in your uploaded yard view.' : 'Guidelines require corrections to prevent a fine.';
    
    if (resultStatusIconCircle) {
      if (realData.status === 'clean') {
        resultStatusIconCircle.className = "result-icon-circle green";
        resultStatusIconCircle.innerHTML = `<svg width="24" height="24" fill="none" stroke="var(--status-green)" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      } else {
        resultStatusIconCircle.className = "result-icon-circle yellow";
        resultStatusIconCircle.innerHTML = `<svg width="24" height="24" fill="none" stroke="var(--status-yellow)" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
      }
    }

    if (resultsViolationList) {
      if (realData.issues && realData.issues.length > 0) {
        resultsViolationList.innerHTML = `
          <p style="font-weight: 700; font-size: 11px; color: var(--status-yellow); margin-bottom: 6px;">AI DETECTED ISSUES:</p>
        `;
        realData.issues.forEach(issue => {
          resultsViolationList.innerHTML += `
            <div class="issue-item" style="margin-top:6px;">
              <div class="issue-text">
                <span style="font-size: 12.5px; font-weight: 700;">${issue.title}</span>
                <span style="font-size: 10.5px; color: var(--text-secondary);">${issue.description}</span>
              </div>
              <span class="issue-badge" style="background: rgba(255, 159, 67, 0.15); color: var(--status-yellow); font-size: 9px;">${issue.action}</span>
            </div>
          `;
        });
        resultsViolationList.style.display = 'block';
      } else {
        resultsViolationList.style.display = 'none';
      }
    }

    // Enable/Disable appeal creation shortcut
    if (btnFixResolveAppeal) {
      btnFixResolveAppeal.style.display = (realData.status !== 'clean') ? 'block' : 'none';
    }

    // Hide hotspots for custom images since coordinates won't align
    if (hotspots.grass) hotspots.grass.classList.remove('active');
    if (hotspots.trash) hotspots.trash.classList.remove('active');
    if (hotspots.paint) hotspots.paint.classList.remove('active');

    logActivity(
      realData.status === 'clean' ? 'scan-ok' : 'scan-warn',
      `Facade Scan: ${realData.status === 'clean' ? 'Compliant' : 'Flags Found'}`,
      `AI audit completed on custom image. ${realData.summary}`
    );
    return;
  }

  if (scannerMode === 'clean') {
    // Show green OK
    resultMainTitle.textContent = "Yard Status: Compliant";
    resultSubtitle.textContent = "No CC&R guideline violations were detected in your yard.";
    if (resultStatusIconCircle) {
      resultStatusIconCircle.className = "result-icon-circle green";
      resultStatusIconCircle.innerHTML = `<svg width="24" height="24" fill="none" stroke="var(--status-green)" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
    }
    
    if (resultsViolationList) resultsViolationList.style.display = 'none';
    if (btnFixResolveAppeal) btnFixResolveAppeal.style.display = 'none';

    // Show OK hotspots
    if (hotspots.grass) {
      hotspots.grass.className = "scanner-target green active";
      hotspots.grass.querySelector('.target-label').innerHTML = `<span class="target-dot" style="background:var(--status-green);"></span>Lawn Height: 3.1" (OK)`;
    }
    
    if (hotspots.paint) {
      hotspots.paint.className = "scanner-target green active";
      hotspots.paint.querySelector('.target-label').innerHTML = `<span class="target-dot" style="background:var(--status-green);"></span>Exterior Trim Paint: OK`;
    }
    
    if (hotspots.trash) {
      hotspots.trash.classList.remove('active');
    }

    // Update main dashboard status indicators
    const paintCircle = document.getElementById('dashboardStatusPaint');
    const paintText = document.getElementById('dashboardStatusPaintText');
    if (paintCircle) paintCircle.className = "status-circle green";
    if (paintText) paintText.textContent = "Paint Status";

    logActivity('scan-ok', 'Facade Scan: Compliant', 'AI yard inspection completed. 0 compliance issues found.');
  } else {
    // Show yellow WARNING
    resultMainTitle.textContent = "Action Needed: 2 Flags";
    resultSubtitle.textContent = "HOA guidelines require corrections to prevent a fine citation.";
    if (resultStatusIconCircle) {
      resultStatusIconCircle.className = "result-icon-circle yellow";
      resultStatusIconCircle.innerHTML = `<svg width="24" height="24" fill="none" stroke="var(--status-yellow)" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    }
    
    if (resultsViolationList) {
      resultsViolationList.innerHTML = `
        <p style="font-weight: 700; font-size: 11px; color: var(--status-yellow); margin-bottom: 6px;">GUIDELINE FLAGS:</p>
        <div class="issue-item">
          <div class="issue-text">
            <span style="font-size: 12.5px; font-weight: 700;">Trash Bin Visible (Rule 4.2)</span>
            <span style="font-size: 10.5px; color: var(--text-secondary);">Recycle bin visible from curb outside collection window.</span>
          </div>
          <span class="issue-badge" style="background: rgba(255, 82, 82, 0.15); color: var(--status-red); font-size: 9px;">Store Bin</span>
        </div>
        <div class="issue-item" style="margin-top:8px;">
          <div class="issue-text">
            <span style="font-size: 12.5px; font-weight: 700;">Overgrown Grass height 6.2"</span>
            <span style="font-size: 10.5px; color: var(--text-secondary);">Section 3.1 limit: 4.0 inches maximum height.</span>
          </div>
          <span class="issue-badge" style="background: rgba(255, 159, 67, 0.15); color: var(--status-yellow); font-size: 9px;">Mow Yard</span>
        </div>
      `;
      resultsViolationList.style.display = 'block';
    }
    
    // Enable Appeal creation shortcut
    if (btnFixResolveAppeal) btnFixResolveAppeal.style.display = 'block';

    // Show violation hotspots
    if (hotspots.grass) {
      hotspots.grass.className = "scanner-target yellow active";
      hotspots.grass.querySelector('.target-label').innerHTML = `<span class="target-dot" style="background:var(--status-yellow);"></span>Lawn Height: 6.2" (Violation)`;
    }

    if (hotspots.trash) {
      hotspots.trash.className = "scanner-target red active";
      hotspots.trash.querySelector('.target-label').innerHTML = `<span class="target-dot" style="background:var(--status-red);"></span>Trash Bin: Left in View`;
    }

    if (hotspots.paint) {
      hotspots.paint.className = "scanner-target green active";
      hotspots.paint.querySelector('.target-label').innerHTML = `<span class="target-dot" style="background:var(--status-green);"></span>Paint: 95% Compliant`;
    }

    // Update main dashboard status indicators
    const paintCircle = document.getElementById('dashboardStatusPaint');
    const paintText = document.getElementById('dashboardStatusPaintText');
    if (paintCircle) paintCircle.className = "status-circle green";
    if (paintText) paintText.textContent = "Paint Status";

    logActivity('scan-warn', 'Facade Scan: Flags Found', 'AI audit flagged overgrown grass (6.2") and visible trash bin.');
  }
}

function resetScannerState() {
  if (scanResultModal) scanResultModal.classList.remove('active');
  
  // Hide hotspots
  if (hotspots.grass) hotspots.grass.classList.remove('active');
  if (hotspots.trash) hotspots.trash.classList.remove('active');
  if (hotspots.paint) hotspots.paint.classList.remove('active');
}


// ==============================================================
// LEGAL SHIELD SYSTEM (APPEAL GENERATION)
// ==============================================================
function setupLegalEvents() {
  const fileNoticeInput = document.getElementById('fileNoticeInput');
  if (legalUploadArea && fileNoticeInput) {
    legalUploadArea.addEventListener('click', () => {
      if (currentTier === 'basic') {
        openPaywall('Formal appeal writing is a Premium feature. Upgrade to Protection Plus.');
        return;
      }
      fileNoticeInput.click();
    });

    fileNoticeInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        processNoticeUpload(evt.target.result, file.name);
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnLoadMockLetter) {
    btnLoadMockLetter.addEventListener('click', () => {
      if (currentTier === 'basic') {
        openPaywall('Formal appeal writing is a Premium feature. Upgrade to Protection Plus.');
        return;
      }
      simulateMockFineLoad();
    });
  }
  if (btnDownloadPDF) btnDownloadPDF.addEventListener('click', handleLetterDownload);
  if (btnResetAppeal) btnResetAppeal.addEventListener('click', resetAppealUI);
}

async function processNoticeUpload(base64Data, filename) {
  // Clear initial upload view
  if (legalUploadArea) legalUploadArea.style.display = 'none';
  if (legalOrDivider) legalOrDivider.style.display = 'none';
  if (btnLoadMockLetter) btnLoadMockLetter.style.display = 'none';

  // Show processing sequence
  if (legalProcessingState) legalProcessingState.style.display = 'flex';
  if (processingDetail) processingDetail.textContent = "AI parsing uploaded warning letter...";

  try {
    if (isRealOpenAIEnabled) {
      // Send image to backend
      const response = await fetch(`${PAYMENT_GATEWAY_URL}/generate-appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });

      if (!response.ok) throw new Error("Backend appeal letter API failed");
      const data = await response.json();
      
      if (data.letterHtml) {
        setTimeout(() => {
          if (legalProcessingState) legalProcessingState.style.display = 'none';
          if (legalLetterPreview) legalLetterPreview.style.display = 'block';
          if (appealLetterText) appealLetterText.innerHTML = data.letterHtml;
          logActivity('appeal', 'Appeal Document Drafted', `AI analyzed and generated rebuttal letter for: "${filename}"`);
        }, 1500);
        return;
      }
    }
  } catch (err) {
    console.error("Notice parsing error:", err);
  }

  // Fallback to simulated letters if offline/mock
  runSimulatedNoticeAnalysis(filename);
}

function runSimulatedNoticeAnalysis(filename) {
  const steps = [
    "Running OCR engine to scan " + filename + "...",
    "Locating citation clause references...",
    "Consulting Texas Property Code § 209.006 notification periods...",
    "Formulating professional Legal Dispute response...",
    "Finalizing appeal letter..."
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      if (processingDetail) processingDetail.textContent = steps[currentStep];
      currentStep++;
    } else {
      clearInterval(interval);
      showGeneratedAppealLetter();
    }
  }, 600);
}

function simulateMockFineLoad() {
  if (currentTier === 'basic') {
    openPaywall('Formal appeal writing is a Premium feature. Upgrade to Protection Plus.');
    return;
  }

  // Clear initial upload view
  if (legalUploadArea) legalUploadArea.style.display = 'none';
  if (legalOrDivider) legalOrDivider.style.display = 'none';
  if (btnLoadMockLetter) btnLoadMockLetter.style.display = 'none';

  // Show processing sequence
  if (legalProcessingState) legalProcessingState.style.display = 'flex';
  
  const steps = [
    "Running OCR engine to scan document...",
    "Locating citation clause references...",
    "Consulting Texas Property Code § 209.006 notification periods...",
    "Citing HOA bylaws Section 4.2 (Recycle storage timeline)...",
    "Generating formal Legal Rebuttal Letter..."
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      if (processingDetail) processingDetail.textContent = steps[currentStep];
      currentStep++;
    } else {
      clearInterval(interval);
      showGeneratedAppealLetter();
    }
  }, 600);
}

function showGeneratedAppealLetter() {
  if (legalProcessingState) legalProcessingState.style.display = 'none';
  if (legalLetterPreview) legalLetterPreview.style.display = 'block';

  // Format dynamic dates
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (appealLetterText) {
    appealLetterText.innerHTML = `
      <p><strong>Date:</strong> ${today}</p>
      <p><strong>To:</strong> Shady Oaks HOA Board & ACC Committee</p>
      <p><strong>From:</strong> Eleanor Vance, Homeowner</p>
      <p><strong>Subject:</strong> Formal Dispute & Appeal - Fine Reference #SO-782910-V</p>
      <p><strong>Property Address:</strong> 1422 Shady Oaks Ln, Austin, TX 78745</p>
      <br/>
      <p>Dear Members of the Board,</p>
      <p>This letter constitutes my formal appeal regarding the compliance fine of <strong>$150.00</strong> issued on May 15, 2026, alleging a violation of CC&R Section 4.2 (Visible Trash Receptacles).</p>
      <p>I request that the board dismiss this fine based on the following grounds:</p>
      <p><strong>1. Violation of Texas Property Code Section 209.006 (Right to Cure):</strong><br/>
      Under Texas state statute, a property owners' association must give a homeowner written notice of the violation containing a detailed description and a reasonable period of <strong>at least 30 days</strong> to cure the violation before any fine may be charged or assessed. The citation received on May 15 assessed the fine immediately, without providing the statutory opportunity to remedy the issue, making the fine legally unenforceable.</p>
      <p><strong>2. Reasonable Accessary Action:</strong><br/>
      The recycle bin was temporarily positioned near the curb strictly during the permitted collection window and active driveway cleaning. The receptacle was promptly returned to its concealed position within a reasonable timeframe.</p>
      <p>Pursuant to Tex. Prop. Code § 209.007, I hereby request a formal hearing before the board of directors. Please pause all fine accrual and collection activities until this hearing is completed.</p>
      <br/>
      <p>Sincerely,</p>
      <p style="font-family:'Outfit'; font-weight:700; color:#1a1a1a;">Eleanor Vance</p>
    `;
  }
  
  logActivity('appeal', 'Appeal Document Drafted', 'AI generated a legal rebuttal letter citing Texas Prop Code § 209.006 for Fine #SO-782910-V.');
}

function handleLetterDownload() {
  if (!btnDownloadPDF) return;
  btnDownloadPDF.disabled = true;
  btnDownloadPDF.innerHTML = `<span class="spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:8px;"></span>Downloading PDF...`;

  setTimeout(() => {
    btnDownloadPDF.disabled = false;
    btnDownloadPDF.innerHTML = `
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
      </svg>
      Download Rebuttal PDF
    `;
    logActivity('appeal', 'Appeal PDF Saved', 'Downloaded signed appeal letter PDF to local filesystem.');
    alert("Appeal_Letter_Shady_Oaks_HOA.pdf generated successfully and saved to downloads folder!");
  }, 1500);
}

function resetAppealUI() {
  if (legalLetterPreview) legalLetterPreview.style.display = 'none';
  if (legalUploadArea) legalUploadArea.style.display = 'flex';
  if (legalOrDivider) legalOrDivider.style.display = 'flex';
  if (btnLoadMockLetter) btnLoadMockLetter.style.display = 'flex';
}


// ==============================================================
// CC&R BYLAWS DECODER CHATBOT
// ==============================================================
const chatReplies = {
  "green": "According to Shady Oaks CC&R Article VI, Section 3.2: Any exterior paint color change must receive approval from the ACC (Architectural Control Committee). Green front doors are permitted ONLY if you use <strong>'Earthtone Sage' (Color Code #ACC-39)</strong>. To submit an ACC Form 204 request, go to your documents portal. Do not paint prior to approval.",
  "trash": "Rule 4.2 of the HOA bylaws specifies that trash and recycle bins may be placed at the curb for pickup no earlier than <strong>6:00 PM Tuesday evening</strong>, and must be returned to an enclosed location (e.g. your garage or behind a wooden fence screen) no later than <strong>8:00 PM Wednesday evening</strong>. Violation carries a $25 fine per day.",
  "rv": "Bylaw Section 5.1 strictly prohibits parking recreational vehicles, campers, utility trailers, or boats on driveways or neighborhood streets for more than <strong>48 continuous hours</strong>. Any RV parked past 48 hours is subject to immediate towing at owner's expense plus a $100 fine.",
  "chickens": "Article VII, Section 2.1 permits only standard domesticated household pets (limited to dogs, cats, and indoor caged birds). Raising poultry, chickens, ducks, or any livestock is <strong>strictly prohibited</strong> in Shady Oaks. Chicken coops are not allowed."
};

function setupChatEvents() {
  if (btnSendChat) {
    btnSendChat.addEventListener('click', handleChatSubmit);
  }
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleChatSubmit();
    });
  }
  if (btnVoiceInput) {
    btnVoiceInput.addEventListener('click', simulateVoiceQuery);
  }
}

function sendQuickQuestion(questionText) {
  if (chatInput) {
    chatInput.value = questionText;
    handleChatSubmit();
  }
}

function handleChatSubmit() {
  if (!chatInput) return;
  const query = chatInput.value.trim();
  if (!query) return;

  // Render User Message
  appendChatMessage(query, 'user');
  chatInput.value = '';

  // Limit basic queries for demo
  if (currentTier === 'basic' && chatQuestionCount >= 2) {
    setTimeout(() => {
      showBotTyping(true);
      setTimeout(() => {
        showBotTyping(false);
        appendChatMessage("You have reached your free question limit for the CC&R Rule Decoder. Upgrade to Protection Plus for unlimited rule answers.", 'bot');
        openPaywall();
      }, 1000);
    }, 500);
    return;
  }

  chatQuestionCount++;

  // Process response
  let matchedReply = "This topic falls under general property alterations (Article IX). You will need to file an ACC modification request form with the board, which typically takes 7 to 14 days for approval. Please let me know if you would like me to draft the request text.";
  
  const queryLower = query.toLowerCase();
  if (queryLower.includes('green') || queryLower.includes('door') || queryLower.includes('paint')) {
    matchedReply = chatReplies.green;
  } else if (queryLower.includes('trash') || queryLower.includes('garbage') || queryLower.includes('bin') || queryLower.includes('can')) {
    matchedReply = chatReplies.trash;
  } else if (queryLower.includes('rv') || queryLower.includes('park') || queryLower.includes('driveway')) {
    matchedReply = chatReplies.rv;
  } else if (queryLower.includes('chicken') || queryLower.includes('coop') || queryLower.includes('poultry')) {
    matchedReply = chatReplies.chickens;
  }

  setTimeout(async () => {
    showBotTyping(true);
    
    try {
      if (isRealOpenAIEnabled) {
        const response = await fetch(`${PAYMENT_GATEWAY_URL}/ccr-decode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query })
        });
        if (!response.ok) throw new Error("Bylaws API failed");
        
        const data = await response.json();
        showBotTyping(false);
        appendChatMessage(data.answer, 'bot');
        logActivity('chat', 'Decoder Query Answered', `AI decoded bylaws rules for: "${query.substring(0, 30)}..."`);
        return;
      }
    } catch (err) {
      console.warn("Could not retrieve AI response. Falling back to local keyword matches:", err.message);
    }

    // Fallback to simulated keywords matching
    setTimeout(() => {
      showBotTyping(false);
      appendChatMessage(matchedReply, 'bot');
      logActivity('chat', 'Decoder Query Answered', `Resolved rules query regarding: "${query.substring(0, 30)}..."`);
    }, 900);
  }, 300);
}

function appendChatMessage(text, sender) {
  if (!chatMessages) return;
  const bubble = document.createElement('div');
  bubble.className = `msg-bubble msg-${sender}`;
  bubble.innerHTML = text;
  chatMessages.appendChild(bubble);
  
  // Auto-scroll
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showBotTyping(show) {
  if (!chatTypingIndicator) return;
  chatTypingIndicator.style.display = show ? 'block' : 'none';
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function simulateVoiceQuery() {
  if (!chatInput || !btnVoiceInput) return;
  btnVoiceInput.style.background = "rgba(255, 82, 82, 0.2)";
  chatInput.placeholder = "Listening...";
  
  // Simulate speaking
  setTimeout(() => {
    chatInput.value = "Can I keep chickens in my backyard?";
    btnVoiceInput.style.background = "rgba(255,255,255,0.06)";
    chatInput.placeholder = "Type or click question above...";
    
    setTimeout(() => {
      handleChatSubmit();
    }, 1000);
  }, 1800);
}


// ==============================================================
// PAYWALL WIZARD SYSTEM & CREDIT CARD VALIDATION
// ==============================================================
let selectedBillingCycle = 'yearly';

function openPaywall(reason = '') {
  if (paywallModal) {
    paywallModal.classList.add('active');
  }
}

function closePaywall() {
  if (paywallModal) {
    paywallModal.classList.remove('active');
  }
}

function selectPayOption(type) {
  selectedBillingCycle = type;
  const options = document.querySelectorAll('.pay-option');
  options.forEach(opt => opt.classList.remove('selected'));
  if (type === 'monthly') {
    const monthlyOpt = document.getElementById('payOptionMonthly');
    if (monthlyOpt) monthlyOpt.classList.add('selected');
  } else {
    const yearlyOpt = document.getElementById('payOptionYearly');
    if (yearlyOpt) yearlyOpt.classList.add('selected');
  }
}

// Format credit card input numbers automatically
if (cardNumberInput) {
  cardNumberInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    e.target.value = formatted.substring(0, 19);
  });
}

// Format expiration date MM/YY automatically
if (cardExpiryInput) {
  cardExpiryInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (value.length > 0) {
      formatted = value.substring(0, 2);
      if (value.length > 2) {
        formatted += '/' + value.substring(2, 4);
      }
    }
    e.target.value = formatted;
  });
}

// Restrict CVC & Zip to digits
if (cardCVCInput) {
  cardCVCInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
  });
}
if (cardZipInput) {
  cardZipInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 5);
  });
}

function validateBillingForm() {
  const cardholderName = cardNameInput ? cardNameInput.value.trim() : '';
  const cardNumber = cardNumberInput ? cardNumberInput.value.replace(/\s/g, '') : '';
  const cardExpiry = cardExpiryInput ? cardExpiryInput.value.trim() : '';
  const cardCVC = cardCVCInput ? cardCVCInput.value.trim() : '';
  const cardZip = cardZipInput ? cardZipInput.value.trim() : '';

  if (!cardholderName) {
    alert("Please enter cardholder name.");
    return false;
  }
  if (cardNumber.length < 16) {
    alert("Please enter a valid 16-digit card number.");
    return false;
  }
  if (cardExpiry.length < 5 || !cardExpiry.includes('/')) {
    alert("Please enter a valid expiry date (MM/YY).");
    return false;
  }
  const expiryParts = cardExpiry.split('/');
  const month = parseInt(expiryParts[0], 10);
  if (month < 1 || month > 12) {
    alert("Please enter a valid expiry month (01-12).");
    return false;
  }
  if (cardCVC.length < 3) {
    alert("Please enter a valid 3-digit CVC security code.");
    return false;
  }
  if (cardZip.length < 5) {
    alert("Please enter a valid 5-digit billing Zip code.");
    return false;
  }
  return true;
}

async function processCheckout(method) {
  const price = selectedBillingCycle === 'yearly' ? '$89.00' : '$9.99';
  const checkoutBtn = method === 'stripe' ? btnStripeCheckout : btnApplePay;
  const originalHtml = checkoutBtn.innerHTML;
  
  if (method === 'stripe') {
    if (isRealStripeEnabled) {
      // Live Stripe Card Payment Flow
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = `<span class="spinner" style="width:16px; height:16px; border-width:2px; margin: 0 auto; display:inline-block; border-top-color:#fff;"></span> processing...`;
      
      const amountInCents = selectedBillingCycle === 'yearly' ? 8900 : 999;
      
      try {
        // 1. Create PaymentIntent on server
        const response = await fetch(`${PAYMENT_GATEWAY_URL}/create-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountInCents,
            currency: 'usd',
            planName: `Protection Plus (${selectedBillingCycle})`
          })
        });

        if (!response.ok) {
          throw new Error("Unable to create transaction intent. Backend error.");
        }

        const data = await response.json();
        
        if (data.mock) {
          // If the server answered but ran in mock mode itself
          setTimeout(() => finalizeSimulatedUpgrade(checkoutBtn, originalHtml, price, method), 1000);
          return;
        }

        const clientSecret = data.clientSecret;
        const cardholderName = document.getElementById('cardName') ? document.getElementById('cardName').value.trim() : 'Eleanor Vance';

        // 2. Confirm card payment with Stripe
        const result = await stripeInstance.confirmCardPayment(clientSecret, {
          payment_method: {
            card: stripeCardElement,
            billing_details: {
              name: cardholderName || 'Eleanor Vance'
            }
          }
        });

        if (result.error) {
          // Show error to customer
          const errorElement = document.getElementById('stripe-card-errors');
          if (errorElement) errorElement.textContent = result.error.message;
          checkoutBtn.disabled = false;
          checkoutBtn.innerHTML = originalHtml;
        } else {
          // The payment has been processed!
          if (result.paymentIntent.status === 'succeeded') {
            finalizeStripeUpgrade(checkoutBtn, originalHtml, price, method);
          }
        }
      } catch (err) {
        alert("Payment process failed: " + err.message);
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = originalHtml;
      }
      return;
    } else {
      // Sandbox Simulator Form Validation
      if (!validateBillingForm()) return;
    }
  }

  // Apple Pay / Sandbox Checkout Simulation Flow
  checkoutBtn.disabled = true;
  checkoutBtn.innerHTML = `<span class="spinner" style="width:16px; height:16px; border-width:2px; margin: 0 auto; display:inline-block; border-top-color:#fff;"></span> processing...`;

  setTimeout(() => {
    finalizeSimulatedUpgrade(checkoutBtn, originalHtml, price, method);
  }, 1800);
}

function finalizeSimulatedUpgrade(checkoutBtn, originalHtml, price, method) {
  checkoutBtn.disabled = false;
  checkoutBtn.innerHTML = originalHtml;
  
  // Upgrade tier
  currentTier = 'premium';
  updateSubscriptionUI();
  closePaywall();
  
  logActivity('billing', 'Account Upgraded', `Subscribed to Protection Plus (${selectedBillingCycle === 'yearly' ? 'Annual Plan' : 'Monthly Plan'}) via ${method === 'stripe' ? 'Stripe (Mock)' : 'Apple Pay (Mock)'}.`);
  
  alert(`Success! Billed ${price} via ${method === 'stripe' ? 'Stripe Simulator' : 'Apple Pay Simulator'}. Welcome to Protection Plus!`);
}

function finalizeStripeUpgrade(checkoutBtn, originalHtml, price, method) {
  checkoutBtn.disabled = false;
  checkoutBtn.innerHTML = originalHtml;
  
  // Upgrade tier
  currentTier = 'premium';
  updateSubscriptionUI();
  closePaywall();
  
  logActivity('billing', 'Account Upgraded', `Subscribed to Protection Plus (${selectedBillingCycle === 'yearly' ? 'Annual Plan' : 'Monthly Plan'}) via Stripe Live API.`);
  
  alert(`Success! Securely billed ${price} via Stripe elements. Welcome to Protection Plus!`);
}

// Check backend configuration for Stripe and load Elements
async function initializeStripe() {
  try {
    const response = await fetch(`${PAYMENT_GATEWAY_URL}/config`);
    if (!response.ok) throw new Error("Backend offline");
    
    const data = await response.json();
    isRealOpenAIEnabled = !!data.openai_enabled;
    console.log("Real OpenAI backend availability:", isRealOpenAIEnabled);

    if (data.stripe_enabled && data.publishable_key && typeof Stripe !== 'undefined') {
      stripeInstance = Stripe(data.publishable_key);
      const elements = stripeInstance.elements();
      
      stripeCardElement = elements.create('card', {
        style: {
          base: {
            color: '#ffffff',
            fontFamily: '"Outfit", sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '14px',
            '::placeholder': {
              color: '#8b9bb4'
            }
          },
          invalid: {
            color: '#ff5252',
            iconColor: '#ff5252'
          }
        }
      });
      
      stripeCardElement.mount('#stripe-card-element');
      
      // Handle real-time validation errors
      stripeCardElement.on('change', (event) => {
        const displayError = document.getElementById('stripe-card-errors');
        if (event.error) {
          displayError.textContent = event.error.message;
        } else {
          displayError.textContent = '';
        }
      });

      // Show Stripe Elements container and hide mock form inputs
      const stripeElemContainer = document.getElementById('stripe-card-element-container');
      const manualFields = document.getElementById('manual-billing-fields');
      if (stripeElemContainer) stripeElemContainer.style.display = 'flex';
      if (manualFields) manualFields.style.display = 'none';
      
      isRealStripeEnabled = true;
      console.log("Stripe Elements initialized successfully. Payment mode: LIVE.");
    } else {
      console.log("Stripe configured as MOCK: Backend has Stripe disabled or Stripe.js script is missing.");
    }
  } catch (err) {
    console.warn("Could not reach payment server. Defaulting to fully simulated billing sandbox:", err.message);
  }
}

function updateSubscriptionUI() {
  if (currentTier === 'premium') {
    if (currentTierText) {
      currentTierText.textContent = "Protection Plus Active";
      currentTierText.style.color = "var(--status-green)";
    }
    if (tierBadge) {
      tierBadge.textContent = "Premium";
      tierBadge.className = "badge badge-premium";
    }
    if (tierBadgeSettings) {
      tierBadgeSettings.textContent = "Premium";
      tierBadgeSettings.className = "badge badge-premium";
    }
    const settingsTierText = document.getElementById('settingsTierText');
    if (settingsTierText) {
      settingsTierText.textContent = `Protection Plus (${selectedBillingCycle === 'yearly' ? '$89.00/yr' : '$9.99/mo'})`;
    }
  } else {
    if (currentTierText) {
      currentTierText.textContent = "Basic Free Account (Limited)";
      currentTierText.style.color = "var(--text-secondary)";
    }
    if (tierBadge) {
      tierBadge.textContent = "Free";
      tierBadge.className = "badge badge-free";
    }
    if (tierBadgeSettings) {
      tierBadgeSettings.textContent = "Free";
      tierBadgeSettings.className = "badge badge-free";
    }
    const settingsTierText = document.getElementById('settingsTierText');
    if (settingsTierText) {
      settingsTierText.textContent = "Basic (Free)";
    }
  }
}

function setupPaywallEvents() {
  if (btnPaywallClose) btnPaywallClose.addEventListener('click', closePaywall);
  if (btnStripeCheckout) btnStripeCheckout.addEventListener('click', () => processCheckout('stripe'));
  if (btnApplePay) btnApplePay.addEventListener('click', () => processCheckout('apple'));
}

// ==============================================================
// APPLICATION STARTUP INITIALIZATION
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Attach listeners to nav items manually to map correctly to 6-tab IDs
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const text = item.querySelector('span').textContent.toLowerCase();
      let tabId = 'home';
      if (text === 'home') tabId = 'home';
      if (text === 'scanner') tabId = 'scanner';
      if (text === 'appeals') tabId = 'legal';
      if (text === 'decoder') tabId = 'ccr';
      if (text === 'history') tabId = 'history';
      if (text === 'pros') tabId = 'pro';
      switchTab(tabId);
    });
  });

  // Dashboard shortcuts
  const btnStartScan = document.getElementById('btnStartScan');
  if (btnStartScan) {
    btnStartScan.addEventListener('click', () => switchTab('scanner'));
  }
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => switchTab('settings'));
  }
  if (tierStatusCard) {
    tierStatusCard.addEventListener('click', () => openPaywall('Upgrade or review your HOA Guard plan details.'));
  }
  if (btnSettingsChangePlan) {
    btnSettingsChangePlan.addEventListener('click', () => openPaywall('Change your HOA Guard Subscription Plan.'));
  }

  // Initial event setups
  setupScannerEvents();
  setupLegalEvents();
  setupChatEvents();
  setupWatchEvents();
  setupPaywallEvents();
  
  // Set default view of clean/violation buttons
  if (btnMockViolationScan) {
    btnMockViolationScan.style.borderColor = 'var(--status-yellow)';
    btnMockViolationScan.style.background = 'rgba(255, 159, 67, 0.05)';
  }

  // Initialize UI & load local history logs
  updateSubscriptionUI();
  renderHistory();
  initializeStripe();
});
