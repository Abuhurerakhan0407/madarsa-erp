export function examCsvCell(value:unknown):string{
 let text=value===null||value===undefined?'':String(value);
 if(/^[=+\-@]/.test(text))text=`'${text}`;
 return `"${text.replaceAll('"','""')}"`;
}

export function examExportFilename(value:string):string{
 const safe=value.replace(/[^A-Za-z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'').slice(0,80);
 return safe||'exam-results';
}
