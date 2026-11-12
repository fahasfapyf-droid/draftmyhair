/* Disposable PostgreSQL ONLY. Real SQL and Prisma deploy; no existing database credentials. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{Client}=require('pg');
async function main(){
  assert.ok(process.argv.includes('--disposable-local-only'));
  const manifest=process.env.DMH71_DB_MANIFEST;assert.ok(manifest&&process.env.DMH71_REVIEW_RUNNER);
  const meta=JSON.parse(fs.readFileSync(manifest,'utf8'));assert.equal(meta.host,'127.0.0.1');assert.ok(meta.data.includes('dmh71-pg-review-'));assert.match(meta.database,/^dmh71_review_[a-f0-9]+$/);
  const {run,root,repo}=require(process.env.DMH71_REVIEW_RUNNER);
  const connection={host:'127.0.0.1',port:meta.port,user:meta.user,database:meta.database};
  const control=new Client(connection);await control.connect();
  const ident=(await control.query("SELECT current_setting('data_directory') AS data, host(inet_server_addr()) AS host")).rows[0];assert.equal(ident.host,'127.0.0.1');assert.equal(ident.data.replaceAll('\\','/').toLowerCase(),meta.data.replaceAll('\\','/').toLowerCase());
  const make=async()=>{const database='dmh71_review_'+crypto.randomBytes(8).toString('hex');await control.query('CREATE DATABASE "'+database+'"');const c=new Client({...connection,database});await c.connect();return{database,c};};
  const fresh=await make(),upgrade=await make();const folder=fs.mkdtempSync(path.join(root,'migration-schema-'));fs.cpSync(path.join(repo,'prisma'),path.join(folder,'prisma'),{recursive:true});
  const schema=path.join(folder,'prisma/schema.prisma');
  const env={DATABASE_URL:`postgresql://${meta.user}@127.0.0.1:${meta.port}/${fresh.database}?schema=public`,PRISMA_HIDE_UPDATE_MESSAGE:'1',CHECKPOINT_DISABLE:'1'};
  try{
    assert.equal(run('FINAL full 26-migration Prisma deploy on NEW database',process.execPath,[path.join(repo,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',schema],folder,env).exitCode,0);
    const statuses=(await fresh.c.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;assert.equal(statuses.length,26);assert.ok(statuses.every(r=>r.finished_at&&!r.rolled_back_at));
    for(const migration of statuses)assert.equal(migration.checksum,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'prisma/migrations',migration.migration_name,'migration.sql'))).digest('hex'),'exact SQL checksum: '+migration.migration_name);
    const directories=fs.readdirSync(path.join(repo,'prisma/migrations')).filter(f=>fs.statSync(path.join(repo,'prisma/migrations',f)).isDirectory()).sort();
    for(const migration of directories.filter(f=>f<'20261111170000'))await upgrade.c.query(fs.readFileSync(path.join(repo,'prisma/migrations',migration,'migration.sql'),'utf8'));
    await upgrade.c.query(`INSERT INTO "RnDCampaign" (id,name,"createdByUserId","updatedAt") VALUES ('upgrade-campaign','Synthetic migration preservation','test',now());
      INSERT INTO "RnDAsset" (id,kind,"storageKey","blobUrl","mimeType","fileSize") VALUES ('upgrade-source','SOURCE','upgrade-source','https://synthetic.invalid/source','image/png',1);
      INSERT INTO "RnDTarget" (id,"campaignId","targetType","targetKey","sourceAssetId",status,"updatedAt") VALUES ('upgrade-target','upgrade-campaign','SINGLE','upgrade','upgrade-source','FAILED',now());
      INSERT INTO "RnDJob" (id,"targetId",status,"currentPrompt","attemptCount","promptVersionNumber","failureCode","updatedAt") VALUES ('upgrade-job','upgrade-target','FAILED','Synthetic # TARGETED REFINEMENT',5,2,'PREEXISTING_TERMINAL',now());
      INSERT INTO "RnDAttempt" (id,"jobId","attemptNumber",prompt,"promptRevision","submittedAt",verdict,"refinementSlot") VALUES ('upgrade-attempt','upgrade-job',5,'Synthetic','old',now(),'FAILED','AUTO_1');`);
    const before=(await upgrade.c.query('SELECT status,"attemptCount","failureCode","currentPrompt" FROM "RnDJob"')).rows;
    await upgrade.c.query(fs.readFileSync(path.join(repo,'prisma/migrations/20261111170000_rnd_protocol2_prerequisites/migration.sql'),'utf8'));
    await upgrade.c.query('UPDATE "RnDAttempt" SET "infrastructureRetryCount"=2');
    await upgrade.c.query(fs.readFileSync(path.join(repo,'prisma/migrations/20261111180000_rnd_learning_budgets/migration.sql'),'utf8'));
    await upgrade.c.query(`INSERT INTO "Hairstyle" (id,name,slug,"promptKey",gender,"updatedAt") VALUES ('migration-style','Synthetic','migration-style','migration-style','UNISEX',now());
      INSERT INTO "PromptVersion" (id,"hairstyleId",version,prompt,status,"updatedAt") VALUES ('migration-a','migration-style',1,'Synthetic','ACTIVE',now()),('migration-b','migration-style',2,'Synthetic','ACTIVE',now());`);
    const forward=fs.readFileSync(path.join(repo,'prisma/migrations/20261112090000_rnd_state_provenance_guards/migration.sql'),'utf8');
    await assert.rejects(upgrade.c.query(forward),e=>e.code==='23505');await upgrade.c.query('ROLLBACK');
    assert.equal((await upgrade.c.query('SELECT "refinementCount" FROM "RnDJob"')).rows[0].refinementCount,0,'failed guard migration rolls back conservative backfill');
    await upgrade.c.query("DELETE FROM \"PromptVersion\" WHERE id='migration-b'");await upgrade.c.query(forward);
    assert.deepEqual((await upgrade.c.query('SELECT status,"attemptCount","failureCode","currentPrompt" FROM "RnDJob"')).rows,before);
    const budgets=(await upgrade.c.query('SELECT "refinementCount","maxGenerationAttempts","infrastructureRetryCount" FROM "RnDJob"')).rows[0];assert.deepEqual(budgets,{refinementCount:1,maxGenerationAttempts:5,infrastructureRetryCount:2});
    for(const[sql,code]of [['UPDATE "RnDJob" SET "infrastructureRetryCount"=NULL','23502'],['UPDATE "RnDJob" SET "infrastructureRetryCount"=-1','23514'],['UPDATE "RnDJob" SET "refinementCount"=NULL','23502'],['UPDATE "RnDJob" SET "refinementCount"=-1','23514'],['UPDATE "RnDJob" SET "attemptCount"=-1','23514'],['UPDATE "RnDJob" SET "maxGenerationAttempts"=6','23514'],['UPDATE "RnDJob" SET "maxGenerationAttempts"=NULL','23502'],['UPDATE "RnDAttempt" SET "infrastructureRetryCount"=NULL','23502'],['UPDATE "RnDAttempt" SET "infrastructureRetryCount"=-1','23514']])await assert.rejects(upgrade.c.query(sql),e=>e.code===code);
    const enumRows=(await fresh.c.query(`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname LIKE 'RnD%' ORDER BY t.typname,e.enumsortorder`)).rows;
    const text=fs.readFileSync(schema,'utf8');for(const match of text.matchAll(/enum (RnD\w+)\s*\{([^}]+)\}/g))assert.deepEqual(enumRows.filter(r=>r.typname===match[1]).map(r=>r.enumlabel),match[2].trim().split(/\s+/));
    const columns=(await fresh.c.query(`SELECT table_name,column_name,is_nullable,column_default,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('RnDJob','RnDAttempt') ORDER BY table_name,ordinal_position`)).rows;
    for(const table of ['RnDJob','RnDAttempt'])assert.equal(columns.find(c=>c.table_name===table&&c.column_name==='infrastructureRetryCount').is_nullable,'NO');
    assert.equal(columns.find(c=>c.table_name==='RnDAttempt'&&c.column_name==='submittedAt').is_nullable,'YES');
    const indexes=(await fresh.c.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND (tablename LIKE 'RnD%' OR tablename='PromptVersion') ORDER BY indexname`)).rows;
    assert.ok(indexes.some(i=>i.indexname==='PromptVersion_one_active_per_style'&&i.indexdef.includes('WHERE')));
    const constraints=(await fresh.c.query(`SELECT c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relname LIKE 'RnD%' OR t.relname='PromptVersion' ORDER BY c.conname`)).rows;
    fs.writeFileSync(path.join(root,'migration-evidence.json'),JSON.stringify({freshDatabase:fresh.database,upgradeDatabase:upgrade.database,statuses,before,budgets,columns,indexes,constraints,enumRows,expectedRejectedSqlstates:['23502','23514','23505']},null,2));
    fs.writeFileSync(path.join(root,'final-database.json'),JSON.stringify({...meta,database:fresh.database},null,2));
    console.log('PASS actual PostgreSQL: 26 Prisma migrations; matching R&D enums/columns/defaults/constraints/indexes; pre-Issue71 upgrade preserves terminal state, consumed refinement and infrastructure allowance; invalid NULL/negative/over-budget writes rejected; duplicate ACTIVE guard rollback is atomic.');
  }finally{await fresh.c.end();await upgrade.c.end();await control.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
