// Cross-resource filtering utilities

import { DatabaseQueries } from '../database/queries.js';
import { parseLabelSelector, labelSelectorsToSQL } from './label-selectors.js';

/**
 * Find clusters that match the cluster selector
 */
export async function findMatchingClusters(
  clusterSelector: string,
  dbQueries: DatabaseQueries
): Promise<string[]> {
  if (!clusterSelector || clusterSelector.trim() === '') {
    return [];
  }

  try {
    // Parse the cluster selector
    const selectors = parseLabelSelector(clusterSelector);
    if (selectors.length === 0) {
      return [];
    }

    // Build SQL query to find matching ManagedCluster resources
    const { conditions, params } = labelSelectorsToSQL(selectors, 'data');

    let sql = `
      SELECT DISTINCT cluster
      FROM search.resources
      WHERE data->>'kind' = 'ManagedCluster'
    `;

    if (conditions.length > 0) {
      sql += ` AND ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY cluster`;

    const result = await dbQueries.executeQuery(sql, params);
    return result.rows.map(row => row[0] as string);
  } catch (error) {
    console.error('Error finding matching clusters:', error);
    throw new Error(`Failed to parse cluster selector: ${clusterSelector}`);
  }
}

/**
 * Convert array of values to SQL IN clause
 */
export function arrayToSQLIn(
  values: string | string[],
  paramStartIndex: number
): { condition: string, params: string[], nextParamIndex: number } {
  const valueArray = Array.isArray(values) ? values : [values];

  if (valueArray.length === 0) {
    return { condition: '1=0', params: [], nextParamIndex: paramStartIndex }; // Always false
  }

  if (valueArray.length === 1) {
    return {
      condition: `$${paramStartIndex}`,
      params: valueArray,
      nextParamIndex: paramStartIndex + 1
    };
  }

  const placeholders = valueArray.map((_, index) => `$${paramStartIndex + index}`).join(',');
  return {
    condition: `(${placeholders})`,
    params: valueArray,
    nextParamIndex: paramStartIndex + valueArray.length
  };
}

/**
 * Build text search conditions for searching across resource fields
 */
export function buildTextSearchConditions(
  searchText: string,
  dataColumn: string = 'data'
): { conditions: string[], params: string[] } {
  if (!searchText || searchText.trim() === '') {
    return { conditions: [], params: [] };
  }

  const trimmedText = searchText.trim();
  const searchPattern = `%${trimmedText}%`;

  // Search across common fields
  const conditions = [
    `${dataColumn}->>'name' ILIKE $1`,
    `${dataColumn}->>'namespace' ILIKE $1`,
    `${dataColumn}::text ILIKE $1` // Full text search in JSON
  ];

  return {
    conditions: [`(${conditions.join(' OR ')})`],
    params: [searchPattern]
  };
}

/**
 * Parse status values and return appropriate SQL conditions
 */
export function buildStatusConditions(
  status: string | string[],
  dataColumn: string = 'data',
  paramStartIndex: number = 1
): { conditions: string[], params: string[], nextParamIndex: number } {
  const statusArray = Array.isArray(status) ? status : [status];

  if (statusArray.length === 0) {
    return { conditions: [], params: [], nextParamIndex: paramStartIndex };
  }

  if (statusArray.length === 1) {
    return {
      conditions: [`${dataColumn}->>'status' = $${paramStartIndex}`],
      params: statusArray,
      nextParamIndex: paramStartIndex + 1
    };
  }

  const placeholders = statusArray.map((_, index) => `$${paramStartIndex + index}`).join(',');
  return {
    conditions: [`${dataColumn}->>'status' IN (${placeholders})`],
    params: statusArray,
    nextParamIndex: paramStartIndex + statusArray.length
  };
}

/**
 * Build namespace filtering conditions
 */
export function buildNamespaceConditions(
  namespace: string | string[],
  dataColumn: string = 'data',
  paramStartIndex: number = 1
): { conditions: string[], params: string[], nextParamIndex: number } {
  const namespaceArray = Array.isArray(namespace) ? namespace : [namespace];

  if (namespaceArray.length === 0) {
    return { conditions: [], params: [], nextParamIndex: paramStartIndex };
  }

  if (namespaceArray.length === 1) {
    return {
      conditions: [`${dataColumn}->>'namespace' = $${paramStartIndex}`],
      params: namespaceArray,
      nextParamIndex: paramStartIndex + 1
    };
  }

  const placeholders = namespaceArray.map((_, index) => `$${paramStartIndex + index}`).join(',');
  return {
    conditions: [`${dataColumn}->>'namespace' IN (${placeholders})`],
    params: namespaceArray,
    nextParamIndex: paramStartIndex + namespaceArray.length
  };
}

/**
 * Build cluster filtering conditions
 */
export function buildClusterConditions(
  cluster: string | string[],
  paramStartIndex: number = 1
): { conditions: string[], params: string[], nextParamIndex: number } {
  const clusterArray = Array.isArray(cluster) ? cluster : [cluster];

  if (clusterArray.length === 0) {
    return { conditions: [], params: [], nextParamIndex: paramStartIndex };
  }

  if (clusterArray.length === 1) {
    return {
      conditions: [`cluster = $${paramStartIndex}`],
      params: clusterArray,
      nextParamIndex: paramStartIndex + 1
    };
  }

  const placeholders = clusterArray.map((_, index) => `$${paramStartIndex + index}`).join(',');
  return {
    conditions: [`cluster IN (${placeholders})`],
    params: clusterArray,
    nextParamIndex: paramStartIndex + clusterArray.length
  };
}

/**
 * Build kind filtering conditions
 */
export function buildKindConditions(
  kind: string | string[],
  dataColumn: string = 'data',
  paramStartIndex: number = 1
): { conditions: string[], params: string[], nextParamIndex: number } {
  const kindArray = Array.isArray(kind) ? kind : [kind];

  if (kindArray.length === 0) {
    return { conditions: [], params: [], nextParamIndex: paramStartIndex };
  }

  if (kindArray.length === 1) {
    return {
      conditions: [`${dataColumn}->>'kind' = $${paramStartIndex}`],
      params: kindArray,
      nextParamIndex: paramStartIndex + 1
    };
  }

  const placeholders = kindArray.map((_, index) => `$${paramStartIndex + index}`).join(',');
  return {
    conditions: [`${dataColumn}->>'kind' IN (${placeholders})`],
    params: kindArray,
    nextParamIndex: paramStartIndex + kindArray.length
  };
}

/**
 * Build name filtering conditions (supports exact match and regex)
 */
export function buildNameConditions(
  name: string,
  dataColumn: string = 'data',
  paramStartIndex: number = 1
): { conditions: string[], params: string[], nextParamIndex: number } {
  if (!name || name.trim() === '') {
    return { conditions: [], params: [], nextParamIndex: paramStartIndex };
  }

  // Check if it looks like a regex pattern
  if (name.includes('*') || name.includes('?') || name.includes('[')) {
    // Convert shell-style wildcards to SQL LIKE pattern
    const likePattern = name.replace(/\*/g, '%').replace(/\?/g, '_');
    return {
      conditions: [`${dataColumn}->>'name' ILIKE $${paramStartIndex}`],
      params: [likePattern],
      nextParamIndex: paramStartIndex + 1
    };
  }

  // Exact match
  return {
    conditions: [`${dataColumn}->>'name' = $${paramStartIndex}`],
    params: [name],
    nextParamIndex: paramStartIndex + 1
  };
}