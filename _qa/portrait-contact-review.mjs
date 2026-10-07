import {chromium} from 'playwright';
const root='/Users/yin/code/games/harbor-camera-avatar-owner-20261007/evidence';
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
try{for(const [file,width,name] of [['ALL-22.html',868,'all-22-upright.png'],['COMPARE-390.html',836,'comparison-upright-390.png']]){const page=await browser.newPage({viewport:{width,height:900}});await page.goto('file://'+root+'/'+file);await page.locator('img').evaluateAll(async imgs=>Promise.all(imgs.map(img=>img.decode())));await page.screenshot({path:root+'/'+name,fullPage:true});await page.close();}}finally{await browser.close();}
