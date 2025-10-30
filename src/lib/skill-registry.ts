/**
 * Skill Registry
 * Provides reusable capabilities for agents using templates
 */

import { TemplateRenderer, type TemplateContext } from './template-renderer.js';
import { GuardedWriter } from './guarded-writer.js';
import { ContractGuard } from './contract-guard.js';
import { RunManager } from './run-manager.js';
import { join } from 'path';

export interface SkillParams {
  [key: string]: unknown;
}

export interface SkillResult {
  success: boolean;
  message: string;
  filePath?: string;
  error?: string;
}

export type SkillFunction = (params: SkillParams) => Promise<SkillResult>;

export interface SkillDefinition {
  name: string;
  description: string;
  agent: 'Forge' | 'Blink' | 'QA-Lens';
  parameters: Record<string, { type: string; description: string; required: boolean }>;
  execute: SkillFunction;
}

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private renderer: TemplateRenderer;
  private guardedWriter: GuardedWriter;

  constructor() {
    this.renderer = new TemplateRenderer();

    // Initialize writer with contract guard
    const contractGuard = new ContractGuard(join(process.cwd(), 'contracts/scopes.yaml'));
    const runManager = new RunManager();
    this.guardedWriter = new GuardedWriter(contractGuard, runManager);

    // Register built-in skills
    this.registerBuiltInSkills();

    // Register extended skills
    this.registerExtendedSkills();
  }

  /**
   * Register a custom skill
   */
  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Execute a skill by name
   */
  async executeSkill(skillName: string, params: SkillParams): Promise<SkillResult> {
    const skill = this.skills.get(skillName);

    if (!skill) {
      return {
        success: false,
        message: `Skill '${skillName}' not found`,
        error: 'Skill not registered',
      };
    }

    try {
      return await skill.execute(params);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Skill execution failed: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  /**
   * List all available skills
   */
  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * Register built-in skills
   */
  private registerBuiltInSkills(): void {
    // Forge skill: Create API endpoint
    this.registerSkill({
      name: 'scaffold_api_endpoint',
      description: 'Create a new Fastify API endpoint from template',
      agent: 'Forge',
      parameters: {
        path: { type: 'string', description: 'API endpoint path (e.g., /api/auth/login)', required: true },
        method: { type: 'string', description: 'HTTP method (get, post, put, delete)', required: true },
        description: { type: 'string', description: 'Endpoint description', required: true },
        requestFields: { type: 'array', description: 'Request body fields', required: false },
        responseFields: { type: 'array', description: 'Response body fields', required: false },
      },
      execute: async (params: SkillParams) => {
        const template = this.renderer.render('api/fastify-route.ts', {
          description: params.description,
          path: params.path,
          method: String(params.method).toLowerCase(),
          handlerName: this.toHandlerName(params.path as string),
          RequestType: this.toTypeName(params.path as string, 'Request'),
          ResponseType: this.toTypeName(params.path as string, 'Response'),
          requestFields: params.requestFields || [],
          responseFields: params.responseFields || [],
          businessLogic: [],
        } as TemplateContext);

        // Determine file path from endpoint path
        const filePath = this.pathToFilePath(params.path as string, 'api');

        // Write file using guarded writer
        const result = await this.guardedWriter.writeFileWithGuard('Forge', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });

    // Blink skill: Create HTML page
    this.registerSkill({
      name: 'create_html_page',
      description: 'Create a new HTML page from template',
      agent: 'Blink',
      parameters: {
        name: { type: 'string', description: 'Page name (e.g., login)', required: true },
        title: { type: 'string', description: 'Page title', required: true },
        heading: { type: 'string', description: 'Main heading', required: true },
        description: { type: 'string', description: 'Page description', required: true },
        formFields: { type: 'array', description: 'Form field definitions', required: false },
        apiEndpoint: { type: 'string', description: 'API endpoint for form submission', required: true },
      },
      execute: async (params: SkillParams) => {
        const template = this.renderer.render('ui/page.html', {
          title: params.title,
          heading: params.heading,
          description: params.description,
          maxWidth: 500,
          formFields: params.formFields || [],
          buttonText: 'Submit',
          apiEndpoint: params.apiEndpoint,
          successMessage: 'Success!',
        } as TemplateContext);

        const filePath = `ui/${params.name}.html`;
        const result = await this.guardedWriter.writeFileWithGuard('Blink', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });

    // QA-Lens skill: Create validation flow
    this.registerSkill({
      name: 'create_validation_flow',
      description: 'Create a new validation flow from template',
      agent: 'QA-Lens',
      parameters: {
        name: { type: 'string', description: 'Flow name (e.g., auth_login)', required: true },
        description: { type: 'string', description: 'What this flow tests', required: true },
        pagePath: { type: 'string', description: 'Path to page being tested', required: true },
        mainSelector: { type: 'string', description: 'Main page selector to verify load', required: true },
        testSteps: { type: 'array', description: 'Test step definitions', required: true },
      },
      execute: async (params: SkillParams) => {
        const template = this.renderer.render('checks/validation-flow.yaml', {
          name: params.name,
          description: params.description,
          flowName: `test/${params.name}`,
          pagePath: params.pagePath,
          mainSelector: params.mainSelector,
          testSteps: params.testSteps || [],
          screenshotName: params.name,
        } as TemplateContext);

        const filePath = `checks/flows/${params.name}.yaml`;
        const result = await this.guardedWriter.writeFileWithGuard('QA-Lens', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });
  }

  /**
   * Register extended skills (production skills library)
   */
  private registerExtendedSkills(): void {
    // Database Model Skill
    this.registerSkill({
      name: 'create_database_model',
      description: 'Generate a TypeScript database model with repository',
      agent: 'Forge',
      parameters: {
        modelName: { type: 'string', description: 'Model name (e.g., User)', required: true },
        fields: { type: 'array', description: 'Model fields with name and type', required: true },
        tableName: { type: 'string', description: 'Database table name', required: false },
      },
      execute: async (params: SkillParams) => {
        const modelName = String(params.modelName);
        const tableName = params.tableName as string || modelName.toLowerCase() + 's';
        const modelPrefix = modelName.toLowerCase().substring(0, 3);

        const template = this.renderer.render('api/database-model.ts', {
          ModelName: modelName,
          tableName,
          modelPrefix,
          fields: params.fields || [],
        });

        const filePath = `api/models/${modelName.toLowerCase()}.ts`;
        const result = await this.guardedWriter.writeFileWithGuard('Forge', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });

    // React Component Skill
    this.registerSkill({
      name: 'create_react_component',
      description: 'Generate a React TypeScript component',
      agent: 'Blink',
      parameters: {
        componentName: { type: 'string', description: 'Component name (e.g., UserProfile)', required: true },
        props: { type: 'array', description: 'Component props', required: false },
        hasState: { type: 'boolean', description: 'Include state management', required: false },
        hasEffects: { type: 'boolean', description: 'Include useEffect hooks', required: false },
      },
      execute: async (params: SkillParams) => {
        const componentName = String(params.componentName);
        const className = componentName.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase();

        const template = this.renderer.render('ui/react-component.tsx', {
          ComponentName: componentName,
          className,
          heading: componentName.replace(/([A-Z])/g, ' $1').trim(),
          props: params.props || [],
          hasState: params.hasState || false,
          hasEffects: params.hasEffects || false,
          stateType: 'any',
          initialState: 'null',
        });

        const filePath = `ui/components/${componentName}.tsx`;
        const result = await this.guardedWriter.writeFileWithGuard('Blink', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });

    // Unit Test Skill
    this.registerSkill({
      name: 'create_unit_test',
      description: 'Generate a Vitest unit test file',
      agent: 'QA-Lens',
      parameters: {
        moduleName: { type: 'string', description: 'Module being tested', required: true },
        modulePath: { type: 'string', description: 'Relative path to module', required: true },
        importName: { type: 'string', description: 'What to import from module', required: true },
        tests: { type: 'array', description: 'Test case definitions', required: true },
      },
      execute: async (params: SkillParams) => {
        const template = this.renderer.render('tests/unit-test.ts', {
          moduleName: String(params.moduleName),
          modulePath: String(params.modulePath),
          importName: String(params.importName),
          tests: params.tests || [],
          needsMocks: params.needsMocks || false,
          hasErrorCases: params.hasErrorCases || false,
        });

        const moduleName = String(params.moduleName).toLowerCase().replace(/\s+/g, '-');
        const filePath = `tests/unit/${moduleName}.test.ts`;
        const result = await this.guardedWriter.writeFileWithGuard('QA-Lens', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });

    // Middleware Skill
    this.registerSkill({
      name: 'create_api_middleware',
      description: 'Generate a Fastify middleware function',
      agent: 'Forge',
      parameters: {
        middlewareName: { type: 'string', description: 'Middleware name (e.g., authMiddleware)', required: true },
        description: { type: 'string', description: 'What the middleware does', required: true },
        validations: { type: 'array', description: 'Validation rules', required: false },
      },
      execute: async (params: SkillParams) => {
        const middlewareName = String(params.middlewareName);
        const MiddlewareName = middlewareName.charAt(0).toUpperCase() + middlewareName.slice(1);

        const template = this.renderer.render('api/middleware.ts', {
          MiddlewareName,
          middlewareName,
          description: String(params.description),
          options: params.options || [],
          validations: params.validations || [],
          hasLogging: params.hasLogging !== false,
          logMessage: String(params.logMessage || `Processing ${middlewareName}`),
        });

        const filePath = `api/middleware/${middlewareName}.ts`;
        const result = await this.guardedWriter.writeFileWithGuard('Forge', filePath, template);

        return {
          success: result.success,
          message: result.success ? `Created ${filePath}` : result.error || 'Write failed',
          filePath: result.path,
          error: result.error,
        };
      },
    });
  }

  /**
   * Convert API path to handler name
   */
  private toHandlerName(path: string): string {
    return path
      .split('/')
      .filter(Boolean)
      .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('') + 'Handler';
  }

  /**
   * Convert API path to TypeScript type name
   */
  private toTypeName(path: string, suffix: string): string {
    return (
      path
        .split('/')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') + suffix
    );
  }

  /**
   * Convert API path to file path
   */
  private pathToFilePath(apiPath: string, prefix: string): string {
    const cleanPath = apiPath.replace(/^\//, '').replace(/\/$/, '');
    return `${prefix}/${cleanPath}.ts`;
  }
}
