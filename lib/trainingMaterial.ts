type TrainingDocument={status:string;revision:string;file_url?:string|null;controlled_copy_file_path?:string|null;controlled_copy_file_url?:string|null};
export function controlledDocumentPath(url:string,projectUrl:string) {
 try {
  const source=new URL(url),project=new URL(projectUrl);
  if(source.origin!==project.origin)return null;
  const match=source.pathname.match(/^\/storage\/v1\/object\/(?:public|authenticated|sign)\/controlled-documents\/(.+)$/);
  return match?decodeURIComponent(match[1]):null;
 } catch {return null;}
}
export async function resolveTrainingMaterial(doc:TrainingDocument,projectUrl:string,sign:(path:string)=>Promise<string|null>,assignedRevision?:string|null,requireControlledCopy=false) {
 if(assignedRevision&&assignedRevision!==doc.revision)throw new Error(`This assignment requires revision ${assignedRevision}, but the linked document is revision ${doc.revision}. Contact your training coordinator.`);
 const released=["release","effective"].includes(doc.status.toLowerCase());
 const controlledRequired=released||requireControlledCopy;
 const hasControlledCopy=controlledRequired&&!!(doc.controlled_copy_file_path||doc.controlled_copy_file_url);
 const path=hasControlledCopy?doc.controlled_copy_file_path:null;
 const url=hasControlledCopy?doc.controlled_copy_file_url:doc.file_url;
 const source=controlledRequired?"Controlled Copy":"Working Copy";
 if(controlledRequired&&!hasControlledCopy)return {url:null,source};
 if(!path&&!url)return {url:null,source};
 const storagePath=path||(url?controlledDocumentPath(url,projectUrl):null);
 const resolved=storagePath?await sign(storagePath):url||null;
 if(!resolved)throw new Error("The training file could not be opened. Contact your training coordinator.");
 return {url:resolved,source};
}
