export default function DeploymentEnvironmentBanner(){
 if(process.env.NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT!=="sandbox")return null;
 return <aside aria-label="Sandbox environment" style={{position:"sticky",top:0,zIndex:10000,background:"#fef3c7",color:"#78350f",padding:"10px 20px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #d97706"}}>
  SANDBOX — Training and testing only. Records created here are not production records.
 </aside>;
}
