import puppeteer from "puppeteer";
async function run() {
  try {
     const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
     const page = await browser.newPage();
     await page.setContent('<h1>Hello World</h1>');
     const pdf = await page.pdf({ format: 'A4' });
     await browser.close();
     console.log('success!', pdf.length);
  } catch (err) {
     console.error('fail', err);
  }
}
run();
