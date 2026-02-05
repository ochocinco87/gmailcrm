/**
 * Request Page Controller
 * Handles the clinician time-off request submission form
 */

class RequestPage {
    constructor() {
        this.selectedClinician = null;
        this.init();
    }

    init() {
        // Check if we have a valid token
        this.validateAccess();

        // Initialize sample data if needed
        Storage.initializeSampleData();

        // Load page data
        this.loadDepartmentInfo();
        this.loadClinicians();
        this.loadLocations();
        this.checkRequestWindow();

        // Bind events
        this.bindEvents();
    }

    validateAccess() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        // For now, allow access even without token (for testing)
        // In production, you'd validate the token
        if (token) {
            console.log('Access token provided:', token);
        }
    }

    loadDepartmentInfo() {
        const settings = Storage.getSettings();
        document.getElementById('departmentName').textContent =
            settings.departmentName || 'Department Scheduling';
    }

    loadClinicians() {
        const clinicians = Storage.getClinicians();
        const select = document.getElementById('clinicianSelect');

        clinicians.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });
    }

    loadLocations() {
        const locations = Storage.getLocations();
        const container = document.getElementById('locationsCheckboxes');

        if (locations.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No locations configured</p>';
            return;
        }

        container.innerHTML = locations.map(l => `
            <label class="checkbox-item">
                <input type="checkbox" name="locations" value="${l.id}" checked>
                ${l.name}
            </label>
        `).join('');
    }

    checkRequestWindow() {
        const settings = Storage.getSettings();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let isWindowOpen = true;

        if (settings.windowOpen && settings.windowClose) {
            const windowOpen = new Date(settings.windowOpen);
            const windowClose = new Date(settings.windowClose);

            if (today < windowOpen || today > windowClose) {
                isWindowOpen = false;
                document.getElementById('windowOpen').style.display = 'none';
                document.getElementById('windowClosed').style.display = 'block';
                document.getElementById('windowDates').textContent =
                    `Window open: ${Schedule.formatDate(windowOpen)} - ${Schedule.formatDate(windowClose)}`;
            }
        }

        // Update form inputs with date constraints
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        // Set min date based on advance notice requirement
        const minDate = Schedule.addDays(today, settings.minDaysAdvance || 0);
        startDateInput.min = minDate.toISOString().split('T')[0];
        endDateInput.min = minDate.toISOString().split('T')[0];

        // Set max date based on maximum advance booking
        if (settings.maxDaysAdvance) {
            const maxDate = Schedule.addDays(today, settings.maxDaysAdvance);
            startDateInput.max = maxDate.toISOString().split('T')[0];
            endDateInput.max = maxDate.toISOString().split('T')[0];
        }
    }

    bindEvents() {
        // Clinician selection
        document.getElementById('clinicianSelect').addEventListener('change', (e) => {
            this.selectedClinician = e.target.value;
            this.loadMyRequests();
        });

        // Toggle new clinician form
        document.getElementById('toggleNewClinician').addEventListener('click', () => {
            const group = document.getElementById('newClinicianGroup');
            group.style.display = group.style.display === 'none' ? 'block' : 'none';
        });

        // Date change - check for blackouts and coverage
        document.getElementById('startDate').addEventListener('change', () => this.checkDates());
        document.getElementById('endDate').addEventListener('change', () => this.checkDates());

        // Form submission
        document.getElementById('requestForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitRequest();
        });

        // Submit another button
        document.getElementById('submitAnother').addEventListener('click', () => {
            this.resetForm();
        });
    }

    checkDates() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!startDate || !endDate) return;

        const blackouts = Storage.getBlackoutDates();
        const blackoutWarning = document.getElementById('blackoutWarning');

        // Check for blackout dates
        let hasBlackout = false;
        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            if (Storage.isDateBlackedOut(currentDate)) {
                hasBlackout = true;
                break;
            }
            currentDate = Schedule.addDays(currentDate, 1);
        }

        blackoutWarning.style.display = hasBlackout ? 'flex' : 'none';

        // Check coverage impact
        this.checkCoverageImpact(startDate, endDate);
    }

    checkCoverageImpact(startDate, endDate) {
        const clinicianId = this.selectedClinician || document.getElementById('clinicianSelect').value;
        if (!clinicianId) return;

        const coverageRequirements = Storage.getCoverageRequirements();
        const clinicians = Storage.getClinicians();
        const requests = Storage.getRequests();

        // Simulate adding this request
        const simulatedRequest = {
            clinicianId,
            startDate,
            endDate,
            status: 'approved'
        };

        const allRequests = [...requests, simulatedRequest];

        const issues = Schedule.getCoverageIssues(
            startDate,
            endDate,
            coverageRequirements,
            clinicians,
            allRequests
        );

        const preview = document.getElementById('coveragePreview');
        const status = document.getElementById('coverageStatus');

        if (issues.length > 0) {
            preview.style.display = 'block';
            status.innerHTML = `
                <div class="alert-item">
                    <span class="alert-icon warning">⚠️</span>
                    <div class="alert-content">
                        <p>${issues.length} coverage requirement(s) may not be met during this period.</p>
                        <p style="font-size: 12px; color: var(--text-secondary);">
                            Your request will still be submitted for manager review.
                        </p>
                    </div>
                </div>
            `;
        } else {
            preview.style.display = 'block';
            status.innerHTML = `
                <div class="alert-item">
                    <span class="alert-icon" style="color: var(--success-green);">✓</span>
                    <div class="alert-content">
                        <p>Coverage requirements will still be met during this period.</p>
                    </div>
                </div>
            `;
        }
    }

    loadMyRequests() {
        const clinicianId = this.selectedClinician || document.getElementById('clinicianSelect').value;
        if (!clinicianId) {
            document.getElementById('myRequestsCard').style.display = 'none';
            return;
        }

        const requests = Storage.getRequestsByClinicianId(clinicianId);

        if (requests.length === 0) {
            document.getElementById('myRequestsCard').style.display = 'none';
            return;
        }

        document.getElementById('myRequestsCard').style.display = 'block';
        const list = document.getElementById('myRequestsList');

        list.innerHTML = requests
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
            .slice(0, 5)
            .map(r => `
                <div class="my-request-item">
                    <div>
                        <strong>${r.type}</strong>
                        <p style="font-size: 12px; color: var(--text-secondary);">
                            ${Schedule.formatDateShort(r.startDate)} - ${Schedule.formatDateShort(r.endDate)}
                        </p>
                    </div>
                    <span class="status-badge ${r.status}">${r.status}</span>
                </div>
            `).join('');
    }

    submitRequest() {
        // Get clinician ID (existing or new)
        let clinicianId = document.getElementById('clinicianSelect').value;
        const newClinicianName = document.getElementById('newClinicianName').value;
        const newClinicianEmail = document.getElementById('newClinicianEmail').value;

        if (!clinicianId && !newClinicianName) {
            this.showError('Please select or enter your name');
            return;
        }

        // Create new clinician if needed
        if (!clinicianId && newClinicianName) {
            const newClinician = Storage.addClinician({
                name: newClinicianName,
                email: newClinicianEmail,
                role: 'Clinician'
            });
            clinicianId = newClinician.id;
        }

        // Get form values
        const type = document.getElementById('requestType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const notes = document.getElementById('notes').value;

        // Get selected locations
        const locationInputs = document.querySelectorAll('input[name="locations"]:checked');
        const locations = Array.from(locationInputs).map(input => input.value);

        // Validate
        if (!type || !startDate || !endDate) {
            this.showError('Please fill in all required fields');
            return;
        }

        // Validate request
        const settings = Storage.getSettings();
        const blackouts = Storage.getBlackoutDates();
        const validation = Schedule.validateRequest(
            { startDate, endDate },
            settings,
            blackouts
        );

        if (!validation.valid) {
            this.showError(validation.errors.join('\n'));
            return;
        }

        // Check for conflicts
        const existingRequests = Storage.getRequests();
        const conflicts = Schedule.checkRequestConflicts(
            { clinicianId, startDate, endDate },
            existingRequests
        );

        if (conflicts.length > 0) {
            this.showError('You already have a pending or approved request for this time period');
            return;
        }

        // Submit the request
        const request = Storage.addRequest({
            clinicianId,
            type,
            startDate,
            endDate,
            startTime,
            endTime,
            locations,
            notes
        });

        // Show confirmation
        this.showConfirmation(request);
    }

    showConfirmation(request) {
        const clinician = Storage.getClinicianById(request.clinicianId);

        document.getElementById('requestForm').style.display = 'none';
        document.getElementById('clinicianSection').style.display = 'none';
        document.getElementById('confirmationMessage').style.display = 'block';

        document.getElementById('requestSummary').innerHTML = `
            <div style="display: grid; gap: 8px;">
                <div><strong>Name:</strong> ${clinician ? clinician.name : 'Unknown'}</div>
                <div><strong>Type:</strong> ${request.type}</div>
                <div><strong>Dates:</strong> ${Schedule.formatDate(request.startDate)} - ${Schedule.formatDate(request.endDate)}</div>
                <div><strong>Status:</strong> <span class="status-badge pending">Pending Review</span></div>
            </div>
        `;
    }

    resetForm() {
        document.getElementById('requestForm').style.display = 'block';
        document.getElementById('clinicianSection').style.display = 'block';
        document.getElementById('confirmationMessage').style.display = 'none';
        document.getElementById('requestForm').reset();
        document.getElementById('coveragePreview').style.display = 'none';
        document.getElementById('blackoutWarning').style.display = 'none';
    }

    showError(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #db4437;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 400px;
            white-space: pre-line;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new RequestPage();
});
