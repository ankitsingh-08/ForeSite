export interface Machine {
  id: string;
  assetCode: string;
  name: string;
  model: string;
  type: string;
  status: 'Operating' | 'Breakdown' | 'Maintenance' | 'Idle';
  hourMeter: number;
  fuelRate: number;
  productivity: number;
  productivityRate: number;
  fuelType: 'Diesel' | 'Electric';
  engineOperated: boolean;
  siteName: string;
  breakdownHours: number;
  maintenanceHours: number;
  workingHours: number;
  availability?: number;
  idleHours?: number;
  totalExpense?: number;
  itemExpense?: number;
  fuelExpense?: number;
  expensePerHr?: number;
}

export interface InventoryItem {
  partId: string;
  name: string;
  category: string;
  quantity: number;
  minVal: number;
  maxVal: number;
  unitPrice: number;
  machineCompat?: string;
}

export interface BreakdownIncident {
  id: string;
  machineId: string;
  partId: string;
  reason: string;
  date: string;
  downHours: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface ProcurementRecord {
  poId: string;
  prId: string;
  partId: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  requestedBy: string;
  requestedDate: string;
  approvedDate: string;
  orderedDate: string;
  receivedDate: string;
  status: 'PR_Created' | 'PR_Approved' | 'PO_Issued' | 'Shipped' | 'Acquisition_Completed';
  vendor: string;
}

export interface IndentRequest {
  indentId: string;
  department: string;
  partId: string;
  partName: string;
  quantity: number;
  date: string;
  status: 'Pending' | 'Approved' | 'Issued';
}

export interface DatabaseState {
  machines: Machine[];
  inventory: InventoryItem[];
  breakdowns: BreakdownIncident[];
  procurement: ProcurementRecord[];
  indents: IndentRequest[];
}

export interface AuditLog {
  id?: number;
  timestamp: string;
  action: string;
  fileName?: string;
  rowsAffected?: number;
  details?: string;
}
