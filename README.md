# Farm2Home

A farm-to-consumer marketplace for India: verified farms list their produce, customers buy from several farms in one checkout, each farm fulfils its own part, and administrators verify farms and moderate listings.

- **Website:** React 18 + TypeScript + Vite + Tailwind (`frontend/`)
- **API:** Django 5.2 + Django REST Framework, PostgreSQL (`backend/`)
- **Hosting:** AWS (CloudFront, S3, App Runner, RDS, SES) as Terraform code (`infra/terraform/`), deployed by GitHub Actions (`.github/workflows/`)

## Documentation

| Document | What's in it |
| --- | --- |
| [context/README.md](context/README.md) | Everything about the project: features, architecture, folder layout, data model, business and security rules, API overview, configuration, **running it locally from start to finish**, tests, troubleshooting |
| [context/AWS_SETUP.md](context/AWS_SETUP.md) | Which AWS products are used and why, **step-by-step AWS setup**, deployments, operations, backups, costs, security checklist |

## Quick start

```
# Terminal 1: API
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py createcachetable
python manage.py seed_demo --with-admin
python manage.py runserver

# Terminal 2: website
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Demo accounts use the password `FarmDemo2026`: `asha@demo.farm2home.example` (shopper), `greenvalley@demo.farm2home.example` (farm), `admin@demo.farm2home.example` (admin). In development, emails, including verification codes, are printed in the API terminal.

## Tests

```
cd backend && pytest                       # API (add: python scripts/test_postgres.py --migrations)
cd frontend && npm test                    # website unit and component tests
cd frontend && npm run test:e2e            # end-to-end journeys and accessibility audits
```
