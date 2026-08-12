import { Machine, InventoryItem, BreakdownIncident } from '../types/database';

// Helper to normalize keys (converts to lowercase, removes non-alphanumeric characters)
export const normalizeKey = (key: string): string => {
  if (!key) return '';
  return key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Helper to retrieve a value from a row object using a list of potential keys in their normalized forms
export const getRowVal = (row: any, keys: string[]): any => {
  if (!row || typeof row !== 'object') return undefined;
  const normalizedSearchKeys = keys.map(k => normalizeKey(k));
  
  for (const rawKey of Object.keys(row)) {
    if (normalizedSearchKeys.includes(normalizeKey(rawKey))) {
      return row[rawKey];
    }
  }
  return undefined;
};

// Helper to dynamically load SheetJS from CDN when needed (e.g. if online and reading xlsx/xls)
export const loadSheetJS = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) {
      resolve((window as any).XLSX);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Failed to load SheetJS library from CDN. Verify internet connection or upload in CSV format instead."));
    document.head.appendChild(script);
  });
};

// Pure TypeScript CSV parser that works 100% offline
export const parseCSV = (text: string): any[] => {
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines: string[] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField.trim());
      if (row.length > 0 && row.some(x => x !== '')) {
        lines.push(JSON.stringify(row));
      }
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    lines.push(JSON.stringify(row));
  }

  if (lines.length < 2) return [];
  const headerRow = JSON.parse(lines[0]);
  const records: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const dataRow = JSON.parse(lines[i]);
    const record: any = {};
    headerRow.forEach((header: string, index: number) => {
      record[header] = dataRow[index] !== undefined ? dataRow[index] : '';
    });
    records.push(record);
  }
  return records;
};

// Merges performance rows into existing machines index
export const mergePerformanceData = (existingMachines: Machine[], newRows: any[]): Machine[] => {
  const machineMap = new Map(existingMachines.map(m => [m.id.toLowerCase(), m]));
  const result = [...existingMachines];

  newRows.forEach(row => {
    const id = getRowVal(row, ["Asset Number", "Asset Code", "Asset ID", "id", "AssetNumber", "AssetCode", "AssetID"]);
    if (!id) return;

    const idStr = id.toString().trim();
    const assetName = getRowVal(row, ["Asset Name", "Name", "model", "AssetName"]) || "Drill Rig";
    const assetType = getRowVal(row, ["Asset Type", "Type", "AssetType"]) || "Drilling Rig";
    const currentStatus = getRowVal(row, ["Current Status", "Status", "CurrentStatus"]) || "Active";

    const closingHrs = parseFloat(getRowVal(row, ["Closing Hours", "ClosingHours"])) || parseFloat(getRowVal(row, ["Opening Hours", "OpeningHours"])) || 0;
    const workingHrs = parseFloat(getRowVal(row, ["Working hours", "Workinghours"])) || 0;

    const bdFraction = parseFloat(getRowVal(row, ["Breakdown", "wclbreakdown", "breakdownmaintenance"])) || 0;
    const bdHours = bdFraction > 0 ? (bdFraction < 1 ? parseFloat((bdFraction * 24).toFixed(1)) : bdFraction) : 0;

    const maintFraction = parseFloat(getRowVal(row, ["Maintenance Downtime", "Weekly Maintenance", "Schedule Maintenance", "Preventive Maintenance", "Unplanned/Opportunity  Maintenance", "General Checking"])) || 0;
    const maintHours = maintFraction > 0 ? (maintFraction < 1 ? parseFloat((maintFraction * 24).toFixed(1)) : maintFraction) : 0;

    const fuelRate = parseFloat(getRowVal(row, ["Fuel Consumption", "Fuel consumed", "FuelConsumption"])) || 0;
    const productivityVal = parseFloat(getRowVal(row, ["Total Productivity", "Utilization", "Productivity"])) || 0;
    const productivityRate = parseFloat(getRowVal(row, ["Productivity Per Hr", "ProductivityPerHr"])) || 0;
    const siteName = getRowVal(row, ["Site Name", "SiteName"]) || "Default Site";

    let status: 'Operating' | 'Breakdown' | 'Maintenance' | 'Idle' = "Operating";
    if (currentStatus === "Idle") {
      status = "Idle";
    } else if (bdHours > 20) {
      status = "Breakdown";
    } else if (maintHours > 5) {
      status = "Maintenance";
    }

    const machine: Machine = {
      id: idStr,
      assetCode: (getRowVal(row, ["Asset Code", "AssetCode"]) || "").toString().trim(),
      name: `${assetName} (${idStr})`,
      model: assetName.toString().trim(),
      type: assetType.toString().trim(),
      status: status,
      hourMeter: Math.round(closingHrs),
      fuelRate: parseFloat(fuelRate.toFixed(1)),
      productivity: Math.round(productivityVal),
      productivityRate: parseFloat(productivityRate.toFixed(2)),
      fuelType: "Diesel",
      engineOperated: fuelRate > 0,
      siteName: siteName.toString().trim(),
      breakdownHours: bdHours,
      maintenanceHours: maintHours,
      workingHours: workingHrs
    };

    const key = idStr.toLowerCase();
    if (machineMap.has(key)) {
      Object.assign(machineMap.get(key)!, machine);
    } else {
      result.push(machine);
      machineMap.set(key, machine);
    }
  });

  return result;
};

