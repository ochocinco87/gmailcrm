/**
 * Node.js Server for Clinician Scheduling App
 * Serves static files and handles API endpoints for email notifications
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Data storage (in-memory for simplicity, could be replaced with file-based or database)
let dataStore = {
    clinicians: [],
    requests: [],
    locations: [],
    coverage: [],
    settings: {
        departmentName: 'Medical Department',
        managerEmail: '',
        minDaysAdvance: 14,
        maxDaysAdvance: 365,
        windowOpen: null,
        windowClose: null
    },
    blackouts: [],
    shareTokens: []
};

// Load data from file if exists
const DATA_FILE = path.join(__dirname, 'data.json');
if (fs.existsSync(DATA_FILE)) {
    try {
        dataStore = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log('Loaded data from data.json');
    } catch (e) {
        console.error('Error loading data file:', e);
    }
}

// Save data to file
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataStore, null, 2));
}

// Generate unique ID
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        handleAPI(req, res, parsedUrl);
        return;
    }

    // Static file serving
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// API Handler
function handleAPI(req, res, parsedUrl) {
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Parse JSON body for POST/PUT requests
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        let data = null;
        if (body) {
            try {
                data = JSON.parse(body);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
        }

        // Route handling
        try {
            if (pathname === '/api/clinicians') {
                handleClinicians(method, data, res);
            } else if (pathname.startsWith('/api/clinicians/')) {
                const id = pathname.split('/')[3];
                handleClinicianById(method, id, data, res);
            } else if (pathname === '/api/requests') {
                handleRequests(method, data, res);
            } else if (pathname.startsWith('/api/requests/')) {
                const id = pathname.split('/')[3];
                handleRequestById(method, id, data, res);
            } else if (pathname === '/api/locations') {
                handleLocations(method, data, res);
            } else if (pathname.startsWith('/api/locations/')) {
                const id = pathname.split('/')[3];
                handleLocationById(method, id, data, res);
            } else if (pathname === '/api/coverage') {
                handleCoverage(method, data, res);
            } else if (pathname.startsWith('/api/coverage/')) {
                const id = pathname.split('/')[3];
                handleCoverageById(method, id, data, res);
            } else if (pathname === '/api/settings') {
                handleSettings(method, data, res);
            } else if (pathname === '/api/blackouts') {
                handleBlackouts(method, data, res);
            } else if (pathname.startsWith('/api/blackouts/')) {
                const id = pathname.split('/')[3];
                handleBlackoutById(method, id, data, res);
            } else if (pathname === '/api/share') {
                handleShare(method, data, parsedUrl.query, res);
            } else if (pathname === '/api/send-invitations') {
                handleSendInvitations(method, data, res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API endpoint not found' }));
            }
        } catch (error) {
            console.error('API Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    });
}

// Clinicians handlers
function handleClinicians(method, data, res) {
    if (method === 'GET') {
        sendJSON(res, dataStore.clinicians);
    } else if (method === 'POST') {
        const clinician = {
            id: generateId(),
            ...data,
            createdAt: new Date().toISOString()
        };
        dataStore.clinicians.push(clinician);
        saveData();
        sendJSON(res, clinician, 201);
    }
}

function handleClinicianById(method, id, data, res) {
    const index = dataStore.clinicians.findIndex(c => c.id === id);
    if (index === -1) {
        sendJSON(res, { error: 'Clinician not found' }, 404);
        return;
    }

    if (method === 'GET') {
        sendJSON(res, dataStore.clinicians[index]);
    } else if (method === 'PUT') {
        dataStore.clinicians[index] = { ...dataStore.clinicians[index], ...data };
        saveData();
        sendJSON(res, dataStore.clinicians[index]);
    } else if (method === 'DELETE') {
        dataStore.clinicians.splice(index, 1);
        saveData();
        sendJSON(res, { success: true });
    }
}

// Requests handlers
function handleRequests(method, data, res) {
    if (method === 'GET') {
        sendJSON(res, dataStore.requests);
    } else if (method === 'POST') {
        const request = {
            id: generateId(),
            ...data,
            status: 'pending',
            submittedAt: new Date().toISOString()
        };
        dataStore.requests.push(request);
        saveData();
        sendJSON(res, request, 201);
    }
}

function handleRequestById(method, id, data, res) {
    const index = dataStore.requests.findIndex(r => r.id === id);
    if (index === -1) {
        sendJSON(res, { error: 'Request not found' }, 404);
        return;
    }

    if (method === 'GET') {
        sendJSON(res, dataStore.requests[index]);
    } else if (method === 'PUT') {
        dataStore.requests[index] = {
            ...dataStore.requests[index],
            ...data,
            updatedAt: new Date().toISOString()
        };
        saveData();
        sendJSON(res, dataStore.requests[index]);
    } else if (method === 'DELETE') {
        dataStore.requests.splice(index, 1);
        saveData();
        sendJSON(res, { success: true });
    }
}

// Locations handlers
function handleLocations(method, data, res) {
    if (method === 'GET') {
        sendJSON(res, dataStore.locations);
    } else if (method === 'POST') {
        const location = {
            id: generateId(),
            ...data,
            createdAt: new Date().toISOString()
        };
        dataStore.locations.push(location);
        saveData();
        sendJSON(res, location, 201);
    }
}

function handleLocationById(method, id, data, res) {
    const index = dataStore.locations.findIndex(l => l.id === id);
    if (index === -1) {
        sendJSON(res, { error: 'Location not found' }, 404);
        return;
    }

    if (method === 'GET') {
        sendJSON(res, dataStore.locations[index]);
    } else if (method === 'PUT') {
        dataStore.locations[index] = { ...dataStore.locations[index], ...data };
        saveData();
        sendJSON(res, dataStore.locations[index]);
    } else if (method === 'DELETE') {
        dataStore.locations.splice(index, 1);
        saveData();
        sendJSON(res, { success: true });
    }
}

// Coverage handlers
function handleCoverage(method, data, res) {
    if (method === 'GET') {
        sendJSON(res, dataStore.coverage);
    } else if (method === 'POST') {
        const coverage = {
            id: generateId(),
            ...data,
            createdAt: new Date().toISOString()
        };
        dataStore.coverage.push(coverage);
        saveData();
        sendJSON(res, coverage, 201);
    }
}

function handleCoverageById(method, id, data, res) {
    const index = dataStore.coverage.findIndex(c => c.id === id);
    if (index === -1) {
        sendJSON(res, { error: 'Coverage requirement not found' }, 404);
        return;
    }

    if (method === 'GET') {
        sendJSON(res, dataStore.coverage[index]);
    } else if (method === 'PUT') {
        dataStore.coverage[index] = { ...dataStore.coverage[index], ...data };
        saveData();
        sendJSON(res, dataStore.coverage[index]);
    } else if (method === 'DELETE') {
        dataStore.coverage.splice(index, 1);
        saveData();
        sendJSON(res, { success: true });
    }
}

// Settings handlers
function handleSettings(method, data, res) {
    if (method === 'GET') {
        sendJSON(res, dataStore.settings);
    } else if (method === 'PUT' || method === 'POST') {
        dataStore.settings = { ...dataStore.settings, ...data };
        saveData();
        sendJSON(res, dataStore.settings);
    }
}

// Blackouts handlers
function handleBlackouts(method, data, res) {
    if (method === 'GET') {
        sendJSON(res, dataStore.blackouts);
    } else if (method === 'POST') {
        const blackout = {
            id: generateId(),
            ...data
        };
        dataStore.blackouts.push(blackout);
        saveData();
        sendJSON(res, blackout, 201);
    }
}

function handleBlackoutById(method, id, data, res) {
    const index = dataStore.blackouts.findIndex(b => b.id === id);
    if (index === -1) {
        sendJSON(res, { error: 'Blackout not found' }, 404);
        return;
    }

    if (method === 'DELETE') {
        dataStore.blackouts.splice(index, 1);
        saveData();
        sendJSON(res, { success: true });
    }
}

// Share link handlers
function handleShare(method, data, query, res) {
    if (method === 'POST') {
        // Generate new share token
        const token = generateId();
        dataStore.shareTokens.push({
            token,
            createdAt: new Date().toISOString(),
            expiresAt: data.expiresAt || null
        });
        saveData();
        sendJSON(res, { token });
    } else if (method === 'GET') {
        // Validate token
        const token = query.token;
        const tokenData = dataStore.shareTokens.find(t => t.token === token);
        if (tokenData) {
            // Check expiration
            if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
                sendJSON(res, { valid: false, reason: 'expired' });
            } else {
                sendJSON(res, { valid: true, settings: dataStore.settings });
            }
        } else {
            sendJSON(res, { valid: false, reason: 'not_found' });
        }
    }
}

// Email invitation handler (placeholder - would integrate with email service)
function handleSendInvitations(method, data, res) {
    if (method !== 'POST') {
        sendJSON(res, { error: 'Method not allowed' }, 405);
        return;
    }

    const { emails, shareLink, message } = data;

    if (!emails || !emails.length) {
        sendJSON(res, { error: 'No email addresses provided' }, 400);
        return;
    }

    // In a real implementation, this would send emails via an email service
    // For now, we'll just log and return success
    console.log('Sending invitations to:', emails);
    console.log('Share link:', shareLink);
    console.log('Message:', message);

    // Log the invitation for tracking
    const invitation = {
        id: generateId(),
        emails: emails,
        shareLink: shareLink,
        sentAt: new Date().toISOString(),
        status: 'simulated' // Would be 'sent' with real email service
    };

    sendJSON(res, {
        success: true,
        message: `Invitation ready for ${emails.length} recipient(s)`,
        invitation
    });
}

// Helper to send JSON response
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Start server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║     Clinician Scheduling App Server                ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  Server running at http://localhost:${PORT}          ║
║                                                    ║
║  Available pages:                                  ║
║  • Dashboard:  http://localhost:${PORT}/             ║
║  • Requests:   http://localhost:${PORT}/request.html ║
║                                                    ║
║  API endpoints: /api/*                             ║
║                                                    ║
╚════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nSaving data and shutting down...');
    saveData();
    process.exit(0);
});
