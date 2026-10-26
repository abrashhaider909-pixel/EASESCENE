const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.E2E_OUT || 'test-results';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4173/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 200)));
  const shot = async (name, full = true) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('shot', name); };
  const go = async h => { await page.goto(BASE + '#' + h); await page.waitForTimeout(300); };
  const login = async (role, email, cms) => {
    await go(`/login?role=${role}`);
    await page.fill('#email', email);
    if (cms) await page.fill('#cms', cms);
    await page.fill('#password', '123');
    await page.click('button[type=submit]');
    await page.waitForTimeout(500);
  };
  const logout = async () => {
    await page.evaluate(() => { localStorage.removeItem('ezscene_session'); });
    await page.goto(BASE + '#/');
    await page.reload();
  };

  await go('/');
  await shot('01-landing');
  await go('/login');
  await shot('02-login', false);

  // wrong CMS
  await login('student', 'hamza.tariq@student.uni.edu.pk', '999999');
  console.log('cms error:', await page.locator('[role=alert]').innerText().catch(() => 'none'));
  await login('student', 'hamza.tariq@student.uni.edu.pk', '412345');
  console.log('after login url', page.url());
  await shot('03-new-application');

  // Fill leave request
  await page.click('text=Leave Request');
  await page.waitForTimeout(300);
  const d = n => { const x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };
  await page.fill('#f-start_date', d(30));
  await page.fill('#f-end_date', d(33));
  await page.fill('#f-reason', 'Attending my sister’s wedding in Lahore; I will cover missed labs.');
  await page.click('text=Family emergency');
  await shot('04-form-fill');
  await page.click('text=Continue to approval chain');
  await page.waitForTimeout(400);
  await shot('05-approval-chain');
  await page.click('text=Send request');
  await page.waitForTimeout(800);
  console.log('after send url', page.url());
  await shot('06-my-requests');
  const newId = page.url().split('/requests/')[1];

  await go('/requests/app-0412');
  await shot('06b-my-requests-0412');

  // Faculty: Sana (advisor), first login → mode chooser
  await logout();
  await login('staff', 'sana.javed@uni.edu.pk');
  console.log('sana url', page.url());
  await shot('07-mode-chooser', false);
  await page.click('text=Continue with Swipe mode');
  await page.waitForTimeout(400);
  await shot('08-inbox-sana');
  await go(`/inbox/${newId}`);
  await page.click('button:has-text("Approve & sign")');
  await page.waitForTimeout(800);
  console.log('toast:', await page.locator('.toast-in').first().innerText().catch(() => ''));

  // HoD Ayesha
  await logout();
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('ezscene_prefs') || '{}'); p['staff-ayesha'] = { tutorialSeen: true, approvalMode: 'swipe' }; p['staff-imran'] = { tutorialSeen: true, approvalMode: 'button' }; localStorage.setItem('ezscene_prefs', JSON.stringify(p)); });
  await page.reload();
  await login('staff', 'ayesha.malik@uni.edu.pk');
  await go('/inbox/app-0412');
  await shot('09-inbox-ayesha');
  await go(`/inbox/${newId}`);
  await page.click('button:has-text("Approve & sign")');
  await page.waitForTimeout(800);
  // reject one with reason
  await go('/inbox/app-0408');
  await page.click('button:has-text("Reject")');
  await page.fill('#reason', 'Please apply after the mid-term exams.');
  await page.click('div[role=dialog] button:has-text("Reject")');
  await page.waitForTimeout(500);
  await go('/profile');
  await shot('10-profile-faculty');

  // Dean final approval → issuance
  await logout();
  await login('staff', 'imran.qureshi@uni.edu.pk');
  await go(`/inbox/${newId}`);
  await page.click('button:has-text("Approve & sign")');
  await page.waitForTimeout(2500);
  console.log('toast:', await page.locator('.toast-in').allInnerTexts().catch(() => ''));

  // Student sees approved doc
  await logout();
  await login('student', 'hamza.tariq@student.uni.edu.pk', '412345');
  await go(`/requests/${newId}`);
  await shot('11-request-completed');
  await go(`/requests/${newId}/document`);
  await page.waitForTimeout(1500);
  await shot('12-approved-document');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download PDF")')]);
  const pdfPath = `${OUT}/issued.pdf`;
  await dl.saveAs(pdfPath);
  console.log('pdf bytes', fs.statSync(pdfPath).size, dl.suggestedFilename());
  await go('/requests/app-0398/document');
  await page.waitForTimeout(2000);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download PDF")')]);
  await dl2.saveAs(`${OUT}/noc.pdf`);

  // Upload flow: use Areeba's style pdf (the noc pdf) as upload
  await go('/new');
  await page.setInputFiles('input[type=file][accept*=".pdf"]', `${OUT}/noc.pdf`);
  await page.waitForTimeout(1500);
  console.log('upload url', page.url());
  await shot('13-upload-chain');

  // Admin
  await logout();
  await login('admin', 'admin@gmail.com');
  console.log('admin url', page.url());
  await shot('14-admin-designations');
  await go('/admin/templates');
  await shot('15-admin-templates');
  await go('/admin/audit');
  await page.fill('input[aria-label="Document ID"]', 'EZ-2026-0398');
  await page.click('button:has-text("Verify")');
  await page.waitForTimeout(300);
  await shot('16-admin-audit');
  await page.setInputFiles('input[type=file]', pdfPath);
  await page.waitForTimeout(800);
  console.log('verify by file:', await page.locator('[role=status]').innerText().catch(() => 'none'));
  await go('/admin/users');
  await shot('17-admin-users');
  await go('/admin/requests');
  await shot('18-admin-requests');

  // Reassign designation HoD EE → Faisal
  await go('/admin/designations');
  await page.selectOption('select[aria-label^="Holder of Head of Department, Electrical"]', 'staff-faisal');
  await page.click('div[role=dialog] button:has-text("Reassign")');
  await page.waitForTimeout(400);
  console.log('toast:', await page.locator('.toast-in').allInnerTexts().catch(() => ''));

  // Faisal: no signature → onboarding
  await logout();
  await login('staff', 'faisal.rehman@uni.edu.pk');
  console.log('faisal url', page.url());
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 120);
  await page.mouse.down();
  for (let i = 0; i < 30; i++) await page.mouse.move(box.x + 40 + i * 8, box.y + 120 + Math.sin(i / 2) * 30);
  await page.mouse.up();
  await shot('19-signature-onboarding', false);
  await page.click('button:has-text("Save signature")');
  await page.waitForTimeout(400);
  console.log('faisal after sig', page.url());

  // Public verify
  await go('/verify/EZ-2026-0398');
  await page.waitForTimeout(300);
  await shot('20-public-verify', false);

  // Reset password flow
  await logout();
  await go('/reset?email=hamza.tariq@student.uni.edu.pk');
  await page.click('button:has-text("Send code")');
  const code = (await page.locator('span.font-mono').innerText()).trim();
  await page.locator('input[aria-label="Digit 1"]').focus();
  await page.keyboard.type(code);
  await shot('21-reset-otp', false);
  await page.click('button:has-text("Verify code")');
  await page.fill('#np1', 'newpass1');
  await page.fill('#np2', 'newpass1');
  await page.click('button:has-text("Update password")');
  console.log('reset done:', await page.locator('h1').innerText());

  // Mobile swipe for Ayesha? She lost HoD; use Imran (dean) phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p2 = await phone.newPage();
  p2.on('pageerror', e => errors.push('phone pageerror: ' + e.message));
  // copy storage
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  await p2.goto(BASE);
  await p2.evaluate(s => { const o = JSON.parse(s); for (const k in o) localStorage.setItem(k, o[k]); }, storage);
  await p2.reload();
  await p2.goto(BASE + '#/login?role=staff');
  await p2.fill('#email', 'faisal.rehman@uni.edu.pk');
  await p2.fill('#password', '123');
  await p2.click('button[type=submit]');
  await p2.waitForTimeout(600);
  await p2.goto(BASE + '#/inbox');
  await p2.waitForTimeout(600);
  await p2.screenshot({ path: `${OUT}/22-phone-swipe.png` });
  console.log('phone url', p2.url());
  await p2.click('text=Read full document');
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: `${OUT}/23-phone-button.png` });
  // swipe approve via buttons on detail
  await p2.click('button:has-text("Approve & sign")');
  await p2.waitForTimeout(800);
  console.log('phone after approve:', await p2.locator('.toast-in').allInnerTexts());

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
