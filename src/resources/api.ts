import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Define ACM resource interface based on the actual schema format
export interface ACMResource {
  name: string;
  kind: string;
  apiVersion: string;
  description: string;
  categories: string[];
  labels: string[];
  usageHint: string;
  schema: any;
  example: any;
}

// Resource manager class
export class ResourceManager {
  private resources: Map<string, ACMResource> = new Map();

  constructor() {
    this.loadSchemas();
  }

  // Load all schema files from the schemas directory
  private loadSchemas(): void {
    const schemasDir = join(__dirname, 'schemas');

    try {
      const schemaFiles = readdirSync(schemasDir).filter(file => file.endsWith('.json'));

      for (const file of schemaFiles) {
        const resourceName = file.replace('.json', '');
        const schemaData = this.loadSchemaFile(join(schemasDir, file));

        if (schemaData) {
          this.resources.set(resourceName.toLowerCase(), {
            name: schemaData.name || resourceName,
            kind: schemaData.kind || resourceName,
            apiVersion: schemaData.apiVersion || 'unknown',
            description: schemaData.description || `ACM ${resourceName} resource`,
            categories: schemaData.categories || [],
            labels: schemaData.labels || [],
            usageHint: schemaData.usageHint || '',
            schema: schemaData.schema || {},
            example: schemaData.example || {}
          });
        }
      }

      console.error(`Loaded ${this.resources.size} ACM resources`);
    } catch (error) {
      console.error(`Error loading schemas from ${schemasDir}:`, error);
    }
  }

  // Load schema file
  private loadSchemaFile(filePath: string): any {
    try {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error loading schema from ${filePath}:`, error);
      return null;
    }
  }

  // Get resource by name
  public getResource(name: string): ACMResource | undefined {
    return this.resources.get(name.toLowerCase());
  }

  // Get all resources
  public getAllResources(): ACMResource[] {
    return Array.from(this.resources.values());
  }

  // Get complete resource information
  public getResourceInfo(name: string): {
    resource: ACMResource;
    schemaProperties: string[];
  } | null {
    const resource = this.getResource(name);
    if (!resource) {
      return null;
    }

    // Extract properties from schema.spec if available
    const schemaProperties = resource.schema?.spec
      ? Object.keys(resource.schema.spec)
      : [];

    return {
      resource,
      schemaProperties
    };
  }
}

// Create global resource manager instance
export const resourceManager = new ResourceManager();
