# Smart Healthcare System

A smart healthcare management system designed to manage operation rooms, surgeries, assets/equipment, and verification workflows, with backend APIs and ML-powered predictive maintenance.

This project was developed as a senior graduation project.

---

## Overview
The system provides a backend API and supporting services to help hospitals:
- Manage operation rooms, surgeries, and medical procedures
- Track assets and equipment usage (including outbound workflows)
- Control access using authentication and role-based permissions
- Integrate ML models to predict equipment maintenance needs

---

## My Role
I was primarily responsible for the **backend development** and system integration.

### What I built
- Django REST API with authentication and role-based access control (admin, staff, users)
- Core backend services for:
  - Operation room and surgery management
  - Asset and equipment tracking
  - Outbound and verification workflows
- REST endpoints, serializers, permissions, pagination, and service layers
- Real-time verification and polling mechanisms with proper error handling
- ML-powered predictive maintenance integration via API endpoints
- Database models, migrations, and serializer tests
- Clean project structure and git hygiene (.gitignore, DB files, secrets)

---

## Tech Stack
### Backend
- Python
- Django
- Django REST Framework

### Database & Infrastructure
- SQLite (development)
- Token-based authentication

### Frontend
- Angular

### Machine Learning
- Predictive maintenance model
- Model training + metrics
- Backend API integration

---

## System Features
- Authentication and role-based authorization
- Operation room and surgery management
- Equipment and asset tracking
- Verification and polling system
- Admin dashboard support
- Predictive maintenance for medical equipment

---

## Project Structure

```text
smart-healthcare-system/
├─ Back-End/                         
│  ├─ back_end/                      
│  │  ├─ settings.py
│  │  ├─ urls.py
│  │  ├─ asgi.py
│  │  └─ wsgi.py
│  │
│  ├─ or_managements/                # Main domain app
│  │  ├─ models/                     # Database models
│  │  ├─ serializers/                # DRF serializers
│  │  ├─ views/                      # API views
│  │  ├─ permissions/                # Custom permissions
│  │  ├─ services/                   # Business logic layer
│  │  ├─ scripts/                    # Helper / integration scripts
│  │  ├─ tests/                      
│  │  ├─ admin.py
│  │  ├─ apps.py
│  │  └─ urls.py
│  │
│  └─ manage.py
│
├─ Front-End/                        
│
├─ ML/                               
│
├─ data/synthetic/                   
├─ docs/                             
├─ requirements.txt
└─ README.md
```




---

## Getting Started (Backend)

### Prerequisites
- Python 3.10+
- pip
- virtualenv (recommended)

### Setup
```bash
git clone https://github.com/7amziiiii/smart-healthcare-system.git
cd smart-healthcare-system/Back-End

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py runserver
