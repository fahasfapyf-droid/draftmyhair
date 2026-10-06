import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime="nodejs";
const TOKEN="DMH_HAIR_COLOR_BATCH_11_20_ROOTFIX_20261006";
const NAMES=["Ice Beige Blonde","Champagne Blonde","Buttercream Blonde","Soft Golden Blonde","Honey Blonde","Teddy Bronde","Champagne Brunette","Glossy Espresso","Suede Brunette","Cedarwood Brunette"];
const ROOT=`
ROOT AUTHORITY — 4-STEP CONTROL
1. SAMPLE EXISTING HAIR COLOR: Read the photographed existing hair color only from visible hair fibers/root zones. Do not sample color from skin, scalp, forehead, ears, clothing, background, ambient light or reflections.
2. ESTABLISH ROOT AUTHORITY: Treat the requested target color as the sole color authority for the existing hair. Establish that target coherently at the true hair roots and hairline before extending it through the lengths.
3. APPLY ROOT AUTHORITY: Apply the target consistently at the hairline, temples, visible part, crown and nape where hair is visible, while preserving natural strand emergence, root direction, density and shadow behavior. Do not invent dark roots, artificial root bands or erase natural root structure unless explicitly required by the target color.
4. CONTAMINATION CHECK: Verify that target pigment remains confined to hair fibers. Reject any white/grey, skin, scalp, forehead, ears, neck, clothing, background or lighting/reflection color being mistaken for hair pigment or contaminating the target color.
`;
function ok(r:Request){return r.headers.get("x-dmh-batch-token")===TOKEN || new URL(r.url).searchParams.get("token")===TOKEN;}
export async function GET(request:Request){ if(!ok(request))return NextResponse.json({error:"Unauthorized"},{status:401}); const rows=await prisma.hairstyle.findMany({where:{serviceType:"HAIR_COLOR",isActive:true,name:{in:NAMES}},include:{promptVersions:{orderBy:{version:"asc"}}}}); return NextResponse.json(rows.map(r=>({name:r.name,version:r.promptVersions[0]?.version,status:r.promptVersions[0]?.status,qaStatus:r.promptVersions[0]?.qaStatus,root4:r.promptVersions[0]?.prompt.includes("ROOT AUTHORITY — 4-STEP CONTROL"),steps:["SAMPLE EXISTING HAIR COLOR","ESTABLISH ROOT AUTHORITY","APPLY ROOT AUTHORITY","CONTAMINATION CHECK"].map(x=>r.promptVersions[0]?.prompt.includes(x))}))); }
export async function POST(request:Request){
 if(!ok(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 const result=await prisma.$transaction(async tx=>{
  const rows=await tx.hairstyle.findMany({where:{serviceType:"HAIR_COLOR",isActive:true,name:{in:NAMES}},include:{promptVersions:{orderBy:{version:"asc"}}}});
  if(rows.length!==10)throw new Error("TARGET_SET_MISMATCH");
  const out=[];
  for(const name of NAMES){
   const r=rows.find(x=>x.name===name)!;
   if(r.promptVersions.length!==1||r.promptVersions[0].version!==1||r.promptVersions[0].status!=="DRAFT")throw new Error("PRECONDITION:"+name);
   const v=r.promptVersions[0];
   if(v.prompt.includes("ROOT AUTHORITY — 4-STEP CONTROL"))throw new Error("ALREADY_FIXED:"+name);
   const prompt=v.prompt.replace(/ROOT \/ HAIRLINE AUTHORITY[\s\S]*?(?=\nTARGET COLOR AUTHORITY)/,ROOT+"\n");
   if(prompt===v.prompt)throw new Error("ROOT_BLOCK_NOT_FOUND:"+name);
   const u=await tx.promptVersion.update({where:{id:v.id},data:{prompt,status:"DRAFT",qaStatus:"DRAFT",notes:(v.notes||"")+"\nTargeted second-pass repair: explicit 4-step Root Authority added. Image generation/QA not performed."}});
   out.push({name,version:u.version,status:u.status,qaStatus:u.qaStatus});
  }
  return out;
 });
 return NextResponse.json({ok:true,result});
}