/**
 * Storage Manager for Clinician Scheduling App
 * Handles local storage operations and data management
 */

const Storage = {
    KEYS: {
        CLINICIANS: 'scheduling_clinicians',
        REQUESTS: 'scheduling_requests',
        LOCATIONS: 'scheduling_locations',
        COVERAGE: 'scheduling_coverage',
        SETTINGS: 'scheduling_settings',
        BLACKOUTS: 'scheduling_blackouts'
    },

    // ===================================
    // Generic Storage Operations
    // ===================================

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error writing to storage:', error);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from storage:', error);
            return false;
        }
    },

    // ===================================
    // Clinicians
    // ===================================

    getClinicians() {
        return this.get(this.KEYS.CLINICIANS) || [];
    },

    saveClinicians(clinicians) {
        return this.set(this.KEYS.CLINICIANS, clinicians);
    },

    addClinician(clinician) {
        const clinicians = this.getClinicians();
        clinician.id = this.generateId();
        clinician.createdAt = new Date().toISOString();
        clinicians.push(clinician);
        this.saveClinicians(clinicians);
        return clinician;
    },

    updateClinician(id, updates) {
        const clinicians = this.getClinicians();
        const index = clinicians.findIndex(c => c.id === id);
        if (index !== -1) {
            clinicians[index] = { ...clinicians[index], ...updates };
            this.saveClinicians(clinicians);
            return clinicians[index];
        }
        return null;
    },

    deleteClinician(id) {
        const clinicians = this.getClinicians();
        const filtered = clinicians.filter(c => c.id !== id);
        this.saveClinicians(filtered);
        return true;
    },

    getClinicianById(id) {
        const clinicians = this.getClinicians();
        return clinicians.find(c => c.id === id) || null;
    },

    // ===================================
    // Time Off Requests
    // ===================================

    getRequests() {
        return this.get(this.KEYS.REQUESTS) || [];
    },

    saveRequests(requests) {
        return this.set(this.KEYS.REQUESTS, requests);
    },

    addRequest(request) {
        const requests = this.getRequests();
        request.id = this.generateId();
        request.submittedAt = new Date().toISOString();
        request.status = 'pending';
        requests.push(request);
        this.saveRequests(requests);
        return request;
    },

    updateRequest(id, updates) {
        const requests = this.getRequests();
        const index = requests.findIndex(r => r.id === id);
        if (index !== -1) {
            requests[index] = { ...requests[index], ...updates };
            requests[index].updatedAt = new Date().toISOString();
            this.saveRequests(requests);
            return requests[index];
        }
        return null;
    },

    deleteRequest(id) {
        const requests = this.getRequests();
        const filtered = requests.filter(r => r.id !== id);
        this.saveRequests(filtered);
        return true;
    },

    getRequestById(id) {
        const requests = this.getRequests();
        return requests.find(r => r.id === id) || null;
    },

    getRequestsByClinicianId(clinicianId) {
        const requests = this.getRequests();
        return requests.filter(r => r.clinicianId === clinicianId);
    },

    getRequestsByStatus(status) {
        const requests = this.getRequests();
        return requests.filter(r => r.status === status);
    },

    getRequestsByDateRange(startDate, endDate) {
        const requests = this.getRequests();
        return requests.filter(r => {
            const requestStart = new Date(r.startDate);
            const requestEnd = new Date(r.endDate);
            const rangeStart = new Date(startDate);
            const rangeEnd = new Date(endDate);
            return requestStart <= rangeEnd && requestEnd >= rangeStart;
        });
    },

    // ===================================
    // Locations
    // ===================================

    getLocations() {
        return this.get(this.KEYS.LOCATIONS) || [];
    },

    saveLocations(locations) {
        return this.set(this.KEYS.LOCATIONS, locations);
    },

    addLocation(location) {
        const locations = this.getLocations();
        location.id = this.generateId();
        location.createdAt = new Date().toISOString();
        locations.push(location);
        this.saveLocations(locations);
        return location;
    },

    updateLocation(id, updates) {
        const locations = this.getLocations();
        const index = locations.findIndex(l => l.id === id);
        if (index !== -1) {
            locations[index] = { ...locations[index], ...updates };
            this.saveLocations(locations);
            return locations[index];
        }
        return null;
    },

    deleteLocation(id) {
        const locations = this.getLocations();
        const filtered = locations.filter(l => l.id !== id);
        this.saveLocations(filtered);
        return true;
    },

    // ===================================
    // Coverage Requirements
    // ===================================

    getCoverageRequirements() {
        return this.get(this.KEYS.COVERAGE) || [];
    },

    saveCoverageRequirements(coverage) {
        return this.set(this.KEYS.COVERAGE, coverage);
    },

    addCoverageRequirement(coverage) {
        const requirements = this.getCoverageRequirements();
        coverage.id = this.generateId();
        coverage.createdAt = new Date().toISOString();
        requirements.push(coverage);
        this.saveCoverageRequirements(requirements);
        return coverage;
    },

    updateCoverageRequirement(id, updates) {
        const requirements = this.getCoverageRequirements();
        const index = requirements.findIndex(c => c.id === id);
        if (index !== -1) {
            requirements[index] = { ...requirements[index], ...updates };
            this.saveCoverageRequirements(requirements);
            return requirements[index];
        }
        return null;
    },

    deleteCoverageRequirement(id) {
        const requirements = this.getCoverageRequirements();
        const filtered = requirements.filter(c => c.id !== id);
        this.saveCoverageRequirements(filtered);
        return true;
    },

    // ===================================
    // Settings
    // ===================================

    getSettings() {
        return this.get(this.KEYS.SETTINGS) || this.getDefaultSettings();
    },

    saveSettings(settings) {
        return this.set(this.KEYS.SETTINGS, settings);
    },

    getDefaultSettings() {
        return {
            departmentName: 'Medical Department',
            managerEmail: '',
            minDaysAdvance: 14,
            maxDaysAdvance: 365,
            windowOpen: null,
            windowClose: null,
            requestTypes: ['vacation', 'personal', 'sick', 'conference', 'other']
        };
    },

    // ===================================
    // Blackout Dates
    // ===================================

    getBlackoutDates() {
        return this.get(this.KEYS.BLACKOUTS) || [];
    },

    saveBlackoutDates(blackouts) {
        return this.set(this.KEYS.BLACKOUTS, blackouts);
    },

    addBlackoutDate(blackout) {
        const blackouts = this.getBlackoutDates();
        blackout.id = this.generateId();
        blackouts.push(blackout);
        this.saveBlackoutDates(blackouts);
        return blackout;
    },

    deleteBlackoutDate(id) {
        const blackouts = this.getBlackoutDates();
        const filtered = blackouts.filter(b => b.id !== id);
        this.saveBlackoutDates(filtered);
        return true;
    },

    isDateBlackedOut(date) {
        const blackouts = this.getBlackoutDates();
        const checkDate = new Date(date);
        return blackouts.some(b => {
            const start = new Date(b.startDate);
            const end = new Date(b.endDate);
            return checkDate >= start && checkDate <= end;
        });
    },

    // ===================================
    // Utility Functions
    // ===================================

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    generateShareToken() {
        return btoa(Date.now() + '_' + Math.random().toString(36).substr(2, 16));
    },

    // Initialize with sample data if empty
    initializeSampleData() {
        if (this.getClinicians().length === 0) {
            const sampleClinicians = [
                { name: 'Dr. Sarah Johnson', email: 'sarah.johnson@hospital.com', role: 'Physician' },
                { name: 'Dr. Michael Chen', email: 'michael.chen@hospital.com', role: 'Physician' },
                { name: 'Dr. Emily Williams', email: 'emily.williams@hospital.com', role: 'Physician' },
                { name: 'Nurse Patricia Davis', email: 'patricia.davis@hospital.com', role: 'Nurse' },
                { name: 'Nurse James Wilson', email: 'james.wilson@hospital.com', role: 'Nurse' }
            ];
            sampleClinicians.forEach(c => this.addClinician(c));
        }

        if (this.getLocations().length === 0) {
            const sampleLocations = [
                { name: 'Main Hospital', address: '123 Medical Center Dr', type: 'Hospital' },
                { name: 'North Clinic', address: '456 Health Ave', type: 'Clinic' },
                { name: 'South Clinic', address: '789 Care Blvd', type: 'Clinic' },
                { name: 'Emergency Department', address: '123 Medical Center Dr', type: 'Department' }
            ];
            sampleLocations.forEach(l => this.addLocation(l));
        }

        if (this.getCoverageRequirements().length === 0) {
            const locations = this.getLocations();
            if (locations.length > 0) {
                const sampleCoverage = [
                    {
                        name: 'Weekday Day Shift',
                        locationId: locations[0].id,
                        minClinicians: 3,
                        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                        startTime: '07:00',
                        endTime: '15:00'
                    },
                    {
                        name: 'Weekday Night Shift',
                        locationId: locations[0].id,
                        minClinicians: 2,
                        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                        startTime: '15:00',
                        endTime: '23:00'
                    },
                    {
                        name: 'Weekend Coverage',
                        locationId: locations[0].id,
                        minClinicians: 2,
                        days: ['saturday', 'sunday'],
                        startTime: '08:00',
                        endTime: '20:00'
                    }
                ];
                sampleCoverage.forEach(c => this.addCoverageRequirement(c));
            }
        }
    },

    // Export all data for backup
    exportData() {
        return {
            clinicians: this.getClinicians(),
            requests: this.getRequests(),
            locations: this.getLocations(),
            coverage: this.getCoverageRequirements(),
            settings: this.getSettings(),
            blackouts: this.getBlackoutDates(),
            exportedAt: new Date().toISOString()
        };
    },

    // Import data from backup
    importData(data) {
        if (data.clinicians) this.saveClinicians(data.clinicians);
        if (data.requests) this.saveRequests(data.requests);
        if (data.locations) this.saveLocations(data.locations);
        if (data.coverage) this.saveCoverageRequirements(data.coverage);
        if (data.settings) this.saveSettings(data.settings);
        if (data.blackouts) this.saveBlackoutDates(data.blackouts);
        return true;
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => this.remove(key));
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
