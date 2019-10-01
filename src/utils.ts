export const isObject = (sth: unknown): sth is object => sth !== null && typeof sth === 'object';
