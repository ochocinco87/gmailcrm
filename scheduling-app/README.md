# Clinician Scheduling App

A web application for managing clinician scheduling and time-off requests in a healthcare department.

## Features

- **Dashboard**: Overview of pending requests, coverage status, and upcoming time off
- **Calendar View**: Visual calendar showing all approved and pending time off
- **Time Off Requests**: Submit, approve, deny, and manage time-off requests
- **Coverage Requirements**: Define minimum staffing requirements by location and time
- **Location Management**: Manage multiple clinic/hospital locations
- **Clinician Directory**: Manage clinician profiles and view their request history
- **Shareable Links**: Generate links for clinicians to submit requests
- **Blackout Dates**: Define periods when time off cannot be requested
- **Request Window**: Configure when the request submission window is open

## Quick Start

### Option 1: Run with Node.js Server (Recommended)

```bash
cd scheduling-app
npm start
```

Then open http://localhost:3000 in your browser.

### Option 2: Open directly in browser

Simply open `index.html` in your web browser. Note that some features like email invitations won't work without the server.

## Usage

### For Managers

1. **Add Clinicians**: Go to Clinicians tab and add your team members
2. **Add Locations**: Go to Locations tab and add your clinic/hospital sites
3. **Set Coverage Requirements**: Go to Coverage tab and define minimum staffing needs
4. **Configure Settings**: Set request windows, blackout dates, and department info
5. **Share Request Link**: Click "Share Request Link" to generate a link for clinicians
6. **Review Requests**: Go to Time Off Requests to approve or deny submissions

### For Clinicians

1. Open the shared request link provided by your manager
2. Select your name from the dropdown (or add yourself if not listed)
3. Fill out the request form with dates and type of leave
4. Submit your request for manager review

## API Endpoints

The server provides a REST API for all operations:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/clinicians` | GET, POST | List/create clinicians |
| `/api/clinicians/:id` | GET, PUT, DELETE | Manage single clinician |
| `/api/requests` | GET, POST | List/create time-off requests |
| `/api/requests/:id` | GET, PUT, DELETE | Manage single request |
| `/api/locations` | GET, POST | List/create locations |
| `/api/locations/:id` | GET, PUT, DELETE | Manage single location |
| `/api/coverage` | GET, POST | List/create coverage requirements |
| `/api/coverage/:id` | GET, PUT, DELETE | Manage single coverage requirement |
| `/api/settings` | GET, PUT | Get/update department settings |
| `/api/blackouts` | GET, POST | List/create blackout dates |
| `/api/blackouts/:id` | DELETE | Delete blackout date |
| `/api/share` | GET, POST | Validate/create share tokens |
| `/api/send-invitations` | POST | Send email invitations |

## Data Storage

- **Browser Mode**: Data is stored in browser localStorage
- **Server Mode**: Data is stored in `data.json` file

## Configuration

### Settings

| Setting | Description |
|---------|-------------|
| Department Name | Displayed on request form |
| Manager Email | For notifications |
| Min Days Advance | Minimum notice required for requests |
| Max Days Advance | Maximum advance booking allowed |
| Window Open/Close | Restrict when requests can be submitted |

### Coverage Requirements

Define minimum clinician requirements for:
- Specific days of the week
- Time ranges (shifts)
- Different locations

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT
