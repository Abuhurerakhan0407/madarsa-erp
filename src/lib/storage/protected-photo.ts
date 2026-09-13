const allowedImageTypes=new Set(['image/jpeg','image/png','image/webp']);

export function isTenantOwnedStoragePath(value:unknown,tenantId:number):value is string{
 if(typeof value!=='string'||!Number.isSafeInteger(tenantId)||tenantId<=0)return false;
 const path=value.trim();if(!path||path.length>512||path.startsWith('/')||path.includes('\\'))return false;
 const parts=path.split('/');if(parts.length<2||parts[0]!==String(tenantId))return false;
 return parts.every(part=>part.length>0&&part!=='.'&&part!=='..'&&!/%2e/i.test(part));
}

export function protectedPhotoResponse(blob:Blob):Response|null{
 const contentType=blob.type.toLowerCase().split(';',1)[0];if(!allowedImageTypes.has(contentType))return null;
 return new Response(blob,{status:200,headers:{
  'content-type':contentType,
  'content-length':String(blob.size),
  'cache-control':'private, max-age=60, must-revalidate',
  'x-content-type-options':'nosniff',
  'content-disposition':'inline'
 }});
}
