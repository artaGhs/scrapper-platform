import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ScanStore} from "../lib/sqlite-store";
import {searchAccess} from "../lib/billing";
import {publicScan,type Scan} from "../lib/types";

test("trial start survives repeated sign-ins, consumption and reopening storage", () => {
  const dir=mkdtempSync(join(tmpdir(),"threadfinder-trial-"));
  const dbPath=join(dir,"trial.sqlite");
  const clock=Date.now;
  let db=new ScanStore(dbPath);
  try {
    Date.now=()=>1800000000000;
    const trial=db.trial("customer");
    assert.equal(trial.expiresAt-trial.startsAt,7*86400_000);
    const scan=db.create("customer","one","A business description for trial","live",.25,5,["reddit"],
      {ipHash:"test",dailyBudget:10,free:true,fullResults:true,trialExpiresAt:trial.expiresAt});
    db.consumeFree(scan);
    db.close(); db=new ScanStore(dbPath);
    Date.now=()=>trial.expiresAt+1;
    const reopened=db.trial("customer");
    assert.equal(reopened.startsAt,trial.startsAt);
    assert.equal(reopened.expiresAt,trial.expiresAt);
    assert.equal(reopened.used,true);
  } finally {Date.now=clock;db.close();rmSync(dir,{recursive:true,force:true});}
});

test("trial expiry and exhaustion deny access; only configured paid plans with AWS allowance unlock paid research", async () => {
  const prior={...process.env};
  Object.assign(process.env,{MONETIZATION_STARTER_PLAN_ID:"starter",MONETIZATION_PRO_PLAN_ID:"pro",MONETIZATION_EVENT_TYPE:"search_completed"});
  const trial={startsAt:Date.now(),expiresAt:Date.now()+86400_000,used:false,scanId:null};
  const absent={getSubscription:async()=>{const error=new Error("No subscription");error.name="ResourceNotFoundException";throw error;},
    checkEntitlement:async()=>{throw new Error("Trial does not spend paid quota");}} as unknown as NonNullable<Parameters<typeof searchAccess>[2]>;
  try {
    const free=await searchAccess("customer",trial,absent);
    assert.equal(free.free,true);assert.equal(free.fullResults,true);assert.equal(free.billingEventType,undefined);
    await assert.rejects(searchAccess("customer",{...trial,used:true},absent),/trial is complete/);
    await assert.rejects(searchAccess("customer",{...trial,expiresAt:1},absent),/trial is complete/);
    const paid={getSubscription:async()=>({subscription:{planId:"pro"}}),checkEntitlement:async()=>({decision:"ALLOW"})} as unknown as NonNullable<Parameters<typeof searchAccess>[2]>;
    const access=await searchAccess("customer",{...trial,used:true,expiresAt:1},paid);
    assert.equal(access.free,false);assert.equal(access.billingEventType,"search_completed");
    await assert.rejects(searchAccess("customer",trial,{...paid,checkEntitlement:async()=>({decision:"DENY"})} as unknown as typeof paid),/allowance/);
    await assert.rejects(searchAccess("customer",trial,{...absent,getSubscription:async()=>{throw new Error("AWS unavailable");}}),/AWS unavailable/);
  } finally {process.env=prior;}
});

test("full paid and trial results are authorized server-side while anonymous previews remain limited", () => {
  const scan={id:"test",mode:"live",modelReview:"OpenAI assessment",results:Array.from({length:10},(_,i)=>({id:String(i)}))} as Scan;
  assert.equal(publicScan(scan).results.length,3);
  assert.equal(publicScan(scan).lockedCount,7);
  const full=publicScan({...scan,fullResults:true,free:true});
  assert.equal(full.results.length,10);assert.equal(full.lockedCount,0);
});
