const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'extractedAssetData.json');
const destPath = path.join(__dirname, 'mockDatabase.ts');
const accumulatedPath = path.join(__dirname, 'accumulatedDatabase.json');

if (!fs.existsSync(srcPath)) {
    console.error("Source extractedAssetData.json not found!");
    process.exit(1);
}

let fileContent = fs.readFileSync(srcPath, 'utf8');
if (fileContent.charCodeAt(0) === 0xFEFF) {
    fileContent = fileContent.slice(1);
}
const rawData = JSON.parse(fileContent);

// Default Seed Parts List
const defaultParts = [
  { partId: "P-101", name: "Hydraulic Pump Seal Kit", quantity: 12, minVal: 5, maxVal: 25, unitPrice: 150, category: "Hydraulics" },
  { partId: "P-102", name: "Hydraulic Cylinder Seal Kit", quantity: 8, minVal: 4, maxVal: 15, unitPrice: 220, category: "Hydraulics" },
  { partId: "P-103", name: "Engine Fuel Injector", quantity: 2, minVal: 5, maxVal: 12, unitPrice: 850, category: "Engine Parts" },
  { partId: "P-104", name: "Alternator 24V", quantity: 4, minVal: 2, maxVal: 8, unitPrice: 420, category: "Electrical" },
  { partId: "P-105", name: "Air Filter Assembly", quantity: 30, minVal: 10, maxVal: 50, unitPrice: 95, category: "Filters" },
  { partId: "P-106", name: "Oil Filter", quantity: 45, minVal: 20, maxVal: 80, unitPrice: 45, category: "Filters" },
  { partId: "P-107", name: "Hydraulic Hose 3/4 inch", quantity: 15, minVal: 8, maxVal: 30, unitPrice: 110, category: "Hydraulics" },
  { partId: "P-108", name: "Track Shoe Bolt", quantity: 350, minVal: 100, maxVal: 500, unitPrice: 2.50, category: "Undercarriage" },
  { partId: "P-109", name: "Starter Motor 24V", quantity: 1, minVal: 3, maxVal: 6, unitPrice: 650, category: "Electrical" },
  { partId: "P-110", name: "V-Belt Set", quantity: 10, minVal: 5, maxVal: 20, unitPrice: 60, category: "Engine Parts" },
  { partId: "P-111", name: "Radiator Hose Kit", quantity: 6, minVal: 4, maxVal: 12, unitPrice: 75, category: "Cooling" },
  { partId: "P-112", name: "Transmission Filter", quantity: 18, minVal: 8, maxVal: 30, unitPrice: 80, category: "Filters" },
  { partId: "P-113", name: "Bucket Teeth", quantity: 4, minVal: 10, maxVal: 30, unitPrice: 180, category: "Wear Parts" },
  { partId: "P-114", name: "Hydraulic Pump Assembly", quantity: 0, minVal: 1, maxVal: 3, unitPrice: 4500, category: "Hydraulics" },
];

const breakdownReasons = [
  "Hydraulic pump pressure drop due to seal wear",
  "Burst hydraulic feed hose at secondary boom",
  "Engine misfiring under full load due to clogged fuel injector",
  "Burnt winding on 24V alternator leading to battery charge failure",
  "Restricted airflow and engine power loss from dust-clogged filters",
  "Starter motor contacts pitted and failing to crank engine",
  "Snapping of engine cooling system drive v-belt",
  "Coolant leak at upper radiator hose clamp",
  "Transmission filter clogging triggering safety bypass mode",
  "Sheared bolts on crawler track assembly under heavy terrain load"
];

