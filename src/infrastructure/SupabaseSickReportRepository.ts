import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeSickReportRepository,ManagerSickReportRepository,SickReport } from "../repositories/SickReportRepository";
export class SupabaseEmployeeSickReportRepository implements EmployeeSickReportRepository {
 constructor(private readonly client:SupabaseClient){}
 async listMine(){const {data,error}=await this.client.rpc("get_my_sick_reports");if(error)throw new Error(error.message);if(!Array.isArray(data))throw new Error("Invalid sickness response.");return data.map(map);}
 async report(startDate:string,endDate:string,note?:string){const {error}=await this.client.rpc("report_my_sickness",{reported_start:startDate,reported_end:endDate,reported_note:note?.trim()||null});if(error){if(error.code==="23P01")throw new Error("These dates overlap an existing sickness report.");throw new Error(error.message);}}
}
export class SupabaseManagerSickReportRepository implements ManagerSickReportRepository {
 constructor(private readonly client:SupabaseClient,private readonly businessId:string){}
 async list(){const {data,error}=await this.client.from("sick_reports").select("id,employee_id,start_date,end_date,status,employee_note,created_at,employees!inner(first_name,last_name)").eq("business_id",this.businessId).order("created_at",{ascending:false});if(error)throw new Error(error.message);return(data??[]).map((raw)=>{const row=raw as unknown as Record<string,unknown>;const employee=row.employees as Record<string,unknown>;return{...map({id:row.id,startDate:row.start_date,endDate:row.end_date,status:row.status,employeeNote:row.employee_note,createdAt:row.created_at}),employeeId:String(row.employee_id),employeeName:`${employee.first_name} ${employee.last_name}`};});}
 async acknowledge(reportId:string){const {error}=await this.client.rpc("acknowledge_sick_report",{target_report_id:reportId});if(error)throw new Error(error.message);}
}
function map(value:unknown):SickReport{const row=value as Record<string,unknown>;if(!row||typeof row.id!=="string"||typeof row.startDate!=="string"||typeof row.endDate!=="string"||(row.status!=="reported"&&row.status!=="acknowledged")||typeof row.createdAt!=="string")throw new Error("Invalid sickness report.");return{id:row.id,startDate:row.startDate,endDate:row.endDate,status:row.status,createdAt:row.createdAt,...(typeof row.employeeNote==="string"?{employeeNote:row.employeeNote}:{})};}
