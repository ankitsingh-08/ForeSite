const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbType = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;

// Helper to run query regardless of SQL engine
async function query(sql, params = []) {
  if (dbType === 'mysql') {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  } else {
    return new Promise((resolve, reject) => {
      // Convert standard mysql parameters (?) to sqlite placeholders if necessary, 
      // sqlite3 uses ? as well, so standard queries are compatible.
      const action = sql.trim().toLowerCase().startsWith('select') ? 'all' : 'run';
      
      if (action === 'all') {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        sqliteDb.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ insertId: this.lastID, affectedRows: this.changes });
        });
      }
    });
  }
}

async function initDB() {
  const useMySQL = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

  if (useMySQL) {
    try {
      console.log('Attempting to connect to MySQL database at:', process.env.DB_HOST);
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      // Test connection
      await mysqlPool.query('SELECT 1');
      dbType = 'mysql';
      console.log('🚀 Connected to MySQL Database successfully!');
    } catch (e) {
      console.error('⚠️ MySQL Connection failed. Falling back to local SQLite database.', e.message);
      dbType = 'sqlite';
    }
  } else {
    dbType = 'sqlite';
  }

  if (dbType === 'sqlite') {
    const dbPath = path.join(__dirname, '../database.db');
    console.log('🚀 Initializing local SQLite database file at:', dbPath);
    sqliteDb = new sqlite3.Database(dbPath);
  }

  // Define database schemas
  const isMySQL = dbType === 'mysql';
  const autoIncrement = isMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';
  const primaryKey = isMySQL ? 'PRIMARY KEY' : 'PRIMARY KEY';
  const textType = isMySQL ? 'LONGTEXT' : 'TEXT';

  // Create tables
  await query(`
    CREATE TABLE IF NOT EXISTS machines (
      id VARCHAR(100),
      assetCode VARCHAR(100),
      name VARCHAR(255),
      model VARCHAR(255),
      type VARCHAR(255),
      status VARCHAR(50),
      hourMeter DOUBLE DEFAULT 0,
      fuelRate DOUBLE DEFAULT 0,
      productivity DOUBLE DEFAULT 0,
      productivityRate DOUBLE DEFAULT 0,
      fuelType VARCHAR(50),
      engineOperated BOOLEAN,
      siteName VARCHAR(255),
      breakdownHours DOUBLE DEFAULT 0,
      maintenanceHours DOUBLE DEFAULT 0,
      workingHours DOUBLE DEFAULT 0,
      availability DOUBLE DEFAULT 100,
      idleHours DOUBLE DEFAULT 0,
      totalExpense DOUBLE DEFAULT 0,
      itemExpense DOUBLE DEFAULT 0,
      fuelExpense DOUBLE DEFAULT 0,
      expensePerHr DOUBLE DEFAULT 0,
      versionMonth VARCHAR(50),
      PRIMARY KEY (id, versionMonth)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory (
      partId VARCHAR(100),
      name VARCHAR(255),
      category VARCHAR(100),
      quantity INT DEFAULT 0,
      minVal INT DEFAULT 5,
      maxVal INT DEFAULT 25,
      unitPrice DOUBLE DEFAULT 0.0,
      machineCompat VARCHAR(255),
      versionMonth VARCHAR(50),
      PRIMARY KEY (partId, versionMonth)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS breakdowns (
      id VARCHAR(100),
      machineId VARCHAR(100),
      partId VARCHAR(100),
      reason ${textType},
      date VARCHAR(50),
      downHours DOUBLE DEFAULT 0,
      severity VARCHAR(50),
      versionMonth VARCHAR(50),
      PRIMARY KEY (id, versionMonth)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS procurement (
      poId VARCHAR(100),
      prId VARCHAR(100),
      partId VARCHAR(100),
      partName VARCHAR(255),
      quantity INT DEFAULT 0,
      unitPrice DOUBLE DEFAULT 0.0,
      totalAmount DOUBLE DEFAULT 0.0,
      requestedBy VARCHAR(255),
      requestedDate VARCHAR(50),
      approvedDate VARCHAR(50),
      orderedDate VARCHAR(50),
      receivedDate VARCHAR(50),
      status VARCHAR(100),
      vendor VARCHAR(255),
      versionMonth VARCHAR(50),
      PRIMARY KEY (prId, versionMonth)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS indents (
      indentId VARCHAR(100),
      department VARCHAR(255),
      partId VARCHAR(100),
      partName VARCHAR(255),
      quantity INT DEFAULT 0,
      date VARCHAR(50),
      status VARCHAR(100),
      versionMonth VARCHAR(50),
      PRIMARY KEY (indentId, versionMonth)
    )
  `);

  // Audit History Table
  if (isMySQL) {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp VARCHAR(100),
        action VARCHAR(255),
        fileName VARCHAR(255),
        rowsAffected INT DEFAULT 0,
        details LONGTEXT
      )
    `);
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action TEXT,
        fileName TEXT,
        rowsAffected INTEGER DEFAULT 0,
        details TEXT
      )
    `);
  }

  // Create table to track available version months
  await query(`
    CREATE TABLE IF NOT EXISTS reporting_months (
      month VARCHAR(50) PRIMARY KEY
    )
  `);

  // Ensure default months are registered
  await query(`INSERT OR IGNORE INTO reporting_months (month) VALUES ('2026-05')`);
  await query(`INSERT OR IGNORE INTO reporting_months (month) VALUES ('2026-06')`);

  // For MySQL it would fail on INSERT OR IGNORE, let's fix it for both
  if (dbType === 'mysql') {
    await query(`INSERT IGNORE INTO reporting_months (month) VALUES ('2026-05')`);
    await query(`INSERT IGNORE INTO reporting_months (month) VALUES ('2026-06')`);
  }
}

module.exports = {
  initDB,
  query,
  getDbType: () => dbType
};