// Merges breakdown ticket rows into breakdowns registers
export const mergeBreakdownsData = (
  existingBreakdowns: BreakdownIncident[],
  newRows: any[],
  inventory: InventoryItem[]
): BreakdownIncident[] => {
  const result = [...existingBreakdowns];
  let bdCounter = result.length + 1;

  newRows.forEach(row => {
    const machineId = getRowVal(row, ["Rig no", "Machine ID", "Asset Name", "Machine", "machineId", "Local Name", "Rig", "Rigno", "LocalName"]);
    if (!machineId) return;

    const machineIdStr = machineId.toString().trim();
    const rawDate = getRowVal(row, ["Date", "Incident Date", "Fault Date", "BD date & time", "BD Start Time", "IncidentDate", "FaultDate", "BDdate"]) || new Date().toISOString().split('T')[0];
    const rawHours = parseFloat(getRowVal(row, ["Breakdown Hours", "Downtime", "bdHours", "bdHrs", "Total BD Hours", "BD Hours", "BD Hrs", "TotalBDHours"])) || 0;
    const partNameOrId = getRowVal(row, ["Part Name", "Part ID", "Defect Code", "Defect Codes", "Category", "BD Category", "PartName", "PartID", "DefectCode", "DefectCodes", "BDCategory"]) || "Mechanical";
    const reason = getRowVal(row, ["Remarks", "Fault Reason", "Reason", "FaultReason", "RemarksDescription"]) || "Breakdown reported";
    const severity = rawHours > 48 ? "Critical" : (rawHours > 24 ? "High" : "Medium");

    let matchedPart = inventory.find(p =>
      p.partId.toLowerCase() === partNameOrId.toString().toLowerCase() ||
      p.name.toLowerCase().includes(partNameOrId.toString().toLowerCase())
    );
    const partId = matchedPart ? matchedPart.partId : "P-101";

    let formattedDate = rawDate.toString().trim();
    const dateMatch = formattedDate.match(/^(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/);
    if (dateMatch) {
      formattedDate = dateMatch[1];
    }

    let processedReason = reason.toString().trim();
    if (processedReason === "Breakdown reported" || !processedReason) {
      const site = getRowVal(row, ["Site Name", "Site name", "Site"]);
      const model = getRowVal(row, ["Model"]);
      const zone = getRowVal(row, ["Zone"]);
      if (site || model || zone) {
        processedReason = `Site: ${site || ''}. Model: ${model || ''}. Zone: ${zone || ''}.`.trim();
      } else {
        processedReason = "Breakdown reported";
      }
    }

    const isDuplicate = result.some(b =>
      b.machineId.toLowerCase() === machineIdStr.toLowerCase() &&
      b.date === formattedDate &&
      Math.abs(b.downHours - rawHours) < 0.1
    );

    if (!isDuplicate) {
      result.push({
        id: `BD-${String(bdCounter++).padStart(3, '0')}`,
        machineId: machineIdStr,
        partId: partId,
        reason: processedReason,
        date: formattedDate,
        downHours: rawHours,
        severity: severity as 'Low' | 'Medium' | 'High' | 'Critical'
      });
    }
  });

  return result;
};

// Merges parts rows into parts catalog
export const mergePartsData = (existingParts: InventoryItem[], newRows: any[]): InventoryItem[] => {
  const partsMap = new Map(existingParts.map(p => [p.partId.toLowerCase(), p]));
  const result = [...existingParts];

  newRows.forEach(row => {
    const partId = getRowVal(row, ["Part ID", "Code", "partId", "PartID", "id"]);
    if (!partId) return;

    const partIdStr = partId.toString().trim();
    const name = getRowVal(row, ["Part Name", "Name", "Description", "PartName"]) || "Unknown Part";
    const category = getRowVal(row, ["Category", "PartCategory"]) || "General";
    const quantity = parseInt(getRowVal(row, ["Quantity", "Available", "Stock"])) || 0;
    const minVal = parseInt(getRowVal(row, ["Min Val", "Min Limit", "Minimum", "MinVal", "MinLimit"])) || 5;
    const maxVal = parseInt(getRowVal(row, ["Max Val", "Max Limit", "Maximum", "MaxVal", "MaxLimit"])) || 25;
    const unitPrice = parseFloat(getRowVal(row, ["Unit Price", "Price", "Cost", "UnitPrice"])) || 0.0;

    const part: InventoryItem = {
      partId: partIdStr,
      name: name.toString().trim(),
      category: category.toString().trim(),
      quantity: quantity,
      minVal: minVal,
      maxVal: maxVal,
      unitPrice: unitPrice,
      machineCompat: "All"
    };

    const key = partIdStr.toLowerCase();
    if (partsMap.has(key)) {
      Object.assign(partsMap.get(key)!, part);
    } else {
      result.push(part);
      partsMap.set(key, part);
    }
  });

  return result;
};
