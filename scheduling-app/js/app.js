/**
 * Main Application Controller for Clinician Scheduling App
 */

class ClinicianScheduler {
    constructor() {
        this.currentView = 'dashboard';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();

        this.init();
    }

    init() {
        // Initialize sample data if needed
        Storage.initializeSampleData();

        // Bind event listeners
        this.bindNavigation();
        this.bindHeaderActions();
        this.bindModalEvents();
        this.bindSettingsEvents();

        // Load initial view
        this.loadDashboard();
        this.updateCurrentPeriod();
    }

    // ===================================
    // Navigation
    // ===================================

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
    }

    switchView(view) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `${view}-view`);
        });

        this.currentView = view;

        // Load view data
        switch (view) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'calendar':
                this.loadCalendar();
                break;
            case 'requests':
                this.loadRequests();
                break;
            case 'coverage':
                this.loadCoverage();
                break;
            case 'locations':
                this.loadLocations();
                break;
            case 'clinicians':
                this.loadClinicians();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    // ===================================
    // Dashboard
    // ===================================

    loadDashboard() {
        const requests = Storage.getRequests();
        const clinicians = Storage.getClinicians();
        const coverageRequirements = Storage.getCoverageRequirements();

        // Update stats
        const stats = Schedule.getRequestStats(requests);
        document.getElementById('pendingRequests').textContent = stats.pending;
        document.getElementById('approvedRequests').textContent = stats.approved;
        document.getElementById('totalClinicians').textContent = clinicians.length;

        // Calculate coverage
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const coveragePercent = Schedule.calculateCoveragePercentage(
            today, endOfMonth, coverageRequirements, clinicians, requests
        );
        document.getElementById('coverageStatus').textContent = `${coveragePercent}%`;

        // Load upcoming time off
        this.loadUpcomingTimeOff(requests, clinicians);

        // Load coverage alerts
        this.loadCoverageAlerts(coverageRequirements, clinicians, requests);
    }

    loadUpcomingTimeOff(requests, clinicians) {
        const container = document.getElementById('upcomingTimeOff');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = requests
            .filter(r => r.status === 'approved' && new Date(r.startDate) >= today)
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, 5);

        if (upcoming.length === 0) {
            container.innerHTML = '<p class="empty-state">No upcoming time off scheduled</p>';
            return;
        }

        container.innerHTML = upcoming.map(request => {
            const clinician = clinicians.find(c => c.id === request.clinicianId);
            const initials = clinician ? clinician.name.split(' ').map(n => n[0]).join('') : '?';
            return `
                <div class="upcoming-item">
                    <div class="upcoming-info">
                        <div class="upcoming-avatar">${initials}</div>
                        <div class="upcoming-details">
                            <h5>${clinician ? clinician.name : 'Unknown'}</h5>
                            <p>${request.type}</p>
                        </div>
                    </div>
                    <div class="upcoming-date">
                        ${Schedule.formatDateShort(request.startDate)} - ${Schedule.formatDateShort(request.endDate)}
                    </div>
                </div>
            `;
        }).join('');
    }

    loadCoverageAlerts(coverageRequirements, clinicians, requests) {
        const container = document.getElementById('coverageAlerts');
        const today = new Date();
        const twoWeeksOut = Schedule.addDays(today, 14);

        const issues = Schedule.getCoverageIssues(
            today, twoWeeksOut, coverageRequirements, clinicians, requests
        );

        if (issues.length === 0) {
            container.innerHTML = '<p class="empty-state">No coverage alerts</p>';
            return;
        }

        container.innerHTML = issues.slice(0, 5).map(issue => `
            <div class="alert-item">
                <span class="alert-icon warning">⚠️</span>
                <div class="alert-content">
                    <h5>${Schedule.formatDate(issue.date)}</h5>
                    <p>${issue.requirement.name}: ${issue.shortfall} clinician(s) short</p>
                </div>
            </div>
        `).join('');
    }

    updateCurrentPeriod() {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('currentPeriod').textContent =
            `${months[this.currentMonth]} ${this.currentYear}`;
    }

    // ===================================
    // Calendar
    // ===================================

    loadCalendar() {
        const requests = Storage.getRequests();
        const calendarData = Schedule.generateCalendarMonth(this.currentYear, this.currentMonth, requests);

        const grid = document.getElementById('calendarGrid');
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('calendarMonth').textContent =
            `${months[this.currentMonth]} ${this.currentYear}`;

        // Generate header
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = days.map(d => `<div class="calendar-header">${d}</div>`).join('');

        // Generate days
        html += calendarData.map(day => {
            const classes = ['calendar-day'];
            if (!day.isCurrentMonth) classes.push('other-month');
            if (day.isToday) classes.push('today');
            if (day.events.length > 0) classes.push('has-events');

            const eventsHtml = day.events.slice(0, 3).map(event => {
                const clinician = Storage.getClinicianById(event.clinicianId);
                return `<div class="day-event ${event.status}">${clinician ? clinician.name.split(' ')[0] : 'Unknown'}</div>`;
            }).join('');

            return `
                <div class="${classes.join(' ')}" data-date="${day.date.toISOString()}">
                    <div class="day-number">${day.dayNumber}</div>
                    <div class="day-events">${eventsHtml}</div>
                </div>
            `;
        }).join('');

        grid.innerHTML = html;

        // Bind calendar navigation
        document.getElementById('prevMonth').onclick = () => this.navigateMonth(-1);
        document.getElementById('nextMonth').onclick = () => this.navigateMonth(1);
    }

    navigateMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.loadCalendar();
    }

    // ===================================
    // Requests
    // ===================================

    loadRequests() {
        const requests = Storage.getRequests();
        const clinicians = Storage.getClinicians();
        const filter = document.getElementById('requestFilter').value;

        let filtered = requests;
        if (filter !== 'all') {
            filtered = requests.filter(r => r.status === filter);
        }

        filtered.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        const tbody = document.getElementById('requestsTableBody');

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No requests found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(request => {
            const clinician = clinicians.find(c => c.id === request.clinicianId);
            return `
                <tr>
                    <td>${clinician ? clinician.name : 'Unknown'}</td>
                    <td>${request.type}</td>
                    <td>${Schedule.formatDate(request.startDate)}</td>
                    <td>${Schedule.formatDate(request.endDate)}</td>
                    <td><span class="status-badge ${request.status}">${request.status}</span></td>
                    <td>${Schedule.formatDate(request.submittedAt)}</td>
                    <td class="action-buttons">
                        ${request.status === 'pending' ? `
                            <button class="btn btn-success action-btn" onclick="app.approveRequest('${request.id}')">Approve</button>
                            <button class="btn btn-danger action-btn" onclick="app.denyRequest('${request.id}')">Deny</button>
                        ` : `
                            <button class="btn btn-secondary action-btn" onclick="app.viewRequest('${request.id}')">View</button>
                        `}
                        <button class="btn btn-secondary action-btn" onclick="app.deleteRequest('${request.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind filter change
        document.getElementById('requestFilter').onchange = () => this.loadRequests();
        document.getElementById('newRequest').onclick = () => this.showNewRequestModal();
    }

    approveRequest(id) {
        Storage.updateRequest(id, { status: 'approved' });
        this.loadRequests();
        this.showNotification('Request approved');
    }

    denyRequest(id) {
        Storage.updateRequest(id, { status: 'denied' });
        this.loadRequests();
        this.showNotification('Request denied');
    }

    deleteRequest(id) {
        if (confirm('Are you sure you want to delete this request?')) {
            Storage.deleteRequest(id);
            this.loadRequests();
            this.showNotification('Request deleted');
        }
    }

    viewRequest(id) {
        const request = Storage.getRequestById(id);
        const clinician = Storage.getClinicianById(request.clinicianId);

        this.showModal('Request Details', `
            <div class="form-group">
                <label>Clinician</label>
                <p>${clinician ? clinician.name : 'Unknown'}</p>
            </div>
            <div class="form-group">
                <label>Type</label>
                <p>${request.type}</p>
            </div>
            <div class="form-group">
                <label>Dates</label>
                <p>${Schedule.formatDate(request.startDate)} - ${Schedule.formatDate(request.endDate)}</p>
            </div>
            <div class="form-group">
                <label>Status</label>
                <p><span class="status-badge ${request.status}">${request.status}</span></p>
            </div>
            ${request.notes ? `
                <div class="form-group">
                    <label>Notes</label>
                    <p>${request.notes}</p>
                </div>
            ` : ''}
            <div class="form-group">
                <label>Submitted</label>
                <p>${Schedule.formatDate(request.submittedAt)}</p>
            </div>
        `);
    }

    showNewRequestModal() {
        const clinicians = Storage.getClinicians();
        const locations = Storage.getLocations();

        const clinicianOptions = clinicians.map(c =>
            `<option value="${c.id}">${c.name}</option>`
        ).join('');

        const locationCheckboxes = locations.map(l =>
            `<label class="checkbox-item"><input type="checkbox" name="locations" value="${l.id}"> ${l.name}</label>`
        ).join('');

        this.showModal('New Time Off Request', `
            <form id="newRequestForm">
                <div class="form-group">
                    <label>Clinician</label>
                    <select id="newReqClinician" class="form-input" required>
                        <option value="">Select Clinician</option>
                        ${clinicianOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Request Type</label>
                    <select id="newReqType" class="form-input" required>
                        <option value="vacation">Vacation</option>
                        <option value="personal">Personal Day</option>
                        <option value="sick">Sick Leave</option>
                        <option value="conference">Conference/CME</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="newReqStartDate" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" id="newReqEndDate" class="form-input" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Affected Locations</label>
                    <div class="checkbox-group">${locationCheckboxes}</div>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="newReqNotes" class="form-input" rows="3"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit Request</button>
                </div>
            </form>
        `);

        document.getElementById('newRequestForm').onsubmit = (e) => {
            e.preventDefault();
            this.submitNewRequest();
        };
    }

    submitNewRequest() {
        const clinicianId = document.getElementById('newReqClinician').value;
        const type = document.getElementById('newReqType').value;
        const startDate = document.getElementById('newReqStartDate').value;
        const endDate = document.getElementById('newReqEndDate').value;
        const notes = document.getElementById('newReqNotes').value;

        const locationInputs = document.querySelectorAll('input[name="locations"]:checked');
        const locations = Array.from(locationInputs).map(input => input.value);

        const request = {
            clinicianId,
            type,
            startDate,
            endDate,
            locations,
            notes
        };

        Storage.addRequest(request);
        this.closeModal();
        this.loadRequests();
        this.showNotification('Request submitted successfully');
    }

    // ===================================
    // Coverage
    // ===================================

    loadCoverage() {
        const coverage = Storage.getCoverageRequirements();
        const locations = Storage.getLocations();
        const grid = document.getElementById('coverageGrid');

        if (coverage.length === 0) {
            grid.innerHTML = '<p class="empty-state">No coverage requirements defined</p>';
        } else {
            grid.innerHTML = coverage.map(c => {
                const location = locations.find(l => l.id === c.locationId);
                const daysText = c.days ? c.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') : 'All days';

                return `
                    <div class="coverage-card">
                        <div class="coverage-card-header">
                            <div>
                                <h4>${c.name}</h4>
                                <p class="coverage-location">${location ? location.name : 'All Locations'}</p>
                            </div>
                            <div class="action-buttons">
                                <button class="btn btn-icon btn-secondary" onclick="app.editCoverage('${c.id}')">✏️</button>
                                <button class="btn btn-icon btn-secondary" onclick="app.deleteCoverage('${c.id}')">🗑️</button>
                            </div>
                        </div>
                        <div class="coverage-details">
                            <div class="coverage-detail">
                                <div class="coverage-detail-value">${c.minClinicians}</div>
                                <div class="coverage-detail-label">Min Clinicians</div>
                            </div>
                            <div class="coverage-detail">
                                <div class="coverage-detail-value">${daysText}</div>
                                <div class="coverage-detail-label">Days</div>
                            </div>
                        </div>
                        <div class="coverage-times">
                            ${Schedule.formatTime(c.startTime)} - ${Schedule.formatTime(c.endTime)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('addCoverage').onclick = () => this.showAddCoverageModal();
    }

    showAddCoverageModal() {
        const locations = Storage.getLocations();
        const locationOptions = locations.map(l =>
            `<option value="${l.id}">${l.name}</option>`
        ).join('');

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayCheckboxes = days.map(d =>
            `<label class="checkbox-item"><input type="checkbox" name="coverageDays" value="${d}" ${['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d) ? 'checked' : ''}> ${d.charAt(0).toUpperCase() + d.slice(1)}</label>`
        ).join('');

        this.showModal('Add Coverage Requirement', `
            <form id="coverageForm">
                <div class="form-group">
                    <label>Requirement Name</label>
                    <input type="text" id="coverageName" class="form-input" required placeholder="e.g., Weekday Day Shift">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <select id="coverageLocation" class="form-input" required>
                        <option value="">Select Location</option>
                        ${locationOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Minimum Clinicians Required</label>
                    <input type="number" id="coverageMinClinicians" class="form-input" required min="1" value="2">
                </div>
                <div class="form-group">
                    <label>Days</label>
                    <div class="checkbox-group">${dayCheckboxes}</div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Time</label>
                        <input type="time" id="coverageStartTime" class="form-input" value="07:00">
                    </div>
                    <div class="form-group">
                        <label>End Time</label>
                        <input type="time" id="coverageEndTime" class="form-input" value="15:00">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Requirement</button>
                </div>
            </form>
        `);

        document.getElementById('coverageForm').onsubmit = (e) => {
            e.preventDefault();
            this.submitCoverage();
        };
    }

    submitCoverage() {
        const name = document.getElementById('coverageName').value;
        const locationId = document.getElementById('coverageLocation').value;
        const minClinicians = parseInt(document.getElementById('coverageMinClinicians').value);
        const startTime = document.getElementById('coverageStartTime').value;
        const endTime = document.getElementById('coverageEndTime').value;

        const dayInputs = document.querySelectorAll('input[name="coverageDays"]:checked');
        const days = Array.from(dayInputs).map(input => input.value);

        Storage.addCoverageRequirement({
            name,
            locationId,
            minClinicians,
            days,
            startTime,
            endTime
        });

        this.closeModal();
        this.loadCoverage();
        this.showNotification('Coverage requirement added');
    }

    deleteCoverage(id) {
        if (confirm('Are you sure you want to delete this coverage requirement?')) {
            Storage.deleteCoverageRequirement(id);
            this.loadCoverage();
            this.showNotification('Coverage requirement deleted');
        }
    }

    // ===================================
    // Locations
    // ===================================

    loadLocations() {
        const locations = Storage.getLocations();
        const container = document.getElementById('locationsList');

        if (locations.length === 0) {
            container.innerHTML = '<p class="empty-state">No locations defined</p>';
        } else {
            container.innerHTML = locations.map(l => `
                <div class="location-item">
                    <div class="location-info">
                        <div class="location-icon">📍</div>
                        <div class="location-details">
                            <h4>${l.name}</h4>
                            <p>${l.address || ''} ${l.type ? `• ${l.type}` : ''}</p>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-secondary" onclick="app.editLocation('${l.id}')">Edit</button>
                        <button class="btn btn-secondary" onclick="app.deleteLocation('${l.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('addLocation').onclick = () => this.showAddLocationModal();
    }

    showAddLocationModal() {
        this.showModal('Add Location', `
            <form id="locationForm">
                <div class="form-group">
                    <label>Location Name</label>
                    <input type="text" id="locationName" class="form-input" required placeholder="e.g., Main Hospital">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="locationAddress" class="form-input" placeholder="123 Medical Center Dr">
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="locationType" class="form-input">
                        <option value="Hospital">Hospital</option>
                        <option value="Clinic">Clinic</option>
                        <option value="Department">Department</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Location</button>
                </div>
            </form>
        `);

        document.getElementById('locationForm').onsubmit = (e) => {
            e.preventDefault();
            this.submitLocation();
        };
    }

    submitLocation() {
        const name = document.getElementById('locationName').value;
        const address = document.getElementById('locationAddress').value;
        const type = document.getElementById('locationType').value;

        Storage.addLocation({ name, address, type });
        this.closeModal();
        this.loadLocations();
        this.showNotification('Location added');
    }

    deleteLocation(id) {
        if (confirm('Are you sure you want to delete this location?')) {
            Storage.deleteLocation(id);
            this.loadLocations();
            this.showNotification('Location deleted');
        }
    }

    // ===================================
    // Clinicians
    // ===================================

    loadClinicians() {
        const clinicians = Storage.getClinicians();
        const requests = Storage.getRequests();
        const grid = document.getElementById('cliniciansGrid');

        if (clinicians.length === 0) {
            grid.innerHTML = '<p class="empty-state">No clinicians added</p>';
        } else {
            grid.innerHTML = clinicians.map(c => {
                const stats = Schedule.getClinicianStats(c.id, requests);
                const initials = c.name.split(' ').map(n => n[0]).join('');

                return `
                    <div class="clinician-card">
                        <div class="clinician-avatar">${initials}</div>
                        <h4>${c.name}</h4>
                        <p class="clinician-email">${c.email || ''}</p>
                        <p class="clinician-role">${c.role || 'Clinician'}</p>
                        <div class="clinician-stats">
                            <div class="clinician-stat">
                                <div class="clinician-stat-value">${stats.pending}</div>
                                <div class="clinician-stat-label">Pending</div>
                            </div>
                            <div class="clinician-stat">
                                <div class="clinician-stat-value">${stats.approved}</div>
                                <div class="clinician-stat-label">Approved</div>
                            </div>
                            <div class="clinician-stat">
                                <div class="clinician-stat-value">${stats.upcomingDays}</div>
                                <div class="clinician-stat-label">Days Off</div>
                            </div>
                        </div>
                        <div class="action-buttons" style="margin-top: 16px;">
                            <button class="btn btn-secondary" onclick="app.editClinician('${c.id}')">Edit</button>
                            <button class="btn btn-secondary" onclick="app.deleteClinician('${c.id}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('addClinician').onclick = () => this.showAddClinicianModal();
    }

    showAddClinicianModal() {
        this.showModal('Add Clinician', `
            <form id="clinicianForm">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="clinicianName" class="form-input" required placeholder="Dr. Jane Doe">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="clinicianEmail" class="form-input" required placeholder="jane.doe@hospital.com">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="clinicianRole" class="form-input">
                        <option value="Physician">Physician</option>
                        <option value="Nurse">Nurse</option>
                        <option value="Nurse Practitioner">Nurse Practitioner</option>
                        <option value="Physician Assistant">Physician Assistant</option>
                        <option value="Resident">Resident</option>
                        <option value="Fellow">Fellow</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Clinician</button>
                </div>
            </form>
        `);

        document.getElementById('clinicianForm').onsubmit = (e) => {
            e.preventDefault();
            this.submitClinician();
        };
    }

    submitClinician() {
        const name = document.getElementById('clinicianName').value;
        const email = document.getElementById('clinicianEmail').value;
        const role = document.getElementById('clinicianRole').value;

        Storage.addClinician({ name, email, role });
        this.closeModal();
        this.loadClinicians();
        this.showNotification('Clinician added');
    }

    deleteClinician(id) {
        if (confirm('Are you sure you want to delete this clinician?')) {
            Storage.deleteClinician(id);
            this.loadClinicians();
            this.showNotification('Clinician deleted');
        }
    }

    // ===================================
    // Settings
    // ===================================

    loadSettings() {
        const settings = Storage.getSettings();
        const blackouts = Storage.getBlackoutDates();

        document.getElementById('departmentName').value = settings.departmentName || '';
        document.getElementById('managerEmail').value = settings.managerEmail || '';
        document.getElementById('minDaysAdvance').value = settings.minDaysAdvance || 14;
        document.getElementById('maxDaysAdvance').value = settings.maxDaysAdvance || 365;
        document.getElementById('windowOpen').value = settings.windowOpen || '';
        document.getElementById('windowClose').value = settings.windowClose || '';

        // Load blackout dates
        const container = document.getElementById('blackoutDates');
        if (blackouts.length === 0) {
            container.innerHTML = '<p class="empty-state">No blackout dates defined</p>';
        } else {
            container.innerHTML = blackouts.map(b => `
                <div class="blackout-item">
                    <span>${Schedule.formatDate(b.startDate)} - ${Schedule.formatDate(b.endDate)}: ${b.reason || 'No reason specified'}</span>
                    <button class="btn btn-icon btn-secondary" onclick="app.deleteBlackout('${b.id}')">🗑️</button>
                </div>
            `).join('');
        }
    }

    bindSettingsEvents() {
        document.getElementById('saveSettings').onclick = () => this.saveSettings();
        document.getElementById('addBlackout').onclick = () => this.showAddBlackoutModal();
    }

    saveSettings() {
        const settings = {
            departmentName: document.getElementById('departmentName').value,
            managerEmail: document.getElementById('managerEmail').value,
            minDaysAdvance: parseInt(document.getElementById('minDaysAdvance').value),
            maxDaysAdvance: parseInt(document.getElementById('maxDaysAdvance').value),
            windowOpen: document.getElementById('windowOpen').value || null,
            windowClose: document.getElementById('windowClose').value || null
        };

        Storage.saveSettings(settings);
        this.showNotification('Settings saved');
    }

    showAddBlackoutModal() {
        this.showModal('Add Blackout Period', `
            <form id="blackoutForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="blackoutStart" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" id="blackoutEnd" class="form-input" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Reason</label>
                    <input type="text" id="blackoutReason" class="form-input" placeholder="e.g., Holiday period">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Blackout</button>
                </div>
            </form>
        `);

        document.getElementById('blackoutForm').onsubmit = (e) => {
            e.preventDefault();
            this.submitBlackout();
        };
    }

    submitBlackout() {
        const startDate = document.getElementById('blackoutStart').value;
        const endDate = document.getElementById('blackoutEnd').value;
        const reason = document.getElementById('blackoutReason').value;

        Storage.addBlackoutDate({ startDate, endDate, reason });
        this.closeModal();
        this.loadSettings();
        this.showNotification('Blackout period added');
    }

    deleteBlackout(id) {
        Storage.deleteBlackoutDate(id);
        this.loadSettings();
        this.showNotification('Blackout period deleted');
    }

    // ===================================
    // Header Actions & Share Link
    // ===================================

    bindHeaderActions() {
        document.getElementById('shareLink').onclick = () => this.showShareModal();
        document.getElementById('copyLink').onclick = () => this.copyShareLink();
        document.getElementById('sendEmails').onclick = () => this.sendInvitationEmails();
    }

    showShareModal() {
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        const link = Schedule.generateShareableLink(baseUrl);
        document.getElementById('shareableLink').value = link;
        document.getElementById('shareLinkModal').classList.add('active');
    }

    copyShareLink() {
        const input = document.getElementById('shareableLink');
        input.select();
        document.execCommand('copy');
        this.showNotification('Link copied to clipboard');
    }

    sendInvitationEmails() {
        const emails = document.getElementById('emailRecipients').value;
        if (!emails.trim()) {
            this.showNotification('Please enter email addresses', 'error');
            return;
        }

        const link = document.getElementById('shareableLink').value;
        const settings = Storage.getSettings();

        // Create mailto link
        const subject = encodeURIComponent(`Time Off Request - ${settings.departmentName || 'Department Scheduling'}`);
        const body = encodeURIComponent(
            `You are invited to submit your time-off requests for ${settings.departmentName || 'our department'}.\n\n` +
            `Please use this link to submit your requests:\n${link}\n\n` +
            `Thank you!`
        );

        window.open(`mailto:${emails}?subject=${subject}&body=${body}`);
        this.showNotification('Email client opened');
    }

    // ===================================
    // Modal Management
    // ===================================

    bindModalEvents() {
        document.getElementById('modalClose').onclick = () => this.closeModal();
        document.getElementById('modalOverlay').onclick = (e) => {
            if (e.target.id === 'modalOverlay') this.closeModal();
        };
    }

    showModal(title, content) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('modalOverlay').classList.add('active');
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    }

    // ===================================
    // Notifications
    // ===================================

    showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#db4437' : '#34a853'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Close share modal function
function closeShareModal() {
    document.getElementById('shareLinkModal').classList.remove('active');
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ClinicianScheduler();
});