// Load existing accumulated database or initialize
let dbState = {
  machines: [],
  inventory: defaultParts,
  breakdowns: [],
  procurement: [
    { poId: "PO-2026-001", prId: "PR-2026-001", partId: "P-114", partName: "Hydraulic Pump Assembly", quantity: 2, unitPrice: 4500, totalAmount: 9000, requestedBy: "Hydraulics Team", requestedDate: "2026-05-05", approvedDate: "2026-05-08", orderedDate: "2026-05-10", receivedDate: "2026-05-18", status: "Acquisition_Completed", vendor: "Komatsu Heavy Parts Ltd" },
    { poId: "PO-2026-002", prId: "PR-2026-002", partId: "P-103", partName: "Engine Fuel Injector", quantity: 10, unitPrice: 850, totalAmount: 8500, requestedBy: "Engine Workshop", requestedDate: "2026-05-12", approvedDate: "2026-05-14", orderedDate: "2026-05-16", receivedDate: "", status: "Shipped", vendor: "CAT Parts International" },
    { poId: "PO-2026-003", prId: "PR-2026-003", partId: "P-109", partName: "Starter Motor 24V", quantity: 5, unitPrice: 650, totalAmount: 3250, requestedBy: "Electrical Dept", requestedDate: "2026-05-20", approvedDate: "2026-05-22", orderedDate: "2026-05-25", receivedDate: "", status: "PO_Issued", vendor: "Bosch Heavy Duty Store" },
  ],
  indents: [
    { indentId: "IND-2026-001", department: "Excavator Crew", partId: "P-106", partName: "Oil Filter", quantity: 10, date: "2026-05-31", status: "Issued" },
    { indentId: "IND-2026-002", department: "DT Workshop", partId: "P-105", partName: "Air Filter Assembly", quantity: 6, date: "2026-06-01", status: "Issued" },
  ]
};

if (fs.existsSync(accumulatedPath)) {
    try {
        dbState = JSON.parse(fs.readFileSync(accumulatedPath, 'utf8'));
    } catch (e) {
        console.warn("Could not read accumulatedDatabase.json, resetting to defaults.", e);
    }
}

// Map existing machines by ID
const machineMap = new Map(dbState.machines.map(m => [m.id, m]));

// Helper to determine active date (we'll generate dates for the current reporting month/year)
const dateObj = new Date();
const currentMonthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
const currentYear = dateObj.getFullYear();

let bdCounter = dbState.breakdowns.length + 1;

rawData.forEach(row => {
    const id = row["Asset Number"] || row["Asset Code"];
    if (!id) return;

    const assetName = row["Asset Name"] || "Drill Rig";
    const assetType = row["Asset Type"] || "Drilling Rig";
    const currentStatus = row["Current Status"] || "Active";
    
    // Parse numeric fields
    const closingHrs = parseFloat(row["Closing Hours"]) || parseFloat(row["Opening Hours"]) || 0;
    const workingHrs = parseFloat(row["Working hours"]) || 0;
    
    // Breakdown conversion from Excel day fraction to hours
    const bdFraction = parseFloat(row["Breakdown"]) || 0;
    const bdHours = parseFloat((bdFraction * 24).toFixed(1));

    const maintFraction = parseFloat(row["Maintenance Downtime"]) || 0;
    const maintHours = parseFloat((maintFraction * 24).toFixed(1));
    
    const fuelRate = parseFloat(row["Fuel Consumption"]) || 0;
    const productivityVal = parseFloat(row["Total Productivity"]) || 0;
    const productivityRate = parseFloat(row["Productivity Per Hr"]) || 0;
    const siteName = row["Site Name"] || "Default Site";

    let status = "Operating";
    if (currentStatus === "Idle") {
        status = "Idle";
    } else if (bdHours > 20 && Math.random() > 0.6) {
        status = "Breakdown";
    } else if (maintHours > 5 && Math.random() > 0.7) {
        status = "Maintenance";
    }

    const machine = {
        id: id,
        assetCode: row["Asset Code"] || "",
        name: `${assetName} (${id})`,
        model: assetName,
        type: assetType,
        status: status,
        hourMeter: Math.round(closingHrs),
        fuelRate: parseFloat(fuelRate.toFixed(1)),
        productivity: Math.round(productivityVal),
        productivityRate: parseFloat(productivityRate.toFixed(2)),
        fuelType: "Diesel",
        engineOperated: fuelRate > 0,
        siteName: siteName,
        breakdownHours: bdHours,
        maintenanceHours: maintHours,
        workingHours: workingHrs
    };

    if (machineMap.has(id)) {
        // Update existing machine
        Object.assign(machineMap.get(id), machine);
    } else {
        // Add new machine
        dbState.machines.push(machine);
        machineMap.set(id, machine);
    }

    // Append breakdown if new breakdown downtime is recorded
    if (bdHours > 0) {
        // Map a random part and reason for breakdown log
        const randomPart = dbState.inventory[Math.floor(Math.random() * dbState.inventory.length)];
        const reason = breakdownReasons[Math.floor(Math.random() * breakdownReasons.length)];
        
        // Random date in the current reporting month
        const randDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const randDate = `${randDay}-${currentMonthStr}-${currentYear}`;

        // Verify if a breakdown with the same machine and date already exists to prevent duplicate runs
        const isDuplicate = dbState.breakdowns.some(b => b.machineId === id && b.date === randDate && Math.abs(b.downHours - bdHours) < 0.1);
        if (!isDuplicate) {
            dbState.breakdowns.push({
                id: `BD-${String(bdCounter++).padStart(3, '0')}`,
                machineId: id,
                partId: randomPart.partId,
                reason: `${reason} (Site: ${siteName})`,
                date: randDate,
                downHours: bdHours,
                severity: bdHours > 48 ? "Critical" : (bdHours > 24 ? "High" : "Medium")
            });
        }
    }
});

