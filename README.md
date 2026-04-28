# PriceWise — Grocery & Household Price Comparison App

A full-stack, production-grade mobile application helping customers find the cheapest supermarket for every item. Features OCR invoice scanning, real-time price comparison, shopping list optimisation, and an admin dashboard.

---

## Architecture Overview

```
PrasadMobileApp/
├── backend/          # Node.js + Express + Prisma + PostgreSQL API
├── mobile/           # React Native (Expo) mobile app
├── admin/            # React + Vite + TailwindCSS admin dashboard
└── docker-compose.yml
```

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo SDK 50), Zustand, React Navigation v6 |
| Backend API | Node.js, Express.js, Prisma ORM |
| Database | PostgreSQL |
| OCR | Tesseract.js (server-side) + Google Cloud Vision (optional) |
| Admin Dashboard | React 18, Vite, TailwindCSS, Recharts |
| Auth | JWT + bcryptjs |
| Maps | react-native-maps |
| Push Notifications | Expo Notifications |
| File Upload | Multer + local/S3 storage |

---

## Features

### Mobile App
- User registration & authentication
- Product search with filters
- Real-time price comparison across supermarkets
- Price history charts
- Shopping list creation & optimization (best store for all items)
- OCR invoice scanning (camera or gallery)
- Invoice review & submission
- Nearby supermarkets on map
- Favourite items with price drop alerts
- Notifications centre
- User profile management

### Admin Dashboard
- Overview analytics dashboard
- Product management (CRUD + bulk import)
- Supermarket & location management
- Price records management
- Invoice verification workflow
- User management
- Historical price reports
- Export data to CSV

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### 1. Database Setup
```bash
# Start PostgreSQL (or use docker-compose)
docker-compose up -d postgres

# Navigate to backend
cd backend
cp .env.example .env
# Edit .env with your database credentials

npm install
npx prisma migrate dev --name init
npx prisma db seed
```

### 2. Backend API
```bash
cd backend
npm run dev
# API runs on http://localhost:5000
```

### 3. Mobile App
```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go app
```

### 4. Admin Dashboard
```bash
cd admin
npm install
npm run dev
# Admin runs on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL="postgresql://user:password@localhost:5432/pricewise"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS="http://localhost:3000"
GOOGLE_CLOUD_VISION_KEY=""   # Optional: for better OCR
CROMP_OCR_API_URL=""         # Optional: external OCR endpoint URL
CROMP_OCR_API_KEY=""         # Optional: sent as x-api-key
CROMP_OCR_BEARER_TOKEN=""    # Optional: sent as Authorization: Bearer ...
CROMP_OCR_TIMEOUT_MS="30000" # Optional request timeout
CROMP_OCR_IMAGE_FIELD="imageBase64" # Optional JSON field name for base64 image payload
CROMP_OCR_TEXT_PATH=""       # Optional dot path to OCR text in response, e.g. data.text
GEMINI_API_KEY=""            # Optional: direct Gemini OCR (no custom endpoint needed)
GEMINI_MODEL="gemini-2.0-flash-lite"
GEMINI_TIMEOUT_MS="30000"
UPLOAD_DIR="./uploads"
```

### Mobile (`mobile/.env`)
```
EXPO_PUBLIC_API_URL="http://localhost:5000/api"
EXPO_PUBLIC_GOOGLE_MAPS_KEY=""
```

### Admin (`admin/.env`)
```
VITE_API_URL="http://localhost:5000/api"
```

---

## API Documentation

Base URL: `http://localhost:5000/api`

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/logout` | Logout |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/products` | List products (search, filter) |
| GET | `/products/:id` | Get product details |
| GET | `/products/:id/prices` | Get price comparison |
| GET | `/products/:id/history` | Price history |

### Shopping Lists
| Method | Endpoint | Description |
|---|---|---|
| GET | `/shopping-lists` | User's lists |
| POST | `/shopping-lists` | Create list |
| GET | `/shopping-lists/:id/optimize` | Get best store recommendation |

### Invoices
| Method | Endpoint | Description |
|---|---|---|
| POST | `/invoices/scan` | Upload & OCR invoice |
| GET | `/invoices` | User's invoices |
| PUT | `/invoices/:id/confirm` | Confirm extracted data |

---

## Database Schema

Key models: `User`, `Product`, `Supermarket`, `SupermarketLocation`, `Price`, `ShoppingList`, `ShoppingListItem`, `Invoice`, `InvoiceItem`, `Favourite`, `Notification`, `PriceAlert`

---

## Admin Default Credentials
```
Email: admin@pricewise.com
Password: Admin@123
```
⚠️ Change these immediately in production!

---

## OCR Invoice Scanning

The app supports two OCR methods:
1. **Tesseract.js** (default) — runs on your server, free, works offline
2. **Google Cloud Vision** — more accurate, requires API key
3. **External OCR API (optional)** — set `CROMP_OCR_API_URL` to use a third-party OCR endpoint first
4. **Gemini OCR (optional)** — set `GEMINI_API_KEY` to call Gemini directly from backend

The system extracts: store name, date, item names, quantities, unit prices, totals.

Provider selection order in backend:
1. `CROMP_OCR_API_URL` (if configured)
2. `GEMINI_API_KEY` (if configured)
3. `GOOGLE_CLOUD_VISION_KEY` (if configured)
4. Tesseract fallback

External OCR endpoint health-check:
```bash
cd backend
npm run ocr:check-external -- ../uploads/invoices/sample.jpg
```

This command sends the image to `CROMP_OCR_API_URL`, prints response keys,
and suggests the correct `CROMP_OCR_TEXT_PATH` if OCR text is found.

---

## Deployment

### Backend
```bash
cd backend
npm run build
npm start
```

### Admin
```bash
cd admin
npm run build
# Serve dist/ folder with nginx or any static host
```

### Mobile
```bash
cd mobile
eas build --platform all
```

---

## License
MIT
