# Transaction Reconciliation Engine 🔄

## Project Overview
The Transaction Reconciliation Engine is a robust, production-grade Node.js backend system designed for the KoinX assignment. It processes and reconciles large batches of cryptocurrency transaction data between internal systems and external exchanges, flagging data disparities and exporting detailed mismatch reports dynamically.

## Tech Stack
- **Node.js** & **Express.js**: Core server and REST API infrastructure.
- **MongoDB** & **Mongoose**: Flexible NoSQL database modeling for mixed schema CSV payloads.
- **csv-parser** & **json2csv**: High-speed programmatic streams for digesting inputs and auditing CSV outputs.
- **Winston**: Advanced real-time and file-based payload logging system.

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/Priyanshu-1408/koinx
cd koinx
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and configure your specific MongoDB Atlas URI or keep the local instance:
```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.../koinx_reconciliation
TIMESTAMP_TOLERANCE_SECONDS=300
QUANTITY_TOLERANCE_PCT=0.01
```

### 4. Run the Engine
Ensure your `/data` folder is populated with standard CSVs and boot the application:
```bash
node server.js
```

## API Documentation

### 1. Submit a Reconciliation Run
- **POST** `/reconcile`
- **Description**: Triggers an asynchronous ingestion and matching job over the CSV pool data. 
- **Request Body** (Optional overrides):
```json
{
  "timestampToleranceSecs": 300,
  "quantityTolerancePct": 0.01
}
```
- **Response**: `202 Accepted`
```json
{
  "runId": "c56ca427-5086-42c8-b1e7-c9d63305e336",
  "status": "running"
}
```

### 2. Get Run Summary
- **GET** `/report/:runId/summary`
- **Response**: `200 OK`
```json
{
  "status": "completed",
  "matched": 1,
  "conflicting": 1,
  "unmatchedUser": 3,
  "unmatchedExchange": 3
}
```

### 3. Fetch Unmatched Records
- **GET** `/report/:runId/unmatched`
- **Description**: Returns all isolated drops explicitly parsed via category logic.
- **Response**: `200 OK`
```json
{
  "data": [
    {
      "category": "unmatched_user",
      "reason": "No matching transaction found on exchange (Step C)",
      "userTransaction": { "txId": "U3", "asset": "DOGE", "quantity": -1 },
      "exchangeTransaction": null,
      "diffFields": []
    }
  ]
}
```

### 4. Paginated Master Report
- **GET** `/report/:runId?page=1&limit=50`
- **Description**: Returns a full dynamic scale-pagination of all ReportEntries assigned to a run.
- **Response**: `200 OK`
```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 50, "total": 8, "pages": 1 }
}
```

## Configuration

The matching algorithm intelligently adapts via tolerances mapped dynamically in `.env` configurations:
- `TIMESTAMP_TOLERANCE_SECONDS` (default: 300): The timing threshold to allow latency between execution platforms. 
- `QUANTITY_TOLERANCE_PCT` (default: 0.01): The percentage discrepancy threshold permitted natively across volumes/fees before a successful `proximity` structural match is actively downgraded to a `conflicting` state category.

## Key Design Decisions

- **Why MongoDB?**: Cryptocurrency ledgers directly output highly unstructured, missing, or malformed data depending on differing exchange mechanics. A universally flexible NoSQL document schema guarantees we capture the intact `rawRow` context seamlessly without dropping schema failures in a relational strict column map.
- **Async Reconciliation**: Data jobs deliberately detach from the standard HTTP execution cycle. Processing `POST /reconcile` immediately triggers a `202 Accepted` universally confirming the UUID hook, freeing Node to crunch the heavy parallel-mapped CSV file arrays entirely inside a background Async IIFE module natively mapping outputs.
- **Two-Pass Matching Algorithm**: Processing matches divide symmetrically into computational tiers. `Step A` explicitly filters identical internal representations via string `txId` hits first. `Step B` computes an aggressive proximity formula mapping algorithms across identical aliases uniformly. 
- **Type Mapping Strategy**: External transactions utilize opposing definitions naturally (`TRANSFER_IN` on receiving vs `TRANSFER_OUT` pointing to the sender). The engine handles these internally by structurally bridging the directional perspectives automatically during comparison limits logic!
- **Data Quality ("Flag, Don't Drop")**: Failed records or universally incorrect numerical blocks (e.g., negative fees, unparseable ISO strings) permanently retain validation tracking. `isFlagged` natively captures what broke data boundaries so human audits preserve data provenance entirely.

## Project Structure
```text
koinx/
├── package.json
├── server.js 
├── app.js
├── .env
├── data/
│   ├── user_transactions.csv
│   └── exchange_transactions.csv
├── reports/
│   └── c56ca427...csv 
└── src/
    ├── config/
    │   ├── db.js
    │   └── tolerances.js
    ├── controllers/
    │   ├── reconcileController.js
    │   └── reportController.js
    ├── models/
    │   ├── ReconciliationRun.js
    │   ├── Report.js
    │   └── Transaction.js
    ├── routes/
    │   ├── reconcile.js
    │   └── report.js
    ├── services/
    │   ├── ingestionService.js
    │   ├── matchingService.js
    │   └── reportService.js
    └── utils/
        ├── assetAliases.js
        └── logger.js
```

## Sample Reconciliation Output

*(Saved structurally as standard comma-separated text into the `/reports` directory natively via `json2csv`)*

```csv
"category","reason","user_txId","user_timestamp","user_type","user_asset","user_quantity","user_price","user_fee","exchange_txId","exchange_timestamp","exchange_type","exchange_asset","exchange_quantity","exchange_price","exchange_fee","diffFields"
"matched","Exact txId match","U2","2023-01-01T11:00:00.000Z","BUY","ETH",10,1500,5,"U2","2023-01-01T11:00:05.000Z","BUY","ETH",10,1500,5,""
"matched","Proximity match","U1","2023-01-01T10:00:00.000Z","TRANSFER_OUT","BTC",0.5,20000,0,"E1","2023-01-01T10:01:00.000Z","TRANSFER_IN","BTC",0.5,20000,0,""
"conflicting","Matched via 'proximity', but price/fee exceeded tolerance","U4","2023-01-01T13:00:00.000Z","SELL","BTC",1,21000,10,"E3","2023-01-01T13:00:00.000Z","SELL","BTC",1,21005,10,"[{""field"":""price"",""userValue"":21000,""exchangeValue"":21005}]"
"unmatched_user","No matching transaction found on exchange (Step C)","U3","2023-01-01T12:00:00.000Z","BUY","DOGE",-1,0,0,"","","","","","","",""
```
