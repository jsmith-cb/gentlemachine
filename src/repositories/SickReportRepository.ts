export interface SickReport { readonly id:string; readonly employeeId?:string; readonly employeeName?:string; readonly startDate:string; readonly endDate:string; readonly status:"reported"|"acknowledged"; readonly employeeNote?:string; readonly createdAt:string; }
export interface EmployeeSickReportRepository { listMine():Promise<readonly SickReport[]>; report(startDate:string,endDate:string,note?:string):Promise<void>; }
export interface ManagerSickReportRepository { list():Promise<readonly SickReport[]>; acknowledge(reportId:string):Promise<void>; }
