# PD Project - SQL Normalization & Import (ExpertSoft)

## Description
This project implements a solution to import, normalize and manage transaction data provided in an Excel file (Nequi/Daviplata fintech data). It includes:
- Database DDL (MySQL)
- Import scripts for Excel/CSV
- Express API with CRUD for customers
- A minimal frontend dashboard for customers
- Reports endpoints for advanced queries required by the assignment

## Quick start
1. Install dependencies:
```bash
npm install
```

2. Create DB and tables:
```sql
SOURCE sql/schema.sql;
```

3.  your `.env` based on `.env.example` and set DB credentials.

4. Run in development:
```bash
npm run dev
```

5. Import the provided Excel locally:
```bash
npm run import
# or
node src/import_excel.js ./data/data.xlsx
```

6. Alternatively import via API (POST /api/import) with multipart form-data field `file`.

## Endpoints
- CRUD customers: GET/POST/PUT/DELETE `/api/customers`
- Import: POST `/api/import` (file field `file`)
- Reports:
  - GET `/reports/total-paid`
  - GET `/reports/pending-invoices`
  - GET `/reports/transactions-by-platform?platform=Nequi`

## Notes
- All table/column names are in English.
- The import scripts expect Excel headers as in the provided file (Spanish headers). If headers change, update `src/import_excel.js` and `/src/index.js` import logic.
- The project uses `INSERT IGNORE` to avoid duplicate-key errors; change to `ON DUPLICATE KEY UPDATE` if you want upserts.

## Developer
- Name: (fill your name)
- Clan: (fill clan)
- Email: (fill email)

## structure
- data: have are composed by one data.xlsx file and and diagram with relational model of the estructure of database.
- server: in my server are the opretions with the crud. at the time conecting with database and run the port of the project.
- src: db.js this file import the dependiencies that are necesary in our project. also have the routes that are esentials. have the import 
