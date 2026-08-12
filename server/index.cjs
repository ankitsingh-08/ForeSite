const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db.cjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper to standardise column keys (similar to client normalization)
const normalizeKey = (key) => {
  if (!key) return '';
  return key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Helper to extract value using standard variants
const getRowVal = (row, keys) => {
  if (!row || typeof row !== 'object') return undefined;
  const normalizedSearchKeys = keys.map(k => normalizeKey(k));
  for (const rawKey of Object.keys(row)) {
    if (normalizedSearchKeys.includes(normalizeKey(rawKey))) {
      return row[rawKey];
    }
  }
  return undefined;
};



// Fallback local schema mapper when Gemini Key is not present or fails
function runLocalIngestMapper(fileName, headers) {
  const fileNormalized = fileName.toLowerCase();
  let category = 'machines';
  let mapping = {};

  if (fileNormalized.includes('bd') || fileNormalized.includes('breakdown') || fileNormalized.includes('ticket') || fileNormalized.includes('outage')) {
    category = 'breakdowns';
    headers.forEach(h => {
      const nh = normalizeKey(h);
      if (['slno', 'id', 'ticketid', 'ticketno'].includes(nh)) mapping[h] = 'id';
      else if (['localname', 'rigno', 'machineid', 'assetname', 'machine', 'rig'].includes(nh)) mapping[h] = 'machineId';
      else if (['partname', 'partid', 'defectcode', 'defectcodes', 'category', 'bdcategory'].includes(nh)) mapping[h] = 'partId';
      else if (['date', 'incidentdate', 'faultdate', 'bddate', 'bddatetime', 'incidentdatetime'].includes(nh)) mapping[h] = 'date';
      else if (['breakdownhours', 'bdhours', 'bdhrs', 'totalbdhours', 'downtime'].includes(nh)) mapping[h] = 'downHours';
      else if (['remarks', 'faultreason', 'reason', 'remarksdescription'].includes(nh)) mapping[h] = 'reason';
      else if (['severity', 'criticality'].includes(nh)) mapping[h] = 'severity';
    });
  } else if (fileNormalized.includes('part') || fileNormalized.includes('inventory') || fileNormalized.includes('stock') || fileNormalized.includes('warehouse')) {
    category = 'inventory';
    headers.forEach(h => {
      const nh = normalizeKey(h);
      if (['partid', 'code', 'id'].includes(nh)) mapping[h] = 'partId';
      else if (['partname', 'name', 'description'].includes(nh)) mapping[h] = 'name';
      else if (['category', 'partcategory'].includes(nh)) mapping[h] = 'category';
      else if (['quantity', 'available', 'stock', 'qty'].includes(nh)) mapping[h] = 'quantity';
      else if (['minval', 'minlimit', 'minimum'].includes(nh)) mapping[h] = 'minVal';
      else if (['maxval', 'maxlimit', 'maximum'].includes(nh)) mapping[h] = 'maxVal';
      else if (['unitprice', 'price', 'cost'].includes(nh)) mapping[h] = 'unitPrice';
      else if (['machinecompat', 'compatibility'].includes(nh)) mapping[h] = 'machineCompat';
    });
  } else if (fileNormalized.includes('procurement') || fileNormalized.includes('po') || fileNormalized.includes('pr') || fileNormalized.includes('indent') || fileNormalized.includes('requisition')) {
    category = 'procurement';
    headers.forEach(h => {
      const nh = normalizeKey(h);
      if (['poid', 'ponumber'].includes(nh)) mapping[h] = 'poId';
      else if (['prid', 'prnumber', 'indentid', 'indentnumber'].includes(nh)) mapping[h] = 'prId';
      else if (['partid', 'code'].includes(nh)) mapping[h] = 'partId';
      else if (['partname', 'name', 'item'].includes(nh)) mapping[h] = 'partName';
      else if (['quantity', 'qty'].includes(nh)) mapping[h] = 'quantity';
      else if (['unitprice', 'price', 'cost'].includes(nh)) mapping[h] = 'unitPrice';
      else if (['totalamount', 'total', 'costtotal'].includes(nh)) mapping[h] = 'totalAmount';
      else if (['requestedby', 'requester'].includes(nh)) mapping[h] = 'requestedBy';
      else if (['requesteddate', 'date'].includes(nh)) mapping[h] = 'requestedDate';
      else if (['approveddate'].includes(nh)) mapping[h] = 'approvedDate';
      else if (['ordereddate', 'podate'].includes(nh)) mapping[h] = 'orderedDate';
      else if (['receiveddate', 'receiptdate'].includes(nh)) mapping[h] = 'receivedDate';
      else if (['status', 'state'].includes(nh)) mapping[h] = 'status';
      else if (['vendor', 'supplier'].includes(nh)) mapping[h] = 'vendor';
    });
  } else {
    // Default to machines / telemetry
    category = 'machines';
    headers.forEach(h => {
      const nh = normalizeKey(h);
      if (['assetnumber', 'assetcode', 'assetid', 'id'].includes(nh)) mapping[h] = 'id';
      else if (['assetname', 'name', 'model'].includes(nh)) mapping[h] = 'name';
      else if (['assettype', 'type'].includes(nh)) mapping[h] = 'type';
      else if (['currentstatus', 'status'].includes(nh)) mapping[h] = 'status';
      else if (['closinghours', 'openinghours'].includes(nh)) mapping[h] = 'hourMeter';
      else if (['fuelconsumption', 'fuelconsumed'].includes(nh)) mapping[h] = 'fuelRate';
      else if (['totalproductivity', 'utilization', 'productivity'].includes(nh)) mapping[h] = 'productivity';
      else if (['productivityperhr'].includes(nh)) mapping[h] = 'productivityRate';
      else if (['sitename', 'site'].includes(nh)) mapping[h] = 'siteName';
      else if (['breakdown', 'wclbreakdown', 'breakdownhours'].includes(nh)) mapping[h] = 'breakdownHours';
      else if (['maintenancedowntime', 'weeklymaintenance', 'schedulemaintenance'].includes(nh)) mapping[h] = 'maintenanceHours';
      else if (['workinghours'].includes(nh)) mapping[h] = 'workingHours';
      else if (['availabilty', 'availability'].includes(nh)) mapping[h] = 'availability';
      else if (['idlehours'].includes(nh)) mapping[h] = 'idleHours';
      else if (['totalexpense'].includes(nh)) mapping[h] = 'totalExpense';
      else if (['itemexpense'].includes(nh)) mapping[h] = 'itemExpense';
      else if (['fuelexpense'].includes(nh)) mapping[h] = 'fuelExpense';
      else if (['expenseperhr'].includes(nh)) mapping[h] = 'expensePerHr';
    });
  }

  return { category, columnMapping: mapping };
}

// REST APIs

// 1. Get List of Reporting Months
app.get('/api/months', async (req, res) => {
  try {
    const rows = await db.query('SELECT month FROM reporting_months ORDER BY month DESC');
    const months = rows.map(r => r.month);
    res.json(months);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Database State (Cumulative or Monthly)
app.get('/api/database', async (req, res) => {
  const month = req.query.month || 'cumulative';
  const isCumulative = month === 'cumulative' || month === 'Cumulative';

  try {
    let machines = [];
    let inventory = [];
    let breakdowns = [];
    let procurement = [];
    let indents = [];

    if (isCumulative) {
      // Return cumulative aggregates
      const machinesRaw = await db.query('SELECT * FROM machines');
      const inventoryRaw = await db.query('SELECT * FROM inventory');
      breakdowns = await db.query('SELECT * FROM breakdowns ORDER BY date DESC');
      procurement = await db.query('SELECT * FROM procurement ORDER BY requestedDate DESC');
      indents = await db.query('SELECT * FROM indents ORDER BY date DESC');

      // Group machines by id to get aggregate hours/costs and latest status
      const machineMap = new Map();
      machinesRaw.forEach(m => {
        const idLower = m.id.toLowerCase();
        if (!machineMap.has(idLower)) {
          machineMap.set(idLower, {
            ...m,
            allMonths: [m.versionMonth],
            hourMeter: m.hourMeter, // Max
            workingHours: m.workingHours,
            breakdownHours: m.breakdownHours,
            maintenanceHours: m.maintenanceHours,
            idleHours: m.idleHours,
            availabilityList: [m.availability],
            totalExpense: m.totalExpense,
            itemExpense: m.itemExpense,
            fuelExpense: m.fuelExpense,
            latestMonth: m.versionMonth
          });
        } else {
          const existing = machineMap.get(idLower);
          existing.allMonths.push(m.versionMonth);
          existing.workingHours += m.workingHours;
          existing.breakdownHours += m.breakdownHours;
          existing.maintenanceHours += m.maintenanceHours;
          existing.idleHours += m.idleHours;
          existing.availabilityList.push(m.availability);
          existing.totalExpense += m.totalExpense;
          existing.itemExpense += m.itemExpense;
          existing.fuelExpense += m.fuelExpense;
          
          if (m.versionMonth > existing.latestMonth) {
            existing.latestMonth = m.versionMonth;
            existing.status = m.status;
            existing.siteName = m.siteName;
            existing.productivity = m.productivity;
            existing.fuelRate = m.fuelRate;
          }
          if (m.hourMeter > existing.hourMeter) {
            existing.hourMeter = m.hourMeter;
          }
        }
      });

      machines = Array.from(machineMap.values()).map(m => {
        const avgAvailability = m.availabilityList.reduce((sum, v) => sum + v, 0) / m.availabilityList.length;
        delete m.availabilityList;
        delete m.allMonths;
        delete m.latestMonth;
        return {
          ...m,
          availability: parseFloat(avgAvailability.toFixed(1))
        };
      });

      // Group inventory items by partId to get latest stock levels
      const partsMap = new Map();
      inventoryRaw.forEach(p => {
        const idLower = p.partId.toLowerCase();
        if (!partsMap.has(idLower) || p.versionMonth > partsMap.get(idLower).versionMonth) {
          partsMap.set(idLower, p);
        }
      });
      inventory = Array.from(partsMap.values());

    } else {
      // Retrieve records for specific month
      machines = await db.query('SELECT * FROM machines WHERE versionMonth = ?', [month]);
      inventory = await db.query('SELECT * FROM inventory WHERE versionMonth = ?', [month]);
      breakdowns = await db.query('SELECT * FROM breakdowns WHERE versionMonth = ? ORDER BY date DESC', [month]);
      procurement = await db.query('SELECT * FROM procurement WHERE versionMonth = ? ORDER BY requestedDate DESC', [month]);
      indents = await db.query('SELECT * FROM indents WHERE versionMonth = ? ORDER BY date DESC', [month]);
    }

    res.json({ machines, inventory, breakdowns, procurement, indents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Smart Data Ingestion Endpoint
app.post('/api/ingest', async (req, res) => {
  const { fileName, rows, month } = req.body;
  const versionMonth = month || new Date().toISOString().split('-').slice(0, 2).join('-'); // Default YYYY-MM

  if (!rows || rows.length === 0) {
    return res.status(400).json({ error: "No data rows provided" });
  }

  try {
    const headers = Object.keys(rows[0]);
    console.log(`⚙️ Using local rule-based mapper for ${fileName}...`);
    const mappingResult = runLocalIngestMapper(fileName, headers);

    const { category, columnMapping } = mappingResult;
    console.log(`📁 Ingesting file classified as [${category}] into version [${versionMonth}]`);

    // Ensure version month exists in registering table
    const dbType = db.getDbType();
    if (dbType === 'mysql') {
      await db.query('INSERT IGNORE INTO reporting_months (month) VALUES (?)', [versionMonth]);
    } else {
      await db.query('INSERT OR IGNORE INTO reporting_months (month) VALUES (?)', [versionMonth]);
    }

    let rowsAffected = 0;
    const isMySQL = dbType === 'mysql';
    const replaceWord = isMySQL ? 'REPLACE' : 'INSERT OR REPLACE';

    // Parse and load based on Category
    if (category === 'machines') {
      for (const row of rows) {
        // Map fields
        const id = getRowVal(row, [columnMapping["id"] || "Asset Number", "Asset Code", "id", "AssetNumber", "AssetCode"]);
        if (!id) continue;

        const idStr = id.toString().trim();
        const name = getRowVal(row, [columnMapping["name"] || "Asset Name", "Name", "model", "AssetName"]) || "Drill Rig";
        const model = name.toString().split(' ')[0] || "Drill Rig";
        const type = getRowVal(row, [columnMapping["type"] || "Asset Type", "Type"]) || "Drilling Rig";
        const currentStatus = getRowVal(row, [columnMapping["status"] || "Current Status", "Status"]) || "Active";
        const closingHrs = parseFloat(getRowVal(row, [columnMapping["hourMeter"] || "Closing Hours", "Opening Hours"])) || 0;
        const fuelRate = parseFloat(getRowVal(row, [columnMapping["fuelRate"] || "Fuel Consumption", "Fuel Rate"])) || 0;
        const productivity = parseFloat(getRowVal(row, [columnMapping["productivity"] || "Total Productivity", "Utilization"])) || 0;
        const productivityRate = parseFloat(getRowVal(row, [columnMapping["productivityRate"] || "Productivity Per Hr"])) || 0;
        const siteName = getRowVal(row, [columnMapping["siteName"] || "Site Name", "Site"]) || "Default Site";
        
        // Downtimes
        const bdFraction = parseFloat(getRowVal(row, [columnMapping["breakdownHours"] || "Breakdown", "BD Hours"])) || 0;
        const bdHours = bdFraction > 0 ? (bdFraction < 1 ? parseFloat((bdFraction * 24).toFixed(1)) : bdFraction) : 0;
        
        const maintFraction = parseFloat(getRowVal(row, [columnMapping["maintenanceHours"] || "Maintenance Downtime", "Maintenance"])) || 0;
        const maintHours = maintFraction > 0 ? (maintFraction < 1 ? parseFloat((maintFraction * 24).toFixed(1)) : maintFraction) : 0;
        
        const workingHrs = parseFloat(getRowVal(row, [columnMapping["workingHours"] || "Working hours"])) || 0;
        const availability = parseFloat(getRowVal(row, [columnMapping["availability"] || "Availabilty", "Availability"])) || 100;
        const idleHours = parseFloat(getRowVal(row, [columnMapping["idleHours"] || "Idle Hours"])) || 0;
        
        // Expenses
        const totalExpense = parseFloat(getRowVal(row, [columnMapping["totalExpense"] || "Total Expense", "Total Cost"])) || 0;
        const itemExpense = parseFloat(getRowVal(row, [columnMapping["itemExpense"] || "Item Expense", "Maintenance Cost"])) || 0;
        const fuelExpense = parseFloat(getRowVal(row, [columnMapping["fuelExpense"] || "Fuel Expense"])) || 0;
        const expensePerHr = parseFloat(getRowVal(row, [columnMapping["expensePerHr"] || "Expense Per Hr"])) || 0;

        let status = "Operating";
        if (currentStatus === "Idle") status = "Idle";
        else if (bdHours > 20) status = "Breakdown";
        else if (maintHours > 5) status = "Maintenance";

        await db.query(`
          ${replaceWord} INTO machines (
            id, assetCode, name, model, type, status, hourMeter, fuelRate, productivity, 
            productivityRate, fuelType, engineOperated, siteName, breakdownHours, 
            maintenanceHours, workingHours, availability, idleHours, totalExpense, 
            itemExpense, fuelExpense, expensePerHr, versionMonth
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          idStr, idStr, name, model, type, status, Math.round(closingHrs), fuelRate, Math.round(productivity),
          productivityRate, "Diesel", fuelRate > 0, siteName, bdHours,
          maintHours, workingHrs, availability, idleHours, totalExpense,
          itemExpense, fuelExpense, expensePerHr, versionMonth
        ]);
        rowsAffected++;
      }
    } 
    else if (category === 'breakdowns') {
      let bdCounter = rowsAffected + 1;
      for (const row of rows) {
        const machineId = getRowVal(row, [columnMapping["machineId"] || "Rig no", "Machine ID", "Local Name", "Asset Name", "Machine"]);
        if (!machineId) continue;

        const id = getRowVal(row, [columnMapping["id"] || "Sl. No.", "ID", "id"]) || `BD-AUTO-${String(bdCounter++).padStart(3, '0')}`;
        const rawDate = getRowVal(row, [columnMapping["date"] || "Date", "Incident Date", "BD date & time", "BD Start Time"]) || new Date().toISOString().split('T')[0];
        const rawHours = parseFloat(getRowVal(row, [columnMapping["downHours"] || "BD Hours", "Breakdown Hours", "Downtime"])) || 0;
        const partNameOrId = getRowVal(row, [columnMapping["partId"] || "Part Name", "Defect Code", "BD Category", "Category"]) || "Mechanical";
        const reason = getRowVal(row, [columnMapping["reason"] || "Remarks", "Fault Reason", "Reason"]) || "Breakdown reported";
        
        let formattedDate = rawDate.toString().trim();
        const dateMatch = formattedDate.match(/^(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/);
        if (dateMatch) formattedDate = dateMatch[1];

        const severity = rawHours > 48 ? "Critical" : (rawHours > 24 ? "High" : "Medium");

        await db.query(`
          ${replaceWord} INTO breakdowns (
            id, machineId, partId, reason, date, downHours, severity, versionMonth
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, machineId.toString().trim(), partNameOrId.toString().trim(), reason.toString().trim(), formattedDate, rawHours, severity, versionMonth]);
        
        // Automatically sync the machine status in db if breakdown is active
        if (rawHours > 24) {
          await db.query(`
            UPDATE machines SET status = 'Breakdown' WHERE id = ? AND versionMonth = ?
          `, [machineId.toString().trim(), versionMonth]);
        }
        rowsAffected++;
      }
    } 
    else if (category === 'inventory') {
      for (const row of rows) {
        const partId = getRowVal(row, [columnMapping["partId"] || "Part ID", "Code", "partId", "id"]);
        if (!partId) continue;

        const name = getRowVal(row, [columnMapping["name"] || "Part Name", "Name", "Description"]) || "Unknown Part";
        const cat = getRowVal(row, [columnMapping["category"] || "Category", "BD Category"]) || "General";
        const quantity = parseInt(getRowVal(row, [columnMapping["quantity"] || "Quantity", "Available", "Stock"])) || 0;
        const minVal = parseInt(getRowVal(row, [columnMapping["minVal"] || "Min Val", "Min Limit", "Minimum"])) || 5;
        const maxVal = parseInt(getRowVal(row, [columnMapping["maxVal"] || "Max Val", "Max Limit", "Maximum"])) || 25;
        const unitPrice = parseFloat(getRowVal(row, [columnMapping["unitPrice"] || "Unit Price", "Price", "Cost"])) || 0.0;
        const machineCompat = getRowVal(row, [columnMapping["machineCompat"] || "Compatible Machinery", "Compatibility"]) || "All";

        await db.query(`
          ${replaceWord} INTO inventory (
            partId, name, category, quantity, minVal, maxVal, unitPrice, machineCompat, versionMonth
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [partId.toString().trim(), name, cat, quantity, minVal, maxVal, unitPrice, machineCompat, versionMonth]);
        rowsAffected++;
      }
    } 
    else if (category === 'procurement') {
      for (const row of rows) {
        const prId = getRowVal(row, [columnMapping["prId"] || "PR Number", "prId", "prNumber", "indentId", "Indent ID"]);
        if (!prId) continue;

        // Is it store indent or PO?
        const isIndent = fileName.toLowerCase().includes('indent');

        if (isIndent) {
          const department = getRowVal(row, ["Department", "dept"]) || "General";
          const partId = getRowVal(row, ["Part ID", "code", "partId"]) || "P-101";
          const partName = getRowVal(row, ["Part Name", "name", "Item"]) || "Unknown Part";
          const quantity = parseInt(getRowVal(row, ["Quantity", "qty", "Stock"])) || 1;
          const date = getRowVal(row, ["Date Filed", "date"]) || new Date().toISOString().split('T')[0];
          const status = getRowVal(row, ["Status", "state"]) || "Approved";

          await db.query(`
            ${replaceWord} INTO indents (
              indentId, department, partId, partName, quantity, date, status, versionMonth
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [prId.toString().trim(), department, partId, partName, quantity, date, status, versionMonth]);
        } else {
          // Regular PO/PR
          const poId = getRowVal(row, [columnMapping["poId"] || "PO Number", "poId", "poNumber"]) || "";
          const partId = getRowVal(row, [columnMapping["partId"] || "Part ID", "code"]) || "P-101";
          const partName = getRowVal(row, [columnMapping["partName"] || "Part Name", "name"]) || "Unknown Part";
          const quantity = parseInt(getRowVal(row, [columnMapping["quantity"] || "Quantity", "qty"])) || 0;
          const unitPrice = parseFloat(getRowVal(row, [columnMapping["unitPrice"] || "Unit Price", "cost"])) || 0.0;
          const totalAmount = parseFloat(getRowVal(row, [columnMapping["totalAmount"] || "Total Amount", "total"])) || (quantity * unitPrice);
          const requestedBy = getRowVal(row, [columnMapping["requestedBy"] || "Requested By", "requester"]) || "Fleet Manager";
          const requestedDate = getRowVal(row, [columnMapping["requestedDate"] || "Requested Date", "date"]) || new Date().toISOString().split('T')[0];
          const approvedDate = getRowVal(row, [columnMapping["approvedDate"] || "Approved Date"]) || "";
          const orderedDate = getRowVal(row, [columnMapping["orderedDate"] || "Ordered Date"]) || "";
          const receivedDate = getRowVal(row, [columnMapping["receivedDate"] || "Received Date"]) || "";
          const status = getRowVal(row, [columnMapping["status"] || "Status"]) || "PO_Issued";
          const vendor = getRowVal(row, [columnMapping["vendor"] || "Vendor", "supplier"]) || "Global Parts Supply";

          await db.query(`
            ${replaceWord} INTO procurement (
              poId, prId, partId, partName, quantity, unitPrice, totalAmount, 
              requestedBy, requestedDate, approvedDate, orderedDate, receivedDate, 
              status, vendor, versionMonth
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            poId, prId.toString().trim(), partId, partName, quantity, unitPrice, totalAmount,
            requestedBy, requestedDate, approvedDate, orderedDate, receivedDate,
            status, vendor, versionMonth
          ]);
        }
        rowsAffected++;
      }
    }

    // Insert into Audit History
    const timestamp = new Date().toLocaleString();
    const detailLog = `Ingested spreadsheet ${fileName} under Month [${versionMonth}]. Classified as [${category}]. Columns mapped: ${JSON.stringify(columnMapping)}.`;
    await db.query(`
      INSERT INTO audit_history (timestamp, action, fileName, rowsAffected, details) 
      VALUES (?, ?, ?, ?, ?)
    `, [timestamp, "Data Ingestion (Spreadsheet Upload)", fileName, rowsAffected, detailLog]);

    res.json({
      success: true,
      category,
      rowsAffected,
      versionMonth,
      message: `Successfully mapped and loaded ${rowsAffected} records into database!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Audit Trail / History
app.get('/api/history', async (req, res) => {
  try {
    const history = await db.query('SELECT * FROM audit_history ORDER BY id DESC');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Start Server
db.initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`📡 Backend Server listening on http://localhost:${PORT}`);
  });
});
