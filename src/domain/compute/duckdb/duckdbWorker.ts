// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/duckdb/duckdbWorker.ts
// Privana DuckDB-WASM Worker Manager
// Encapsulates DuckDB WebAssembly lifecycle, VFS file registration, and query execution.
// ─────────────────────────────────────────────────────────────────────────────

import * as duckdb from '@duckdb/duckdb-wasm';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

/**
 * Initializes and returns the shared DuckDB-WASM database connection.
 * Resolves bundles automatically across Vite and browser environments.
 */
export async function getDuckDBConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (connInstance) return connInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Select the best bundle for the current browser/runtime (MVP vs EH - Exception Handling)
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.VoidLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    const conn = await db.connect();
    
    // Configure analytical memory and insertion order optimizations
    await conn.query(`SET preserve_insertion_order = false;`);

    dbInstance = db;
    connInstance = conn;
    return conn;
  })();

  return initPromise;
}

/**
 * Returns the active AsyncDuckDB instance.
 */
export async function getDuckDBInstance(): Promise<duckdb.AsyncDuckDB> {
  await getDuckDBConnection();
  return dbInstance!;
}

/**
 * Registers a native browser File object into DuckDB's virtual filesystem (VFS)
 * using the streaming BROWSER_FILEREADER protocol (no full string materialization).
 */
export async function registerVfsFile(tableName: string, file: File): Promise<void> {
  const db = await getDuckDBInstance();
  const conn = await getDuckDBConnection();

  // Register the file handle for paged lazy reads
  await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

  // Create an analytical view over the streaming file with resilient CSV parsing options
  await conn.query(`
    CREATE OR REPLACE VIEW "${tableName}" AS 
    SELECT * FROM read_csv_auto(
      '${file.name}',
      ignore_errors = true,
      null_padding = true,
      sample_size = 100000
    );
  `);
}

/**
 * Registers an in-memory row array as an ephemeral DuckDB table for testing or shadow comparison.
 */
export async function registerMemoryTable(tableName: string, rows: any[]): Promise<void> {
  const db = await getDuckDBInstance();
  const conn = await getDuckDBConnection();

  if (!rows || rows.length === 0) {
    await conn.query(`CREATE OR REPLACE TABLE "${tableName}" (dummy VARCHAR);`);
    return;
  }

  const jsonStr = JSON.stringify(rows);
  const fileName = `${tableName}.json`;
  await db.registerFileText(fileName, jsonStr);
  await conn.query(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${fileName}');`);
}
