import { expect, test } from '@playwright/test';

test('student signs in, opens a lesson and asks the AI tutor', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('student@gvpathshala.dev');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await page.getByRole('link', { name: 'Resume lesson' }).click();

  await page.getByLabel('Ask the AI tutor').fill('What does justify-content do?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText(/main axis/i).first()).toBeVisible({ timeout: 20_000 });
});

test('tutor declines a question the course does not cover', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('student@gvpathshala.dev');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Resume lesson' }).click();
  await page.getByLabel('Ask the AI tutor').fill('Who won the 2018 football World Cup?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText(/can't find that/i)).toBeVisible({ timeout: 20_000 });
});
