import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/* Automated WCAG 2.1 AA checks (axe) on the main pages. Fails on serious or critical issues. */

async function audit(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
  const summary = blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).slice(0, 3).join(', ')})`);
  expect(summary, `${label} accessibility violations`).toEqual([]);
}

const PUBLIC_PAGES = ['/', '/products', '/categories/fruits', '/farms', '/about', '/faq', '/contact', '/consumer/login', '/consumer/register', '/producer/register', '/admin/login'];

for (const path of PUBLIC_PAGES) {
  test(`public page ${path} has no serious accessibility issues`, async ({ page }) => {
    await page.goto(path);
    await audit(page, path);
  });
}

test('product page has no serious accessibility issues', async ({ page, request }) => {
  const { results } = await (await request.get('/api/products/?search=avocado')).json();
  await page.goto(`/products/${results[0].slug}`);
  await audit(page, 'product page');
});

for (const [portal, email, paths] of [
  ['consumer', 'vikram@demo.farm2home.example', ['/consumer/dashboard', '/consumer/addresses', '/cart']],
  ['producer', 'malnad@demo.farm2home.example', ['/producer/dashboard', '/producer/products', '/producer/products/new', '/producer/farm']],
  ['admin', 'admin@demo.farm2home.example', ['/admin/dashboard', '/admin/producers', '/admin/users', '/admin/products']],
] as const) {
  test(`${portal} portal has no serious accessibility issues`, async ({ page }) => {
    await page.goto(`/${portal}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('FarmDemo2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(new RegExp(`/${portal}/dashboard$`));
    for (const path of paths) {
      await page.goto(path);
      await audit(page, path);
    }
  });
}
