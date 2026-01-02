/**
 * Scheduling Logic for Clinician Scheduling App
 * Handles coverage calculations, conflict detection, and scheduling utilities
 */

const Schedule = {
    // ===================================
    // Date Utilities
    // ===================================

    formatDate(date) {
        if (typeof date === 'string') date = new Date(date);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatDateShort(date) {
        if (typeof date === 'string') date = new Date(date);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    },

    formatTime(time) {
        if (!time || time === 'all-day') return 'All Day';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    },

    getDayName(date) {
        if (typeof date === 'string') date = new Date(date);
        return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    },

    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    },

    getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    },

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },

    getDaysBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    },

    isWeekend(date) {
        if (typeof date === 'string') date = new Date(date);
        const day = date.getDay();
        return day === 0 || day === 6;
    },

    isSameDay(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.toDateString() === d2.toDateString();
    },

    isToday(date) {
        return this.isSameDay(date, new Date());
    },

    // ===================================
    // Coverage Calculations
    // ===================================

    /**
     * Check if a date falls within any approved time-off requests
     */
    getCliniciansOffOnDate(date, requests) {
        const checkDate = new Date(date);
        return requests.filter(r => {
            if (r.status !== 'approved') return false;
            const start = new Date(r.startDate);
            const end = new Date(r.endDate);
            return checkDate >= start && checkDate <= end;
        });
    },

    /**
     * Calculate available clinicians for a specific date
     */
    getAvailableClinicians(date, clinicians, requests) {
        const offRequests = this.getCliniciansOffOnDate(date, requests);
        const offClinicianIds = offRequests.map(r => r.clinicianId);
        return clinicians.filter(c => !offClinicianIds.includes(c.id));
    },

    /**
     * Check coverage status for a date against requirements
     */
    checkCoverageForDate(date, coverageRequirements, clinicians, requests) {
        const dayName = this.getDayName(date);
        const available = this.getAvailableClinicians(date, clinicians, requests);

        const results = [];

        coverageRequirements.forEach(requirement => {
            if (requirement.days && requirement.days.includes(dayName)) {
                const availableCount = available.length;
                const status = availableCount >= requirement.minClinicians ? 'met' : 'unmet';
                results.push({
                    requirement,
                    date,
                    availableCount,
                    requiredCount: requirement.minClinicians,
                    status,
                    shortfall: Math.max(0, requirement.minClinicians - availableCount)
                });
            }
        });

        return results;
    },

    /**
     * Get all coverage issues for a date range
     */
    getCoverageIssues(startDate, endDate, coverageRequirements, clinicians, requests) {
        const issues = [];
        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            const dayResults = this.checkCoverageForDate(
                currentDate,
                coverageRequirements,
                clinicians,
                requests
            );

            dayResults.forEach(result => {
                if (result.status === 'unmet') {
                    issues.push(result);
                }
            });

            currentDate = this.addDays(currentDate, 1);
        }

        return issues;
    },

    /**
     * Calculate overall coverage percentage for a period
     */
    calculateCoveragePercentage(startDate, endDate, coverageRequirements, clinicians, requests) {
        let totalRequirements = 0;
        let metRequirements = 0;

        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            const dayResults = this.checkCoverageForDate(
                currentDate,
                coverageRequirements,
                clinicians,
                requests
            );

            totalRequirements += dayResults.length;
            metRequirements += dayResults.filter(r => r.status === 'met').length;

            currentDate = this.addDays(currentDate, 1);
        }

        return totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 100;
    },

    // ===================================
    // Request Validation
    // ===================================

    /**
     * Validate a time-off request
     */
    validateRequest(request, settings, blackouts) {
        const errors = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);

        // Check dates are valid
        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date');
        }
        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date');
        }

        // Check end date is after start date
        if (endDate < startDate) {
            errors.push('End date must be after start date');
        }

        // Check minimum advance notice
        if (settings.minDaysAdvance) {
            const minDate = this.addDays(today, settings.minDaysAdvance);
            if (startDate < minDate) {
                errors.push(`Request must be submitted at least ${settings.minDaysAdvance} days in advance`);
            }
        }

        // Check maximum advance booking
        if (settings.maxDaysAdvance) {
            const maxDate = this.addDays(today, settings.maxDaysAdvance);
            if (startDate > maxDate) {
                errors.push(`Request cannot be more than ${settings.maxDaysAdvance} days in advance`);
            }
        }

        // Check request window
        if (settings.windowOpen && settings.windowClose) {
            const windowOpen = new Date(settings.windowOpen);
            const windowClose = new Date(settings.windowClose);
            if (today < windowOpen || today > windowClose) {
                errors.push(`Request window is only open from ${this.formatDate(windowOpen)} to ${this.formatDate(windowClose)}`);
            }
        }

        // Check blackout dates
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const isBlackedOut = blackouts.some(b => {
                const bStart = new Date(b.startDate);
                const bEnd = new Date(b.endDate);
                return currentDate >= bStart && currentDate <= bEnd;
            });
            if (isBlackedOut) {
                errors.push(`Requested dates include blackout period`);
                break;
            }
            currentDate = this.addDays(currentDate, 1);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Check for conflicts with existing requests
     */
    checkRequestConflicts(newRequest, existingRequests) {
        const conflicts = existingRequests.filter(existing => {
            if (existing.clinicianId !== newRequest.clinicianId) return false;
            if (existing.status === 'denied') return false;

            const newStart = new Date(newRequest.startDate);
            const newEnd = new Date(newRequest.endDate);
            const existStart = new Date(existing.startDate);
            const existEnd = new Date(existing.endDate);

            return newStart <= existEnd && newEnd >= existStart;
        });

        return conflicts;
    },

    // ===================================
    // Calendar Data Generation
    // ===================================

    /**
     * Generate calendar data for a month
     */
    generateCalendarMonth(year, month, requests) {
        const daysInMonth = this.getDaysInMonth(year, month);
        const firstDay = this.getFirstDayOfMonth(year, month);
        const days = [];

        // Previous month days
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevDaysInMonth = this.getDaysInMonth(prevYear, prevMonth);

        for (let i = firstDay - 1; i >= 0; i--) {
            const date = new Date(prevYear, prevMonth, prevDaysInMonth - i);
            days.push({
                date,
                dayNumber: prevDaysInMonth - i,
                isCurrentMonth: false,
                isToday: this.isToday(date),
                events: this.getEventsForDate(date, requests)
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            days.push({
                date,
                dayNumber: day,
                isCurrentMonth: true,
                isToday: this.isToday(date),
                events: this.getEventsForDate(date, requests)
            });
        }

        // Next month days
        const remainingDays = 42 - days.length; // 6 rows * 7 days
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;

        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(nextYear, nextMonth, day);
            days.push({
                date,
                dayNumber: day,
                isCurrentMonth: false,
                isToday: this.isToday(date),
                events: this.getEventsForDate(date, requests)
            });
        }

        return days;
    },

    /**
     * Get events (time-off requests) for a specific date
     */
    getEventsForDate(date, requests) {
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        return requests.filter(r => {
            const start = new Date(r.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(r.endDate);
            end.setHours(0, 0, 0, 0);
            return checkDate >= start && checkDate <= end;
        });
    },

    // ===================================
    // Statistics
    // ===================================

    /**
     * Get request statistics
     */
    getRequestStats(requests) {
        const now = new Date();
        const upcoming = requests.filter(r => {
            const start = new Date(r.startDate);
            return start >= now && r.status === 'approved';
        });

        return {
            total: requests.length,
            pending: requests.filter(r => r.status === 'pending').length,
            approved: requests.filter(r => r.status === 'approved').length,
            denied: requests.filter(r => r.status === 'denied').length,
            upcoming: upcoming.length,
            upcomingDays: upcoming.reduce((sum, r) => {
                return sum + this.getDaysBetween(r.startDate, r.endDate);
            }, 0)
        };
    },

    /**
     * Get clinician statistics
     */
    getClinicianStats(clinicianId, requests) {
        const clinicianRequests = requests.filter(r => r.clinicianId === clinicianId);
        return this.getRequestStats(clinicianRequests);
    },

    // ===================================
    // Shareable Link Generation
    // ===================================

    generateShareableLink(baseUrl) {
        const token = Storage.generateShareToken();
        const settings = Storage.getSettings();

        // Store the token in settings for validation
        settings.shareToken = token;
        Storage.saveSettings(settings);

        return `${baseUrl}/request.html?token=${token}`;
    },

    validateShareToken(token) {
        const settings = Storage.getSettings();
        return settings.shareToken === token;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Schedule;
}
