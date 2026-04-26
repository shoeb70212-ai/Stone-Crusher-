const puppeteer = require('puppeteer'); 
(async () => { 
  try { 
    const browser = await puppeteer.launch({args: ['--no-sandbox']}); 
    await browser.close(); 
    console.log('success'); 
  } catch(e) { 
    console.error('fail', e); 
  } 
})();