// Seed parts compatibility mapping dynamically
dbState.inventory.forEach(p => {
    const models = Array.from(new Set(dbState.machines.map(m => m.model))).slice(0, 4);
    p.machineCompat = models.join(", ");
});

// Save the persistent JSON file
fs.writeFileSync(accumulatedPath, JSON.stringify(dbState, null, 2), 'utf8');

// Generate the final mockDatabase.ts
const databaseTSContent = `// Seeded Database containing actual machine telemetry and breakdowns from Excel
// Consolidated from Asset_Performance_Matrix_Report.xlsx
import { Machine, InventoryItem, BreakdownIncident, ProcurementRecord, IndentRequest, DatabaseState } from './types/database';

const INITIAL_MACHINES: Machine[] = ${JSON.stringify(dbState.machines, null, 2)};

const INITIAL_INVENTORY: InventoryItem[] = ${JSON.stringify(dbState.inventory, null, 2)};

const INITIAL_BREAKDOWNS: BreakdownIncident[] = ${JSON.stringify(dbState.breakdowns, null, 2)};

const INITIAL_PROCUREMENT: ProcurementRecord[] = ${JSON.stringify(dbState.procurement, null, 2)};

const INITIAL_INDENTS: IndentRequest[] = ${JSON.stringify(dbState.indents, null, 2)};

export const getStoredData = (): DatabaseState => {
  const machines = localStorage.getItem("gm_machines");
  const inventory = localStorage.getItem("gm_inventory");
  const breakdowns = localStorage.getItem("gm_breakdowns");
  const procurement = localStorage.getItem("gm_procurement");
  const indents = localStorage.getItem("gm_indents");

  if (!machines || !inventory || !breakdowns || !procurement || !indents) {
    localStorage.setItem("gm_machines", JSON.stringify(INITIAL_MACHINES));
    localStorage.setItem("gm_inventory", JSON.stringify(INITIAL_INVENTORY));
    localStorage.setItem("gm_breakdowns", JSON.stringify(INITIAL_BREAKDOWNS));
    localStorage.setItem("gm_procurement", JSON.stringify(INITIAL_PROCUREMENT));
    localStorage.setItem("gm_indents", JSON.stringify(INITIAL_INDENTS));

    return {
      machines: INITIAL_MACHINES,
      inventory: INITIAL_INVENTORY,
      breakdowns: INITIAL_BREAKDOWNS,
      procurement: INITIAL_PROCUREMENT,
      indents: INITIAL_INDENTS
    };
  }

  return {
    machines: JSON.parse(machines),
    inventory: JSON.parse(inventory),
    breakdowns: JSON.parse(breakdowns),
    procurement: JSON.parse(procurement),
    indents: JSON.parse(indents)
  };
};

export const updateStoredData = (key: string, data: any): void => {
  localStorage.setItem(\`gm_\${key}\`, JSON.stringify(data));
};
`;

fs.writeFileSync(destPath, databaseTSContent, 'utf8');
console.log(`Successfully generated accumulated database file with ${dbState.machines.length} machines and ${dbState.breakdowns.length} breakdowns.`);
