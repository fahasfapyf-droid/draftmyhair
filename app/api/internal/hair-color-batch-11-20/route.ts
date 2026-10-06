import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
const TOKEN = "DMH_HAIR_COLOR_BATCH_11_20_20261006";
function authorized(request: Request){return request.headers.get("x-dmh-batch-token")===TOKEN;}
export async function GET(request: Request){
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 const rows=await prisma.hairstyle.findMany({where:{serviceType:"HAIR_COLOR",isActive:true},orderBy:{createdAt:"asc"},select:{id:true,name:true,slug:true,promptKey:true,displayOrder:true,createdAt:true,promptVersions:{orderBy:{version:"asc"},select:{id:true,version:true,status:true,qaStatus:true,notes:true,prompt:true}}}});
 return NextResponse.json(rows);
}
export async function POST(request: Request){
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null), updates=body?.updates, names=body?.names;
 if(!Array.isArray(names)||names.length!==10||!Array.isArray(updates)||updates.length!==10)return NextResponse.json({error:"Expected exactly 10 names and 10 updates"},{status:400});
 const result=await prisma.$transaction(async tx=>{
  const rows=await tx.hairstyle.findMany({where:{serviceType:"HAIR_COLOR",isActive:true,name:{in:names}},include:{promptVersions:{orderBy:{version:"asc"}}}});
  if(rows.length!==10)throw new Error("TARGET_SET_MISMATCH");
  for(const name of names){const r=rows.find(x=>x.name===name);if(!r)throw new Error("MISSING:"+name);if(r.promptVersions.some(v=>v.status==="ACTIVE"))throw new Error("ACTIVE_PROTECTED:"+name);if(r.promptVersions.length!==1||r.promptVersions[0].version!==1||r.promptVersions[0].status!=="DRAFT")throw new Error("PRECONDITION:"+name);const u=updates.find(x=>x.name===name);if(!u||typeof u.prompt!=="string")throw new Error("UPDATE_MISSING:"+name);}
  const out=[]; for(const u of updates){const r=rows.find(x=>x.name===u.name); if(!r)throw new Error("MISSING_UPDATE_TARGET:"+u.name); const v=r.promptVersions[0]; const updated=await tx.promptVersion.update({where:{id:v.id},data:{prompt:u.prompt,notes:u.notes,status:"DRAFT",qaStatus:"DRAFT"}});out.push({name:u.name,id:updated.id,version:updated.version,status:updated.status,qaStatus:updated.qaStatus});} return out;
 });
 return NextResponse.json({ok:true,result});
}