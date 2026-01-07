import { Attribute } from '@/models/types';

/**
 * Merges parent attributes with child attributes
 * Child attributes override parent attributes with the same key
 */
export function mergeAttributes(
  parentAttributes: Attribute[] = [],
  childAttributes: Attribute[] = []
): Attribute[] {
  const merged = new Map<string, string>();

  // First, add all parent attributes
  parentAttributes.forEach(attr => {
    merged.set(attr.key, attr.value);
  });

  // Then, override with child attributes
  childAttributes.forEach(attr => {
    merged.set(attr.key, attr.value);
  });

  // Convert back to array
  return Array.from(merged.entries()).map(([key, value]) => ({ key, value }));
}

/**
 * Gets inherited attributes for a child entity
 * This recursively builds the attribute chain from ancestors
 */
export async function getInheritedAttributes(
  entityType: 'location' | 'sublocation',
  entityId: string
): Promise<Attribute[]> {
  if (entityType === 'location') {
    const { LocationRepository } = await import('@/models/Location');
    const { CustomerRepository } = await import('@/models/Customer');
    
    const location = await LocationRepository.findById(entityId);
    if (!location) return [];
    
    const customer = await CustomerRepository.findById(location.customerId);
    if (!customer) return location.attributes || [];
    
    return mergeAttributes(customer.attributes, location.attributes);
  }
  
  if (entityType === 'sublocation') {
    const { SubLocationRepository } = await import('@/models/SubLocation');
    const { LocationRepository } = await import('@/models/Location');
    const { CustomerRepository } = await import('@/models/Customer');
    
    const sublocation = await SubLocationRepository.findById(entityId);
    if (!sublocation) return [];
    
    const location = await LocationRepository.findById(sublocation.locationId);
    if (!location) return sublocation.attributes || [];
    
    const customer = await CustomerRepository.findById(location.customerId);
    
    // Build the chain: Customer -> Location -> SubLocation
    let attributes = customer?.attributes || [];
    attributes = mergeAttributes(attributes, location.attributes);
    attributes = mergeAttributes(attributes, sublocation.attributes);
    
    return attributes;
  }
  
  return [];
}

/**
 * Validates that sublocation capacities don't exceed location capacity
 */
export async function validateSubLocationCapacity(
  locationId: string,
  subLocationId: string,
  newCapacity: number
): Promise<{ valid: boolean; message?: string; currentTotal?: number; locationCapacity?: number }> {
  const { LocationRepository } = await import('@/models/Location');
  const { SubLocationRepository } = await import('@/models/SubLocation');
  
  const location = await LocationRepository.findById(locationId);
  if (!location) {
    return { valid: false, message: 'Location not found' };
  }
  
  if (!location.totalCapacity) {
    return { valid: true }; // No capacity limit set
  }
  
  const sublocations = await SubLocationRepository.findByLocationId(locationId);
  
  // Calculate total capacity excluding the current sublocation being updated
  let totalAllocated = 0;
  for (const sl of sublocations) {
    if (sl._id!.toString() !== subLocationId) {
      totalAllocated += sl.allocatedCapacity || 0;
    }
  }
  
  totalAllocated += newCapacity;
  
  if (totalAllocated > location.totalCapacity) {
    return {
      valid: false,
      message: `Total allocated capacity (${totalAllocated}) exceeds location capacity (${location.totalCapacity})`,
      currentTotal: totalAllocated,
      locationCapacity: location.totalCapacity,
    };
  }
  
  return { valid: true };
}
