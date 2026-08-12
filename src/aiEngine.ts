// AI Query Parser Engine for ForeSite
import { DatabaseState, Machine, InventoryItem } from './types/database';

export interface AIQueryResult {
  text: string;
  category?: string;
  structuredData?: Array<Record<string, string | number>>;
  chart?: {
    type: string;
    label: string;
    labels: string[];
    datasets: Array<{
      data: number[];
      backgroundColor: string;
      borderColor: string;
    }>;
  };
}

export const parseAIQuery = (query: string, database: DatabaseState): AIQueryResult => {
  const cleanQuery = query.toLowerCase().trim();
  const { machines, inventory, breakdowns, procurement, indents } = database;

  // Helpers
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const getMachineForms = (m: Machine): string[] => {
    const normId = normalize(m.id);
    const forms = [normId, normalize(m.name), normalize(m.model)];
    if (normId.startsWith('rig')) {
      forms.push(normId.replace(/^rig/, 'r'));
    } else if (normId.startsWith('r') && !normId.startsWith('rig')) {
      forms.push(normId.replace(/^r/, 'rig'));
    }
    return forms;
  };

  const getPartForms = (p: InventoryItem): string[] => {
    const normId = normalize(p.partId);
    const forms = [normId, normalize(p.name)];
    if (normId.startsWith('p') && /^\d/.test(normId.substring(1))) {
      forms.push('part' + normId.substring(1));
    } else if (normId.startsWith('part') && /^\d/.test(normId.substring(4))) {
      forms.push('p' + normId.substring(4));
    }
    return forms;
  };

  const findMachine = (q: string): Machine | undefined => {
    const normQuery = normalize(q);
    return machines.find(m =>
      getMachineForms(m).some(form => form.length > 0 && normQuery.includes(form))
    );
  };

  const findPart = (q: string): InventoryItem | undefined => {
    const normQuery = normalize(q);
    return inventory.find(p =>
      getPartForms(p).some(form => form.length > 0 && normQuery.includes(form))
    );
  };

  // 1. HELP / GREETINGS
  if (cleanQuery === "help" || cleanQuery.includes("what can you do") || cleanQuery.includes("capabilities")) {
    return {
      text: "I am ForeSite, your technical support assistant. Here is what I can help you with:\n\n" +
        "1. **Machinery Analytics**: Ask about machine productivity, status, and fuel consumption (e.g., *'Which machine consumes the most fuel?'* or *'What is the hour meter of EX-001?'*).\n" +
        "2. **Breakdown Diagnostic**: Query down times, reasons, or frequencies (e.g., *'Why did WL-003 break down?'* or *'Which parts fail the most?'*).\n" +
        "3. **Parts & Inventory Status**: Monitor levels and threshold alerts (e.g., *'List items below minimum stock'* or *'How many starter motors do we have?'*).\n" +
        "4. **Procurement Pipeline Tracking**: Track items from PR to PO to Acquisition (e.g., *'Track PO-2026-002'* or *'Show pending Purchase Requests'*).\n" +
        "5. **Store Indents**: Review department store requests (e.g., *'List pending indents'*).",
      category: "help"
    };
  }

  if (cleanQuery === "hi" || cleanQuery === "hello" || cleanQuery.includes("hey")) {
    return {
      text: "Hello! I am your ForeSite support assistant. How can I help you manage your fleet, check breakdowns, or track parts procurement today? Try asking: *'Which parts have the most breakdowns?'* or *'Track PO-2026-002'*.",
      category: "greeting"
    };
  }

  // 2. FUEL CONSUMPTION & ENGINE OPERATED
  if (cleanQuery.includes("fuel") || cleanQuery.includes("diesel") || cleanQuery.includes("consumption") || cleanQuery.includes("guzzler")) {
    const targetMachine = findMachine(cleanQuery);

    if (targetMachine) {
      if (!targetMachine.engineOperated) {
        return {
          text: `**${targetMachine.name}** (${targetMachine.model}) is an **Electric** machine and does not consume diesel fuel. It operates on grid/battery power with high efficiency.`,
          category: "fuel"
        };
      }
      return {
        text: `**${targetMachine.name}** (${targetMachine.model}) consumes **${targetMachine.fuelRate} L/h** of diesel fuel. Its current status is *${targetMachine.status}* and hour meter is *${targetMachine.hourMeter} hrs*.`,
        category: "fuel",
        structuredData: [
          { Parameter: "Machine ID", Value: targetMachine.id },
          { Name: targetMachine.name },
          { "Fuel Type": targetMachine.fuelType },
          { "Consumption Rate": `${targetMachine.fuelRate} Liters/hour` },
          { Productivity: `${targetMachine.productivity}%` }
        ]
      };
    }

    // Generic fuel query
    const dieselMachines = machines.filter(m => m.engineOperated && m.fuelRate > 0);
    const sortedByFuel = [...dieselMachines].sort((a, b) => b.fuelRate - a.fuelRate);

    return {
      text: `Among engine-operated machinery, **${sortedByFuel[0].name}** has the highest consumption rate of **${sortedByFuel[0].fuelRate} L/h**. Here is the diesel fuel consumption comparison:`,
      category: "fuel",
      structuredData: sortedByFuel.map(m => ({
        "Machine": m.name,
        "Model": m.model,
        "Fuel Rate (L/h)": m.fuelRate,
        "Productivity": `${m.productivity}%`,
        "Status": m.status
      })),
      chart: {
        type: "bar",
        label: "Fuel Consumption Rate (L/h)",
        labels: sortedByFuel.map(m => m.id),
        datasets: [{
          data: sortedByFuel.map(m => m.fuelRate),
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgb(59, 130, 246)"
        }]
      }
    };
  }

  // 3. BREAKDOWNS - REASONS, DURATION, FREQUENCY, PARTS AFFECTED
  if (cleanQuery.includes("breakdown") || cleanQuery.includes("fail") || cleanQuery.includes("broke") || cleanQuery.includes("down time") || cleanQuery.includes("down hours")) {
    const targetMachine = findMachine(cleanQuery);

    // Specific machine breakdown query
    if (targetMachine) {
      const machineBreakdowns = breakdowns.filter(b => b.machineId === targetMachine.id);
      const totalDownTime = machineBreakdowns.reduce((sum, b) => sum + b.downHours, 0);

      if (machineBreakdowns.length === 0) {
        return {
          text: `**${targetMachine.name}** has **no recorded breakdowns** in the log. Its status is currently *${targetMachine.status}* and its hour meter reads *${targetMachine.hourMeter} hrs*.`,
          category: "breakdowns"
        };
      }

      const activeBreakdown = machineBreakdowns.find(b => targetMachine.status === "Breakdown" && b.date === "2026-06-02" || b.severity === "Critical" || b.severity === "High");

      let detailsText = `**${targetMachine.name}** has broken down **${machineBreakdowns.length} time(s)**, remaining down for a total of **${totalDownTime} hours**.\n\n`;
      if (targetMachine.status === "Breakdown") {
        detailsText += `🚨 **Active Breakdown Alert**: The machine is currently DOWN. `;
        if (activeBreakdown) {
          const part = inventory.find(p => p.partId === activeBreakdown.partId);
          detailsText += `The failure occurred in the **${part ? part.name : 'Unknown Part'}** (Part ID: ${activeBreakdown.partId}).\n**Reason**: ${activeBreakdown.reason}.\n**Reported**: ${activeBreakdown.date}.\n`;
        }
      }

      return {
        text: detailsText + "\nHere are the breakdown logs for this machine:",
        category: "breakdowns",
        structuredData: machineBreakdowns.map(b => {
          const part = inventory.find(p => p.partId === b.partId);
          return {
            "Date": b.date,
            "Part Affected": part ? part.name : b.partId,
            "Reason": b.reason,
            "Down Hours": b.downHours,
            "Severity": b.severity
          };
        })
      };
    }

    // Top parts failing / Parts breakdown query
    if (cleanQuery.includes("part") || cleanQuery.includes("which part") || cleanQuery.includes("frequent") || cleanQuery.includes("frequency")) {
      const partCount: Record<string, number> = {};
      const partHours: Record<string, number> = {};
      breakdowns.forEach(b => {
        partCount[b.partId] = (partCount[b.partId] || 0) + 1;
        partHours[b.partId] = (partHours[b.partId] || 0) + b.downHours;
      });

      const sortedParts = Object.keys(partCount).map(partId => {
        const part = inventory.find(p => p.partId === partId);
        return {
          id: partId,
          name: part ? part.name : "Unknown Part",
          frequency: partCount[partId],
          totalDownHours: partHours[partId],
          avgDownHours: parseFloat((partHours[partId] / partCount[partId]).toFixed(1))
        };
      }).sort((a, b) => b.frequency - a.frequency);

      return {
        text: `The part with the most breakdowns is the **${sortedParts[0].name}** (Part ID: ${sortedParts[0].id}), failing **${sortedParts[0].frequency} times** and causing **${sortedParts[0].totalDownHours} hours** of downtime. Here is the part failure frequency log:`,
        category: "breakdowns",
        structuredData: sortedParts.map(p => ({
          "Part ID": p.id,
          "Part Name": p.name,
          "Failure Count": p.frequency,
          "Total Down Hours": p.totalDownHours,
          "Avg Down/Failure (hrs)": p.avgDownHours
        })),
        chart: {
          type: "bar",
          label: "Failure Frequency (Counts)",
          labels: sortedParts.map(p => p.name.split(" ")[0] + " " + p.id),
          datasets: [{
            data: sortedParts.map(p => p.frequency),
            backgroundColor: "rgba(239, 68, 68, 0.6)",
            borderColor: "rgb(239, 68, 68)"
          }]
        }
      };
    }

    // Generic breakdown summary query
    const totalDownHoursAll = breakdowns.reduce((sum, b) => sum + b.downHours, 0);
    const activeDown = machines.filter(m => m.status === "Breakdown");

    return {
      text: `Total cumulative fleet breakdown downtime is **${totalDownHoursAll} hours** across **${breakdowns.length} logged incidents**. Currently, **${activeDown.length} machine(s)** are in active breakdown status.\n\nHere are the most recent fleet breakdown incidents:`,
      category: "breakdowns",
      structuredData: breakdowns.slice(-5).reverse().map(b => {
        const m = machines.find(mac => mac.id === b.machineId);
        const p = inventory.find(part => part.partId === b.partId);
        return {
          "Machine": m ? m.name : b.machineId,
          "Part": p ? p.name : b.partId,
          "Reason": b.reason,
          "Downtime (hrs)": b.downHours,
          "Date": b.date
        };
      })
    };
  }

  // 4. HOUR METERS & PRODUCTIVITY
  if (cleanQuery.includes("hour meter") || cleanQuery.includes("hours") || cleanQuery.includes("productivity") || cleanQuery.includes("efficient")) {
    const targetMachine = findMachine(cleanQuery);

    if (targetMachine) {
      return {
        text: `**${targetMachine.name}** telemetry data:\n` +
          `- Hour Meter: **${targetMachine.hourMeter} hours**\n` +
          `- Productivity Index: **${targetMachine.productivity}%**\n` +
          `- Operational Status: **${targetMachine.status}**`,
        category: "telemetry",
        structuredData: [
          { Metric: "Hour Meter Reading", Value: `${targetMachine.hourMeter} hrs` },
          { Metric: "Productivity Index", Value: `${targetMachine.productivity}%` },
          { Metric: "Power Type", Value: targetMachine.fuelType },
          { Metric: "Status", Value: targetMachine.status }
        ]
      };
    }

    // Generic listing
    const sortedProductivity = [...machines].sort((a, b) => b.productivity - a.productivity);
    return {
      text: `The fleet's most productive machine is **${sortedProductivity[0].name}** operating at **${sortedProductivity[0].productivity}%** productivity. Here is the fleet telemetry summary:`,
      category: "telemetry",
      structuredData: sortedProductivity.map(m => ({
        "Machine ID": m.id,
        "Name": m.name,
        "Hour Meter (hrs)": m.hourMeter,
        "Productivity (%)": m.productivity,
        "Status": m.status
      })),
      chart: {
        type: "bar",
        label: "Productivity Rating (%)",
        labels: sortedProductivity.map(m => m.id),
        datasets: [{
          data: sortedProductivity.map(m => m.productivity),
          backgroundColor: "rgba(16, 185, 129, 0.6)",
          borderColor: "rgb(16, 185, 129)"
        }]
      }
    };
  }

  // 5. PROCUREMENT PIPELINE - PR -> PO -> ACQUISITION / RECEIPT
  if (
    cleanQuery.includes("purchase order") || 
    cleanQuery.includes("purchase request") || 
    cleanQuery.includes("procurement") || 
    cleanQuery.includes("track") ||
    /p[or][- ]?\d{4}[- ]?\d{3}/i.test(cleanQuery) ||
    cleanQuery.includes("po-") || 
    cleanQuery.includes("po ") || 
    cleanQuery.includes("pr-") || 
    cleanQuery.includes("pr ")
  ) {
    // Check for specific PO tracking (matches formats like PO-2026-002, PO2026002, po 2026 002)
    const poMatch = cleanQuery.match(/po[- ]?\d{4}[- ]?\d{3}/i);
    if (poMatch && poMatch[0]) {
      const normalizedMatch = poMatch[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const poRecord = procurement.find(p => p.poId && p.poId.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedMatch);
      const poCode = poRecord ? poRecord.poId : poMatch[0].toUpperCase();

      if (poRecord) {
        return {
          text: `### Procurement Tracking: ${poCode}\n` +
            `- **Status**: \`${poRecord.status.replace("_", " ")}\`\n` +
            `- **Part**: ${poRecord.partName} (Code: ${poRecord.partId})\n` +
            `- **Quantity**: ${poRecord.quantity} pcs\n` +
            `- **Vendor**: ${poRecord.vendor}\n` +
            `- **Request (PR)**: ${poRecord.prId} (Submitted: ${poRecord.requestedDate})\n` +
            `- **PO Issued**: ${poRecord.orderedDate || "N/A"}\n` +
            `- **Acquisition/Receipt**: ${poRecord.receivedDate || "Pending Receipt"}`,
          category: "procurement",
          structuredData: [
            { Milestone: "1. PR Created", Date: poRecord.requestedDate, Completed: "Yes" },
            { Milestone: "2. PR Approved", Date: poRecord.approvedDate || "Awaiting", Completed: poRecord.approvedDate ? "Yes" : "No" },
            { Milestone: "3. PO Issued", Date: poRecord.orderedDate || "Awaiting", Completed: poRecord.orderedDate ? "Yes" : "No" },
            { Milestone: "4. Shipped / Dispatched", Date: poRecord.status === "Shipped" || poRecord.status === "Acquisition_Completed" ? "Yes" : "Awaiting", Completed: poRecord.status === "Shipped" || poRecord.status === "Acquisition_Completed" ? "Yes" : "No" },
            { Milestone: "5. Acquisition Completed", Date: poRecord.receivedDate || "Pending", Completed: poRecord.status === "Acquisition_Completed" ? "Yes" : "No" }
          ]
        };
      }
      // If not found, show error with formatted code if possible
      const formattedCode = poCode.includes('-') ? poCode : `${poCode.substring(0, 2)}-${poCode.substring(2, 6)}-${poCode.substring(6)}`;
      return {
        text: `Could not find Purchase Order **${formattedCode.toUpperCase()}** in our records. Please verify the code (e.g. PO-2026-002).`,
        category: "procurement"
      };
    }

    // Check for specific PR tracking (matches formats like PR-2026-004, PR2026004, pr 2026 004)
    const prMatch = cleanQuery.match(/pr[- ]?\d{4}[- ]?\d{3}/i);
    if (prMatch && prMatch[0]) {
      const normalizedMatch = prMatch[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const prRecord = procurement.find(p => p.prId && p.prId.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedMatch);
      const prCode = prRecord ? prRecord.prId : prMatch[0].toUpperCase();

      if (prRecord) {
        const poInfo = prRecord.poId ? `associated with Purchase Order **${prRecord.poId}**` : "awaiting Purchase Order issuance";
        return {
          text: `### Purchase Request Tracking: ${prCode}\n` +
            `- **Status**: \`${prRecord.status.replace("_", " ")}\` (${poInfo})\n` +
            `- **Part**: ${prRecord.partName} (Code: ${prRecord.partId})\n` +
            `- **Quantity**: ${prRecord.quantity} pcs (Unit Price: $${prRecord.unitPrice})\n` +
            `- **Requested By**: ${prRecord.requestedBy} on ${prRecord.requestedDate}\n` +
            `- **Approval Date**: ${prRecord.approvedDate || "Pending Approval"}`,
          category: "procurement"
        };
      }
      // If not found, show error with formatted code if possible
      const formattedCode = prCode.includes('-') ? prCode : `${prCode.substring(0, 2)}-${prCode.substring(2, 6)}-${prCode.substring(6)}`;
      return {
        text: `Could not find Purchase Request **${formattedCode.toUpperCase()}** in our records. Please verify the code (e.g. PR-2026-004).`,
        category: "procurement"
      };
    }

    // Generic procurement tracking overview
    return {
      text: `Here is the current active **Procurement Pipeline** showing Purchase Requests, Purchase Orders, and Acquisition statuses:`,
      category: "procurement",
      structuredData: procurement.map(p => ({
        "PR Number": p.prId,
        "PO Number": p.poId || "Awaiting PO",
        "Part Name": p.partName,
        "Quantity": p.quantity,
        "Status": p.status.replace("_", " "),
        "Vendor": p.vendor
      }))
    };
  }

  // 6. STORE INDENTS
  if (cleanQuery.includes("indent")) {
    const pendingIndents = indents.filter(i => i.status !== "Issued");

    let text = `Here are the store issue requests (**Indents**). Currently, there are **${pendingIndents.length} pending/approved indents** awaiting fulfillment:\n\n`;

    return {
      text: text + "All Indent logs:",
      category: "procurement",
      structuredData: indents.map(i => ({
        "Indent ID": i.indentId,
        "Department": i.department,
        "Part": i.partName,
        "Qty Requested": i.quantity,
        "Date": i.date,
        "Status": i.status
      }))
    };
  }

  // 7. PARTS INVENTORY & MIN/MAX STATUS
  if (cleanQuery.includes("inventory") || cleanQuery.includes("stock") || cleanQuery.includes("parts") || cleanQuery.includes("min") || cleanQuery.includes("max")) {
    const targetPart = findPart(cleanQuery);

    if (targetPart) {
      const statusBadge = targetPart.quantity <= targetPart.minVal
        ? "⚠️ LOW STOCK ALERT"
        : (targetPart.quantity === 0 ? "🚨 OUT OF STOCK" : "✅ Stock Healthy");

      return {
        text: `### Part Status: ${targetPart.name} (${targetPart.partId})\n` +
          `- **Available Stock**: **${targetPart.quantity} units**\n` +
          `- **Min Limit / Max Limit**: ${targetPart.minVal} / ${targetPart.maxVal} units\n` +
          `- **Unit Price**: $${targetPart.unitPrice}\n` +
          `- **Inventory Health**: **${statusBadge}**\n` +
          `- **Machine Compatibility**: *${targetPart.machineCompat}*`,
        category: "inventory",
        structuredData: [
          { Detail: "Part Code", Value: targetPart.partId },
          { Detail: "Category", Value: targetPart.category },
          { Detail: "Quantity on Hand", Value: targetPart.quantity },
          { Detail: "Minimum Threshold", Value: targetPart.minVal },
          { Detail: "Maximum Level", Value: targetPart.maxVal },
          { Detail: "Est. Reorder Value", Value: `$${(targetPart.maxVal - targetPart.quantity) * targetPart.unitPrice}` }
        ]
      };
    }

    if (cleanQuery.includes("min") || cleanQuery.includes("low") || cleanQuery.includes("alert")) {
      const lowStockParts = inventory.filter(p => p.quantity <= p.minVal);
      if (lowStockParts.length === 0) {
        return {
          text: "✅ All inventory items are currently above their defined **Minimum Threshold levels**.",
          category: "inventory"
        };
      }

      return {
        text: `🚨 **Low Stock Alert**: The following **${lowStockParts.length} parts** are at or below their Minimum Threshold levels. Reorder requests should be initiated:`,
        category: "inventory",
        structuredData: lowStockParts.map(p => ({
          "Part ID": p.partId,
          "Part Name": p.name,
          "Current Stock": p.quantity,
          "Min Stock": p.minVal,
          "Reorder Qty": p.maxVal - p.quantity,
          "Status": p.quantity === 0 ? "Out of Stock" : "Low Stock"
        }))
      };
    }

    // Generic inventory overview
    const totalItems = inventory.reduce((sum, p) => sum + p.quantity, 0);
    const lowStockCount = inventory.filter(p => p.quantity <= p.minVal).length;

    return {
      text: `The warehouse maintains **${inventory.length} distinct items** with a total catalog volume of **${totalItems} units**. There are **${lowStockCount} items** triggering low stock alerts.\n\nHere is a high-level inventory check:`,
      category: "inventory",
      structuredData: inventory.map(p => ({
        "Part ID": p.partId,
        "Name": p.name,
        "Category": p.category,
        "Qty": p.quantity,
        "Min/Max Limit": `${p.minVal} / ${p.maxVal}`,
        "Status": p.quantity === 0 ? "🚨 Out" : (p.quantity <= p.minVal ? "⚠️ Low" : "✅ OK")
      }))
    };
  }

  // DEFAULT MATCH (No categories matched)
  // Try to see if they named a machine without context
  const targetMachineGeneric = findMachine(cleanQuery);
  if (targetMachineGeneric) {
    return {
      text: `I detected a reference to **${targetMachineGeneric.name}** (${targetMachineGeneric.model}). Here is its current telemetry:\n` +
        `- Status: **${targetMachineGeneric.status}**\n` +
        `- Hour Meter: **${targetMachineGeneric.hourMeter} hrs**\n` +
        `- Fuel Burn Rate: **${targetMachineGeneric.fuelRate} L/h**\n` +
        `- Productivity: **${targetMachineGeneric.productivity}%**\n\n` +
        `What details would you like to know? You can ask: *'Why did ${targetMachineGeneric.id} break down?'* or *'What is its fuel consumption?'*.`,
      category: "telemetry"
    };
  }

  const targetPartGeneric = findPart(cleanQuery);
  if (targetPartGeneric) {
    return {
      text: `I detected a reference to **${targetPartGeneric.name}** (Code: ${targetPartGeneric.partId}). It is currently stocked at **${targetPartGeneric.quantity} units** (Min threshold: ${targetPartGeneric.minVal}).\n\n` +
        `Would you like to track its procurement? You can ask: *'Track procurement for ${targetPartGeneric.partId}'* or *'Show PRs for this part'*.`
    };
  }

  return {
    text: `I received your query: "${query}". I couldn't find a direct match in my database mapping.\n\n` +
      `Try asking about:\n` +
      `- **Machines**: "what is the status of EX-001?", "fuel consumption of DT-002", "most productive machine"\n` +
      `- **Breakdowns**: "why did WL-003 break down?", "parts with most breakdowns", "total breakdown hours"\n` +
      `- **Parts & Tracking**: "items below minimum stock", "track PO-2026-002", "list indents", "quantity of P-103"`,
    category: "unknown"
  };
};
