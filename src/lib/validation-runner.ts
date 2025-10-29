import { chromium, Browser, Page } from 'playwright';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';
import { ValidationFlow, ValidationStep } from '../types/index.js';
import { join } from 'path';

export interface ValidationResult {
  success: boolean;
  flowName: string;
  steps: number;
  completedSteps: number;
  duration_ms: number;
  error?: string;
  screenshots: string[];
}

export class ValidationRunner {
  private browser: Browser | null = null;
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  async runFlow(
    flowPath: string,
    env: Record<string, string> = {},
    runId: string = Date.now().toString()
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const screenshots: string[] = [];

    try {
      // Read and parse flow
      const flowFile = await readFile(join(this.rootDir, flowPath), 'utf-8');
      const flow = parse(flowFile) as ValidationFlow;

      // Launch browser
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      const page = await context.newPage();

      let completedSteps = 0;

      // Execute steps
      for (const step of flow.steps) {
        await this.executeStep(step, page, env, runId, screenshots);
        completedSteps++;
      }

      await this.browser.close();
      this.browser = null;

      return {
        success: true,
        flowName: flow.name,
        steps: flow.steps.length,
        completedSteps,
        duration_ms: Date.now() - startTime,
        screenshots,
      };
    } catch (error) {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      return {
        success: false,
        flowName: flowPath,
        steps: 0,
        completedSteps: 0,
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        screenshots,
      };
    }
  }

  private async executeStep(
    step: ValidationStep,
    page: Page,
    env: Record<string, string>,
    runId: string,
    screenshots: string[]
  ): Promise<void> {
    if ('open' in step) {
      const url = this.interpolateEnv(step.open, env);
      await page.goto(url);
    } else if ('assert' in step) {
      const selector = step.assert;
      await page.waitForSelector(selector, { timeout: 5000 });
    } else if ('type' in step) {
      const { selector, text } = step.type;
      await page.fill(selector, text);
    } else if ('click' in step) {
      await page.click(step.click);
    } else if ('wait_for' in step) {
      await page.waitForSelector(step.wait_for, { timeout: 10000 });
    } else if ('screenshot' in step) {
      const screenshotPath = this.interpolateEnv(step.screenshot, {
        ...env,
        run_id: runId,
      });
      const fullPath = join(this.rootDir, screenshotPath);
      await page.screenshot({ path: fullPath, fullPage: true });
      screenshots.push(screenshotPath);
    }
  }

  private interpolateEnv(template: string, env: Record<string, string>): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => env[key] || '');
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
