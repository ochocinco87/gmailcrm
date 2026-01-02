// Gmail CRM Background Service Worker

// Initialize default data on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Gmail CRM installed!');

    // Set up default pipelines
    const defaultPipelines = [
      {
        id: 'sales',
        name: 'Sales Pipeline',
        stages: [
          { id: 'lead', name: 'Lead' },
          { id: 'contacted', name: 'Contacted' },
          { id: 'qualified', name: 'Qualified' },
          { id: 'proposal', name: 'Proposal' },
          { id: 'negotiation', name: 'Negotiation' },
          { id: 'closed-won', name: 'Closed Won' },
          { id: 'closed-lost', name: 'Closed Lost' }
        ]
      },
      {
        id: 'support',
        name: 'Support Pipeline',
        stages: [
          { id: 'new', name: 'New' },
          { id: 'in-progress', name: 'In Progress' },
          { id: 'waiting', name: 'Waiting on Customer' },
          { id: 'resolved', name: 'Resolved' }
        ]
      },
      {
        id: 'hiring',
        name: 'Hiring Pipeline',
        stages: [
          { id: 'applied', name: 'Applied' },
          { id: 'phone-screen', name: 'Phone Screen' },
          { id: 'interview', name: 'Interview' },
          { id: 'offer', name: 'Offer' },
          { id: 'hired', name: 'Hired' },
          { id: 'rejected', name: 'Rejected' }
        ]
      }
    ];

    chrome.storage.local.set({
      pipelines: defaultPipelines,
      deals: {},
      settings: {
        autoTrackEmails: true,
        showSidebar: true
      }
    }, () => {
      console.log('Default data initialized');
    });
  }

  if (details.reason === 'update') {
    console.log('Gmail CRM updated!');
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDeal') {
    chrome.storage.local.get(['deals'], (result) => {
      const deal = result.deals?.[request.threadId];
      sendResponse({ deal });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'saveDeal') {
    chrome.storage.local.get(['deals'], (result) => {
      const deals = result.deals || {};
      deals[request.deal.threadId] = request.deal;

      chrome.storage.local.set({ deals }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'deleteDeal') {
    chrome.storage.local.get(['deals'], (result) => {
      const deals = result.deals || {};
      delete deals[request.threadId];

      chrome.storage.local.set({ deals }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'getPipelines') {
    chrome.storage.local.get(['pipelines'], (result) => {
      sendResponse({ pipelines: result.pipelines || [] });
    });
    return true;
  }

  if (request.action === 'getSettings') {
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse({ settings: result.settings || {} });
    });
    return true;
  }
});

// Listen for storage changes to sync across tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('Storage changed:', changes);

    // Notify all Gmail tabs about the change
    chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'storageChanged',
          changes
        }).catch(() => {
          // Tab might not have content script loaded yet
        });
      });
    });
  }
});

// Badge updates based on deals count
async function updateBadge() {
  chrome.storage.local.get(['deals'], (result) => {
    const dealsCount = Object.keys(result.deals || {}).length;

    if (dealsCount > 0) {
      chrome.action.setBadgeText({ text: dealsCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

// Update badge on storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.deals) {
    updateBadge();
  }
});

// Update badge on startup
updateBadge();

// Context menu for quick actions (right-click in Gmail)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToPipeline',
    title: 'Add to CRM Pipeline',
    contexts: ['page'],
    documentUrlPatterns: ['https://mail.google.com/*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToPipeline') {
    // Send message to content script to add current email to pipeline
    chrome.tabs.sendMessage(tab.id, {
      action: 'quickAddToPipeline'
    });
  }
});

console.log('Gmail CRM background service worker loaded');
