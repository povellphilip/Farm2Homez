import { expect, test, type Browser, type Page } from '@playwright/test';

/* Journeys share one seeded database and run in order. Demo accounts come from `seed_demo`. */
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'FarmDemo2026';
const SHOPPER = 'asha@demo.farm2home.example';
const GREEN_VALLEY = 'greenvalley@demo.farm2home.example';
const NILGIRI = 'nilgiribees@demo.farm2home.example';
const PENDING_FARM = 'newfarm@demo.farm2home.example';
const ADMIN = 'admin@demo.farm2home.example';

async function signIn(browser: Browser, portal: 'consumer' | 'producer' | 'admin', email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/${portal}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/${portal}/dashboard$`));
  return page;
}

let orderNumber = '';

test('a shopper buys from two farms in one checkout', async ({ browser }) => {
  const page = await signIn(browser, 'consumer', SHOPPER);

  await page.goto('/products?search=avocado');
  await page.getByRole('button', { name: 'Add Hass Avocado to basket' }).click();
  await expect(page.getByText('Hass Avocado added to your basket.')).toBeVisible();

  await page.goto('/categories/honey-bee-products');
  await page.getByRole('button', { name: 'Add Wild Forest Honey to basket' }).click();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();

  await page.getByRole('link', { name: 'Cart, 2 items' }).click();
  await expect(page.getByRole('link', { name: 'Green Valley Farms' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nilgiri Bee Collective' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();

  await page.getByLabel('Full name').fill('Asha Menon');
  await page.getByLabel('Phone').fill('+91 99000 00111');
  await page.getByLabel('Address', { exact: true }).fill('12 MG Road');
  await page.getByLabel('City or town').fill('Kochi');
  await page.getByLabel('State').fill('Kerala');
  await page.getByLabel('PIN code').fill('682001');
  await page.getByRole('button', { name: /Place order/ }).click();

  await expect(page.getByRole('heading', { name: 'Thank you, your order is placed' })).toBeVisible();
  orderNumber = (await page.getByRole('heading', { name: /^Order F2H-/ }).textContent())!.replace('Order ', '');
  // One independently tracked part per farm.
  await expect(page.getByRole('list', { name: 'Delivery progress' })).toHaveCount(2);

  await page.goto('/consumer/orders');
  await expect(page.getByText(orderNumber)).toBeVisible();
});

test('each farm fulfils only its own part, and the shopper can review once delivered', async ({ browser }) => {
  const farm = await signIn(browser, 'producer', GREEN_VALLEY);
  await farm.getByRole('link', { name: 'Orders', exact: true }).first().click();
  await farm.getByRole('link', { name: new RegExp(orderNumber) }).click();
  await expect(farm.getByText('Hass Avocado').first()).toBeVisible();
  await expect(farm.getByText('Wild Forest Honey')).toHaveCount(0); // another farm's item is never shown

  for (const action of ['Accept order', 'Mark as preparing', 'Mark as shipped', 'Mark as delivered']) {
    await farm.getByRole('button', { name: action }).click();
    await expect(farm.getByRole('button', { name: action })).toHaveCount(0);
  }
  await expect(farm.getByText('Delivered').first()).toBeVisible();

  const bees = await signIn(browser, 'producer', NILGIRI);
  await bees.goto('/producer/orders?status=PENDING');
  await bees.getByRole('link', { name: new RegExp(orderNumber) }).click();
  await bees.getByRole('button', { name: 'Decline order' }).click();
  await bees.getByRole('button', { name: 'Decline order' }).last().click();
  await expect(bees.getByText('Please add a short reason.')).toBeVisible();
  await bees.getByLabel('Reason for the customer').fill('This batch sold out at the market.');
  await bees.getByRole('button', { name: 'Decline order' }).last().click();
  await expect(bees.getByText('Declined by farm').first()).toBeVisible();

  const shopper = await signIn(browser, 'consumer', SHOPPER);
  await shopper.goto(`/consumer/orders/${orderNumber}`);
  await expect(shopper.getByText('This batch sold out at the market.')).toBeVisible();
  await expect(shopper.getByText('Completed')).toBeVisible();
  await shopper.getByRole('button', { name: 'Write a review' }).click();
  await shopper.getByLabel('Comments').fill('Creamy and perfectly ripe.');
  await shopper.getByRole('button', { name: 'Post review' }).click();
  await expect(shopper.getByText('Thanks for your review!')).toBeVisible();
});

test('an unverified farm can only publish after an admin verifies it', async ({ browser }) => {
  const farm = await signIn(browser, 'producer', PENDING_FARM);
  await expect(farm.getByText('Your farm is waiting for verification.')).toBeVisible();
  await farm.goto('/producer/products/new');
  await farm.getByLabel('Product name').fill('Kuttanad Spinach');
  await farm.getByLabel('Category', { exact: true }).selectOption('vegetables');
  await farm.getByLabel('Description').fill('Tender spinach picked the morning it ships.');
  await farm.getByLabel('Price (₹)').fill('40');
  await farm.getByLabel('Sold per').selectOption('bunch');
  await farm.getByLabel('Available quantity').fill('30');
  await farm.getByLabel('Origin').fill('Alappuzha, Kerala');
  await expect(farm.getByRole('button', { name: 'Save & publish' })).toBeDisabled();
  await farm.getByRole('button', { name: 'Save as draft' }).click();
  await expect(farm).toHaveURL(/\/producer\/products\/\d+$/);

  const admin = await signIn(browser, 'admin', ADMIN);
  await admin.goto('/admin/producers');
  await admin.getByRole('button', { name: 'Verify farm' }).click();
  await admin.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(admin.getByText('Kuttanad Paddy & Greens is verified.')).toBeVisible();

  await farm.reload();
  await expect(farm.getByText('Your farm is waiting for verification.')).toHaveCount(0);
  await farm.getByRole('button', { name: 'Publish' }).click();
  await expect(farm.getByText('Published. Your listing is live.')).toBeVisible();
  await farm.goto('/products?search=spinach');
  await expect(farm.getByRole('heading', { name: 'Kuttanad Spinach' })).toBeVisible();
});

test('an admin removes a listing and it leaves the marketplace', async ({ browser }) => {
  const admin = await signIn(browser, 'admin', ADMIN);
  await admin.goto('/admin/products?search=beeswax');
  await admin.getByRole('button', { name: 'Remove' }).click();
  await admin.getByLabel('Reason for the farm').fill('Please add a photo of the actual block.');
  await admin.getByRole('button', { name: 'Remove listing' }).click();
  await expect(admin.getByText('Listing removed.')).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto('/products?search=beeswax');
  await expect(visitor.getByText('Nothing matches yet')).toBeVisible();

  await admin.goto('/admin/audit-log');
  await expect(admin.getByText('product.rejected').first()).toBeVisible();
});

test('consumers cannot open other portals', async ({ browser }) => {
  const page = await signIn(browser, 'consumer', SHOPPER);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: "This area isn't for your account" })).toBeVisible();
  const status = await page.evaluate(async () => (await fetch('/api/admin/users/')).status);
  expect(status).toBe(401); // no bearer token on a raw fetch, and the server checks role on every call anyway
});

test('the site works on a phone', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Farms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The farms behind your food' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
