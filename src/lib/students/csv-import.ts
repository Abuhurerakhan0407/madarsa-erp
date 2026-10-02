export type StudentImportRow = {
  display_name: string;
  name_native?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other" | "undisclosed";
  preferred_locale?: "en" | "ur";
  guardian?: { name: string; relationship: "father" | "mother" | "guardian"; phone?: string };
};

const aliases: Record<string,string> = {
  display_name:"display_name",student_name:"display_name",name:"display_name",
  name_native:"name_native",native_name:"name_native",
  date_of_birth:"date_of_birth",dob:"date_of_birth",
  gender:"gender",preferred_locale:"preferred_locale",locale:"preferred_locale",
  guardian_name:"guardian_name",parent_name:"guardian_name",
  guardian_relationship:"guardian_relationship",relationship:"guardian_relationship",
  guardian_phone:"guardian_phone",parent_phone:"guardian_phone",phone:"guardian_phone"
};

function normalizeHeader(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}

function parseMatrix(input:string):string[][]{
  const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;
  for(let i=0;i<input.length;i++){
    const char=input[i];
    if(char==='"'){
      if(quoted&&input[i+1]==='"'){field+='"';i++;continue;}
      quoted=!quoted;continue;
    }
    if(!quoted&&char===','){row.push(field);field="";continue;}
    if(!quoted&&(char==='\n'||char==='\r')){
      if(char==='\r'&&input[i+1]==='\n')i++;
      row.push(field);field="";
      if(row.some((cell)=>cell.trim().length>0))rows.push(row);
      row=[];continue;
    }
    field+=char;
  }
  row.push(field);if(row.some((cell)=>cell.trim().length>0))rows.push(row);
  if(quoted)throw new Error("CSV contains an unclosed quoted field.");
  return rows;
}

export function parseStudentImportCsv(input:string):StudentImportRow[]{
  if(typeof input!=="string"||!input.trim())throw new Error("CSV file is empty.");
  if(input.length>262144)throw new Error("CSV file is too large. Use batches of up to 100 students.");
  const matrix=parseMatrix(input.replace(/^\uFEFF/,""));
  if(matrix.length<2)throw new Error("CSV must include a header row and at least one student.");
  const headers=matrix[0].map((value)=>aliases[normalizeHeader(value)]??normalizeHeader(value));
  if(!headers.includes("display_name"))throw new Error("CSV requires a display_name, student_name, or name column.");
  const rows:StudentImportRow[]=[];
  for(const values of matrix.slice(1)){
    if(rows.length>=100)throw new Error("CSV import supports at most 100 students per batch.");
    const record:Record<string,string>={};headers.forEach((key,index)=>{record[key]=(values[index]??"").trim();});
    if(!record.display_name)throw new Error(`Row ${rows.length+2} is missing the student name.`);
    if(record.display_name.length>160)throw new Error(`Row ${rows.length+2} student name is too long.`);
    const gender=record.gender?.toLowerCase();if(gender&&!(["male","female","other","undisclosed"] as string[]).includes(gender))throw new Error(`Row ${rows.length+2} has an invalid gender.`);
    const locale=record.preferred_locale?.toLowerCase();if(locale&&!(["en","ur"] as string[]).includes(locale))throw new Error(`Row ${rows.length+2} has an invalid preferred locale.`);
    if(record.date_of_birth&&!/^\d{4}-\d{2}-\d{2}$/.test(record.date_of_birth))throw new Error(`Row ${rows.length+2} date_of_birth must use YYYY-MM-DD.`);
    const guardianName=record.guardian_name;const relationship=(record.guardian_relationship||"guardian").toLowerCase();
    if(guardianName&&!(["father","mother","guardian"] as string[]).includes(relationship))throw new Error(`Row ${rows.length+2} has an invalid guardian relationship.`);
    rows.push({
      display_name:record.display_name,
      ...(record.name_native?{name_native:record.name_native}:{}),
      ...(record.date_of_birth?{date_of_birth:record.date_of_birth}:{}),
      ...(gender?{gender:gender as StudentImportRow["gender"]}:{}),
      ...(locale?{preferred_locale:locale as StudentImportRow["preferred_locale"]}:{}),
      ...(guardianName?{guardian:{name:guardianName,relationship:relationship as "father"|"mother"|"guardian",...(record.guardian_phone?{phone:record.guardian_phone}:{})}}:{})
    });
  }
  return rows;
}
