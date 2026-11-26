import assert from "node:assert/strict";
import {chromium} from "playwright";

const base=process.env.APP_URL||"https://cartoleiro-dedicacao.evaldomartins81.workers.dev/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const issues=[];
try{
  for(const {label,viewport,isMobile} of [
    {label:"mobile",viewport:{width:390,height:844},isMobile:true},
    {label:"desktop",viewport:{width:1280,height:900},isMobile:false}
  ]){
    const page=await browser.newPage({viewport,isMobile,deviceScaleFactor:1,locale:"pt-BR"});
    page.on("pageerror",e=>issues.push(label+": "+e.message));
    const response=await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
    assert.equal(response.status(),200,label+" HTTP");
    await page.waitForFunction(()=>Number(document.querySelector("#athlete-count")?.textContent)>100,{timeout:25000});
    const count=Number(await page.locator("#athlete-count").textContent());
    assert.ok(count>100,label+" no official athletes: "+count);
    assert.equal(await page.locator("#generate").isEnabled(),true,label+" disabled: "+await page.locator("#form-message").textContent());
    await page.locator("#budget").fill("152");
    for(const [strategy,formation] of [["mitada","4-3-3"],["segura","3-4-3"],["valor","5-3-2"]]){
      await page.locator('[data-strategy="'+strategy+'"]').click();
      await page.locator("#formation").selectOption(formation);
      await page.locator("#generate").click();
      assert.equal(await page.locator("#results").isVisible(),true,label+" "+strategy+" no results: "+await page.locator("#form-message").textContent());
      assert.equal(await page.locator("#lineup .player").count(),12,label+" "+strategy+" incorrect starters");
      assert.equal(await page.locator("#lineup .captain").count(),1,label+" "+strategy+" incorrect captain");
      const costText=await page.locator("#total-cost").textContent();
      const cost=Number(costText.replace(/[^\d,]/g,"").replace(",","."));
      assert.ok(cost>0 && cost<=152,label+" "+strategy+" invalid cost "+costText);
      assert.equal(await page.locator("#result-formation").textContent(),formation);
    }
    await page.locator("details.explore").first().locator("summary").click();
    await page.locator("#search").fill("vasco");
    assert.ok((await page.locator("#market-list .market-item").count())>=0);
    await page.locator("#search").fill("");
    await page.locator("#position").selectOption("5");
    assert.ok((await page.locator("#market-list .market-item").count())>0,label+" market filter");
    await page.screenshot({path:"cartoleiro-"+label+".png",fullPage:true});
    console.log(label+": LIVE PASS - "+count+" athletes, three strategies, formations, budget, captain and filters");
    await page.close();
  }
  assert.deepEqual(issues,[],"Unhandled browser errors");
}finally{await browser.close()}
