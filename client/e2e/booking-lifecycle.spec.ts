import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

function isoInDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text());
  });
  return errors;
}

test('home page renders the fleet and working contact links', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('a[href="tel:+919047339000"]').first()).toBeVisible();
  const wa = page.locator('a[href^="https://wa.me/919047339000?text="]').first();
  await expect(wa).toHaveAttribute('href', /text=Hello%20Elite%20Travel%20Hub/);
  await expect(page.getByRole('tab', { name: /Tourist buses/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('vehicle catalogue filters and search work', async ({ page }) => {
  await page.goto('/vehicles');
  const cards = page.locator('article');
  const all = await cards.count();
  expect(all).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Travel cars' }).click();
  await expect(page).toHaveURL(/type=car/);
  const cars = await cards.count();
  expect(cars).toBeLessThan(all);
  await page.getByRole('button', { name: 'All vehicles' }).click();
  await page.getByPlaceholder('Search name or model').fill('zzzz-no-match');
  await expect(page.getByText('No vehicles match.')).toBeVisible();
});

test('booking form validates on the client before submitting', async ({ page }) => {
  await page.goto('/book');
  await page.getByRole('button', { name: /Send booking request/ }).click();
  await expect(page.getByText('Where should we pick you up?')).toBeVisible();
  await expect(page.getByText('Please enter your name')).toBeVisible();
  await expect(page.getByText('Enter a valid mobile number')).toBeVisible();
});

test('full lifecycle: customer requests → admin confirms → customer sees confirmed', async ({ browser }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
  const phone = `9${String(Date.now()).slice(-9)}`;
  const tripDate = isoInDays(200 + Math.floor(Math.random() * 100));

  // 1. Customer books a specific vehicle from its detail page (mobile viewport)
  const customer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = await collectErrors(customer);
  await customer.goto('/vehicles');
  await customer.locator('article').first().getByRole('link', { name: 'View details', exact: true }).click();
  await expect(customer.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
  await customer.getByRole('link', { name: 'Book this vehicle' }).click();
  await customer.getByRole('radio', { name: 'One way' }).check({ force: true });
  await customer.getByLabel('Pickup location').fill('Thiruvrambu');
  await customer.getByLabel('Destination').fill('Kanyakumari');
  await customer.getByLabel('Trip date').fill(tripDate);
  await customer.getByLabel('Pickup time').fill('07:15');
  await customer.getByLabel('Passengers').fill('6');
  await customer.getByLabel('Full name').fill('E2E Customer');
  await customer.getByLabel('Mobile number').fill(phone);
  await customer.getByRole('button', { name: /Send booking request/ }).click();

  await expect(customer.getByRole('heading', { name: 'Request received.' })).toBeVisible();
  await expect(customer.getByText('Pending confirmation')).toBeVisible();
  const reference = (await customer.locator('p.font-mono').first().textContent())!.trim();
  expect(reference).toMatch(/^ETH-\d{4}-[A-Z0-9]{5}$/);

  // 2. Admin signs in, finds it by reference and confirms
  const admin = await browser.newPage();
  await admin.goto('/admin');
  await admin.getByLabel('Email').fill(ADMIN_EMAIL!);
  await admin.getByLabel('Password').fill(ADMIN_PASSWORD!);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin.getByText(/Hello,/)).toBeVisible();
  await admin.goto('/admin/bookings');
  await admin.getByPlaceholder('Search name, phone or reference').fill(reference);
  await expect(admin.getByText('1 booking match your filters')).toBeVisible();
  await admin.locator(`a:visible:has-text("${reference}")`).first().click();
  await admin.getByRole('button', { name: 'Confirm booking' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click();
  await expect(admin.getByText('Booking confirmed.')).toBeVisible();
  await expect(admin.getByText('Pending → Confirmed')).toBeVisible();

  // 3. Customer checks status
  await customer.goto(`/booking/status?ref=${reference}`);
  await customer.getByLabel('Mobile number').fill(phone);
  await customer.getByRole('button', { name: 'Check status' }).click();
  await expect(customer.getByText('Confirmed', { exact: true }).first()).toBeVisible();
  await expect(customer.getByText('Hello, E2E.')).toBeVisible();

  // 4. A second request for the same vehicle and date is refused
  await customer.goto('/vehicles');
  await customer.locator('article').first().getByRole('link', { name: 'Book this vehicle' }).click();
  await expect(customer.getByRole('heading', { name: /Plan the/ })).toBeVisible();
  await customer.getByLabel('Trip date').fill(tripDate);
  await expect(customer.getByText(/already booked or unavailable/)).toBeVisible();

  // 5. Clean up: cancel so repeated runs stay tidy, then sign out
  await admin.getByRole('button', { name: 'Cancel booking' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click();
  await expect(admin.getByText('Confirmed → Cancelled')).toBeVisible();
  await admin.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(admin.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await admin.goto('/admin/bookings');
  await expect(admin.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  expect(errors).toEqual([]);
});
