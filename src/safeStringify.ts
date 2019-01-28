import { SchemaDefinition } from 'js-yaml';
import { safeDump } from 'yaml-ast-parser';

export interface IDumpOptions {
  /** indentation width to use (in spaces). */
  indent?: number;
  /** do not throw on invalid types (like function in the safe schema) and skip pairs and single values with such types. */
  skipInvalid?: boolean;
  /** specifies level of nesting, when to switch from block to flow style for collections. -1 means block style everwhere */
  flowLevel?: number;
  /** Each tag may have own set of styles.	- "tag" => "style" map. */
  styles?: { [x: string]: any };
  /** specifies a schema to use. */
  schema?: SchemaDefinition;
}

export const safeStringify = (value: any, options?: IDumpOptions): string => {
  if (!value || typeof value === 'string') return value;

  return safeDump(value, options);
};
