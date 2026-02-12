import { Customer, EntityLabels, EntityLabelConfig } from '@/models/types';

const DEFAULTS: Required<EntityLabels> = {
  location:    { singular: 'Location',    plural: 'Locations' },
  subLocation: { singular: 'SubLocation', plural: 'SubLocations' },
  venue:       { singular: 'Venue',       plural: 'Venues' },
  event:       { singular: 'Event',       plural: 'Events' },
};

/**
 * Industry-specific label presets that can be assigned to customers.
 */
export const ENTITY_LABEL_PRESETS: Record<string, EntityLabels> = {
  default: { ...DEFAULTS },
  facilities: {
    location:    { singular: 'Facility',   plural: 'Facilities' },
    subLocation: { singular: 'Sub-Facility', plural: 'Sub-Facilities' },
  },
  parking: {
    location:    { singular: 'Asset', plural: 'Assets' },
    subLocation: { singular: 'Lot',   plural: 'Lots' },
  },
  hospitality: {
    location:    { singular: 'Property', plural: 'Properties' },
    subLocation: { singular: 'Wing',     plural: 'Wings' },
  },
  campus: {
    location:    { singular: 'Campus',   plural: 'Campuses' },
    subLocation: { singular: 'Building', plural: 'Buildings' },
  },
  retail: {
    location:    { singular: 'Store',      plural: 'Stores' },
    subLocation: { singular: 'Department', plural: 'Departments' },
  },
  healthcare: {
    location:    { singular: 'Hospital', plural: 'Hospitals' },
    subLocation: { singular: 'Ward',     plural: 'Wards' },
  },
};

/**
 * Resolves an entity label for a given customer, falling back to system defaults.
 *
 * @param customer  The customer whose labels to use (null = use defaults)
 * @param entity    Which entity type ('location' | 'subLocation' | 'venue' | 'event')
 * @param form      'singular' or 'plural' (default: 'singular')
 */
export function getEntityLabel(
  customer: Pick<Customer, 'entityLabels'> | null | undefined,
  entity: keyof EntityLabels,
  form: 'singular' | 'plural' = 'singular'
): string {
  return customer?.entityLabels?.[entity]?.[form] ?? DEFAULTS[entity][form];
}

/**
 * Returns the full resolved EntityLabelConfig (singular + plural) for an entity,
 * merging customer overrides with defaults.
 */
export function getEntityLabelConfig(
  customer: Pick<Customer, 'entityLabels'> | null | undefined,
  entity: keyof EntityLabels
): EntityLabelConfig {
  return {
    singular: customer?.entityLabels?.[entity]?.singular ?? DEFAULTS[entity].singular,
    plural:   customer?.entityLabels?.[entity]?.plural   ?? DEFAULTS[entity].plural,
  };
}

/**
 * Returns all resolved entity labels for a customer (useful for bulk UI rendering).
 */
export function getAllEntityLabels(
  customer: Pick<Customer, 'entityLabels'> | null | undefined
): Required<EntityLabels> {
  return {
    location:    getEntityLabelConfig(customer, 'location'),
    subLocation: getEntityLabelConfig(customer, 'subLocation'),
    venue:       getEntityLabelConfig(customer, 'venue'),
    event:       getEntityLabelConfig(customer, 'event'),
  };
}
