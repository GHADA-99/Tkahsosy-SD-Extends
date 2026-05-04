# MedSync – Medical Synchronization Platform

A full-stack medical management application built with SAP Cloud Application Programming Model (CAP) v9, OpenUI5, and SQLite for development.

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- `@sap/cds` CLI: `npm install -g @sap/cds-dk`

## Quick Start

```bash
# 1. Install dependencies (already present)
npm install

# 2. Deploy the database schema and seed data
npm run deploy

# 3. Start the development server with live reload
npm run watch
```

The application will be available at **http://localhost:4004**.

## Application URLs

| App | URL |
|-----|-----|
| Launchpad | http://localhost:4004/app/index.html |
| Patients | http://localhost:4004/app/patients/webapp/index.html |
| Appointments | http://localhost:4004/app/appointments/webapp/index.html |
| Dashboard | http://localhost:4004/app/dashboard/webapp/index.html |
| Admin | http://localhost:4004/app/admin/webapp/index.html |
| OData Service | http://localhost:4004/api/ |
| OData Metadata | http://localhost:4004/api/$metadata |

## Project Structure

```
medsync/
├── db/
│   ├── data-model.cds          # CDS data model (entities)
│   └── csv/                    # Seed data CSV files
├── srv/
│   ├── medsync-service.cds     # OData v4 service definition
│   ├── data-service.js         # Patient/Doctor/MedicalRecord handlers
│   ├── appointment-service.js  # Appointment handlers & conflict detection
│   ├── notification-service.js # Notification handlers
│   └── utils/
│       ├── constants.js        # Shared constants
│       ├── validators.js       # Input validation functions
│       └── helpers.js          # Utility / helper functions
├── app/
│   ├── index.html              # Main launchpad
│   ├── patients/webapp/        # Patient management UI5 app
│   ├── appointments/webapp/    # Appointments UI5 app
│   ├── dashboard/webapp/       # KPI dashboard UI5 app
│   └── admin/webapp/           # Administration UI5 app
├── xs-security.json            # BTP XSUAA security config
├── mta.yaml                    # MTA deployment descriptor
├── .env.example                # Environment variables template
└── package.json
```

## Data Model

| Entity | Description |
|--------|-------------|
| Patients | Patient profiles with demographics and medical history |
| Doctors | Doctor profiles with specialization and license info |
| DoctorPatient | Many-to-many relationship between doctors and patients |
| Appointments | Scheduled medical appointments with conflict detection |
| MedicalRecords | Clinical records with confidentiality levels |
| Notifications | System notifications for patients and doctors |
| AuditLogs | Full audit trail of all data operations |

## User Roles

| Role | Permissions |
|------|-------------|
| `patient` | Read own data, view/create appointments |
| `doctor` | Manage patient records, appointments, medical records |
| `admin` | Full access including audit logs and system config |

## Running Tests

```bash
npm test
```

## Building for Production

```bash
npm run build
```

## Deployment to SAP BTP

1. Configure `xs-security.json` with your BTP subaccount details.
2. Update `mta.yaml` with correct service names.
3. Build and deploy using the MTA Build Tool:
   ```bash
   mbt build
   cf deploy mta_archives/medsync_1.0.0.mtar
   ```

## OData API Examples

```bash
# Get all patients
curl http://localhost:4004/api/Patients

# Get patient with appointments
curl "http://localhost:4004/api/Patients?$expand=appointments"

# Filter scheduled appointments
curl "http://localhost:4004/api/Appointments?\$filter=status eq 'scheduled'"

# Cancel an appointment (action)
curl -X POST "http://localhost:4004/api/Appointments(ID)/MedSyncService.cancelAppointment" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Patient request"}'
```
