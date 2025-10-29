/**
 * Template Renderer
 * Simple template system for rendering code templates with variable interpolation
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface TemplateContext {
  [key: string]: string | number | boolean | object | Array<unknown>;
}

export class TemplateRenderer {
  private templatesDir: string;

  constructor(templatesDir = 'templates') {
    this.templatesDir = join(process.cwd(), templatesDir);
  }

  /**
   * Render a template with given context
   */
  render(templatePath: string, context: TemplateContext): string {
    const fullPath = join(this.templatesDir, templatePath);
    let template = readFileSync(fullPath, 'utf-8');

    // Simple variable interpolation: {{variableName}}
    template = this.interpolateVariables(template, context);

    // Handle conditional sections: {{#variableName}}...{{/variableName}}
    template = this.interpolateSections(template, context);

    return template;
  }

  /**
   * Interpolate simple variables
   */
  private interpolateVariables(template: string, context: TemplateContext): string {
    return template.replace(/\{\{([^#/][^}]*)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();

      // Handle nested properties (e.g., {{user.name}})
      const value = this.getValue(context, trimmedKey);

      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Interpolate conditional sections
   */
  private interpolateSections(template: string, context: TemplateContext): string {
    // Match {{#key}}...{{/key}} blocks
    const sectionRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

    return template.replace(sectionRegex, (match, key, content) => {
      const value = context[key];

      // If value is an array, repeat content for each item
      if (Array.isArray(value)) {
        return value
          .map((item, index) => {
            const itemContext = {
              ...context,
              ...item,
              index,
              first: index === 0,
              last: index === value.length - 1,
            };
            return this.interpolateVariables(content, itemContext);
          })
          .join('');
      }

      // If value is truthy, include the section
      if (value) {
        return this.interpolateVariables(content, context);
      }

      // Otherwise, exclude the section
      return '';
    });
  }

  /**
   * Get nested property value from context
   */
  private getValue(context: TemplateContext, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if template exists
   */
  templateExists(templatePath: string): boolean {
    try {
      const fullPath = join(this.templatesDir, templatePath);
      readFileSync(fullPath, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
