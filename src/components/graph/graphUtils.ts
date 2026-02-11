import { Attribute, AttributeBreakdown, AllData, EventAssociatedTo } from './graphTypes';

/**
 * Utility functions for graph visualization
 */

/**
 * Auto-detect event association type based on which ID fields are present
 * Priority: venue > sublocation > location > customer
 */
export function autoDetectEventAssociation(event: any): EventAssociatedTo | null {
  if (event.eventAssociatedTo) {
    return event.eventAssociatedTo;
  }

  if (event.venueId) return 'VENUE';
  if (event.subLocationId) return 'SUBLOCATION';
  if (event.locationId) return 'LOCATION';
  if (event.customerId) return 'CUSTOMER';

  return null;
}

/**
 * Get entity data from a node ID
 */
export function getEntityData(nodeId: string, allData: AllData): any {
  const [entityType, entityId] = nodeId.split('-');

  if (entityType === 'customer') {
    return allData.customers.find((c: any) => c._id === entityId);
  } else if (entityType === 'location') {
    return allData.locations.find((l: any) => l._id === entityId);
  } else if (entityType === 'sublocation') {
    return allData.sublocations.find((sl: any) => sl._id === entityId);
  } else if (entityType === 'venue') {
    return allData.venues.find((v: any) => v._id === entityId);
  } else if (entityType === 'event') {
    return allData.events.find((e: any) => e._id === entityId);
  }
  return null;
}

/**
 * Calculate attribute breakdown showing inherited, own, and overridden attributes
 */
export function getAttributeBreakdown(entity: any, entityType: string, allData: AllData): AttributeBreakdown {
  const inherited: Attribute[] = [];
  const own: Attribute[] = [];
  const overridden: Attribute[] = [];

  if (!entity || entityType === 'customer') {
    return { inherited: [], own: entity?.attributes || [], overridden: [] };
  }

  const attributeMap = new Map<string, { value: string; source: string }>();

  if (entityType === 'location') {
    const customer = allData.customers.find((c: any) => c._id === entity.customerId);
    if (customer?.attributes) {
      customer.attributes.forEach((attr: Attribute) => {
        attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
      });
    }
  } else if (entityType === 'sublocation') {
    const location = allData.locations.find((l: any) => l._id === entity.locationId);
    if (location) {
      const customer = allData.customers.find((c: any) => c._id === location.customerId);
      if (customer?.attributes) {
        customer.attributes.forEach((attr: Attribute) => {
          attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
        });
      }
      if (location.attributes) {
        location.attributes.forEach((attr: Attribute) => {
          attributeMap.set(attr.key, { value: attr.value, source: 'Location' });
        });
      }
    }
  } else if (entityType === 'venue') {
    // Venues inherit from sublocation → location → customer
    const relations = allData.slvRelations.filter((r: any) => r.venueId === entity._id);
    if (relations.length > 0) {
      const sublocation = allData.sublocations.find((sl: any) => sl._id === relations[0].subLocationId);
      if (sublocation) {
        const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
        if (location) {
          const customer = allData.customers.find((c: any) => c._id === location.customerId);
          if (customer?.attributes) {
            customer.attributes.forEach((attr: Attribute) => {
              attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
            });
          }
          if (location.attributes) {
            location.attributes.forEach((attr: Attribute) => {
              attributeMap.set(attr.key, { value: attr.value, source: 'Location' });
            });
          }
        }
        if (sublocation.attributes) {
          sublocation.attributes.forEach((attr: Attribute) => {
            attributeMap.set(attr.key, { value: attr.value, source: 'SubLocation' });
          });
        }
      }
    }
  } else if (entityType === 'event') {
    // Events inherit from their associated entity
    const eventAssociatedTo = autoDetectEventAssociation(entity);

    if (eventAssociatedTo === 'VENUE' && entity.venueId) {
      const venue = allData.venues.find((v: any) => v._id.toString() === entity.venueId.toString());
      if (venue?.attributes) {
        venue.attributes.forEach((attr: Attribute) => {
          attributeMap.set(attr.key, { value: attr.value, source: 'Venue' });
        });
      }
      // Also get sublocation attributes through venue relations
      const relations = allData.slvRelations.filter((r: any) => r.venueId === entity.venueId);
      if (relations.length > 0) {
        const sublocation = allData.sublocations.find((sl: any) => sl._id === relations[0].subLocationId);
        if (sublocation) {
          if (sublocation.attributes) {
            sublocation.attributes.forEach((attr: Attribute) => {
              if (!attributeMap.has(attr.key)) {
                attributeMap.set(attr.key, { value: attr.value, source: 'SubLocation' });
              }
            });
          }
          const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
          if (location) {
            if (location.attributes) {
              location.attributes.forEach((attr: Attribute) => {
                if (!attributeMap.has(attr.key)) {
                  attributeMap.set(attr.key, { value: attr.value, source: 'Location' });
                }
              });
            }
            const customer = allData.customers.find((c: any) => c._id === location.customerId);
            if (customer?.attributes) {
              customer.attributes.forEach((attr: Attribute) => {
                if (!attributeMap.has(attr.key)) {
                  attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
                }
              });
            }
          }
        }
      }
    } else if (eventAssociatedTo === 'SUBLOCATION' && entity.subLocationId) {
      const sublocation = allData.sublocations.find((sl: any) => sl._id.toString() === entity.subLocationId.toString());
      if (sublocation) {
        if (sublocation.attributes) {
          sublocation.attributes.forEach((attr: Attribute) => {
            attributeMap.set(attr.key, { value: attr.value, source: 'SubLocation' });
          });
        }
        const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
        if (location) {
          if (location.attributes) {
            location.attributes.forEach((attr: Attribute) => {
              if (!attributeMap.has(attr.key)) {
                attributeMap.set(attr.key, { value: attr.value, source: 'Location' });
              }
            });
          }
          const customer = allData.customers.find((c: any) => c._id === location.customerId);
          if (customer?.attributes) {
            customer.attributes.forEach((attr: Attribute) => {
              if (!attributeMap.has(attr.key)) {
                attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
              }
            });
          }
        }
      }
    } else if (eventAssociatedTo === 'LOCATION' && entity.locationId) {
      const location = allData.locations.find((l: any) => l._id.toString() === entity.locationId.toString());
      if (location) {
        if (location.attributes) {
          location.attributes.forEach((attr: Attribute) => {
            attributeMap.set(attr.key, { value: attr.value, source: 'Location' });
          });
        }
        const customer = allData.customers.find((c: any) => c._id === location.customerId);
        if (customer?.attributes) {
          customer.attributes.forEach((attr: Attribute) => {
            if (!attributeMap.has(attr.key)) {
              attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
            }
          });
        }
      }
    } else if (eventAssociatedTo === 'CUSTOMER' && entity.customerId) {
      const customer = allData.customers.find((c: any) => c._id.toString() === entity.customerId.toString());
      if (customer?.attributes) {
        customer.attributes.forEach((attr: Attribute) => {
          attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
        });
      }
    }
  }

  const ownAttrs = entity.attributes || [];
  const ownKeys = new Set(ownAttrs.map((a: Attribute) => a.key));

  ownAttrs.forEach((attr: Attribute) => {
    if (attributeMap.has(attr.key) && attributeMap.get(attr.key)!.value !== attr.value) {
      overridden.push({ ...attr, source: attributeMap.get(attr.key)!.source } as any);
    } else {
      own.push(attr);
    }
  });

  attributeMap.forEach((data, key) => {
    if (!ownKeys.has(key)) {
      inherited.push({ key, value: data.value, source: data.source } as any);
    }
  });

  return { inherited, own, overridden };
}

/**
 * Find all paths from a node to the root customer node
 */
export function findAllPathsToRoot(nodeId: string, allData: AllData): string[][] {
  const paths: string[][] = [];
  const [entityType, entityId] = nodeId.split('-');

  if (entityType === 'customer') {
    return [[nodeId]];
  }

  if (entityType === 'location') {
    const location = allData.locations.find((l: any) => l._id === entityId);
    if (location) {
      const customerNodeId = `customer-${location.customerId}`;
      return [[nodeId, customerNodeId]];
    }
  }

  if (entityType === 'sublocation') {
    const sublocation = allData.sublocations.find((sl: any) => sl._id === entityId);
    if (sublocation) {
      const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
      if (location) {
        const locationNodeId = `location-${sublocation.locationId}`;
        const customerNodeId = `customer-${location.customerId}`;
        return [[nodeId, locationNodeId, customerNodeId]];
      }
    }
  }

  if (entityType === 'venue') {
    const relations = allData.slvRelations.filter((r: any) => r.venueId === entityId);
    relations.forEach((rel: any) => {
      const sublocation = allData.sublocations.find((sl: any) => sl._id === rel.subLocationId);
      if (sublocation) {
        const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
        if (location) {
          const sublocationNodeId = `sublocation-${rel.subLocationId}`;
          const locationNodeId = `location-${sublocation.locationId}`;
          const customerNodeId = `customer-${location.customerId}`;
          paths.push([nodeId, sublocationNodeId, locationNodeId, customerNodeId]);
        }
      }
    });
  }

  if (entityType === 'event') {
    const event = allData.events.find((e: any) => e._id === entityId);
    if (event) {
      const eventAssociatedTo = autoDetectEventAssociation(event);

      // Events can be associated with Customer, Location, SubLocation, or Venue
      if (eventAssociatedTo === 'CUSTOMER' && event.customerId) {
        const customerNodeId = `customer-${event.customerId}`;
        return [[nodeId, customerNodeId]];
      } else if (eventAssociatedTo === 'LOCATION' && event.locationId) {
        const location = allData.locations.find((l: any) => l._id.toString() === event.locationId.toString());
        if (location) {
          const locationNodeId = `location-${event.locationId}`;
          const customerNodeId = `customer-${location.customerId}`;
          return [[nodeId, locationNodeId, customerNodeId]];
        }
      } else if (eventAssociatedTo === 'SUBLOCATION' && event.subLocationId) {
        const sublocation = allData.sublocations.find((sl: any) => sl._id.toString() === event.subLocationId.toString());
        if (sublocation) {
          const location = allData.locations.find((l: any) => l._id.toString() === sublocation.locationId.toString());
          if (location) {
            const sublocationNodeId = `sublocation-${event.subLocationId}`;
            const locationNodeId = `location-${sublocation.locationId}`;
            const customerNodeId = `customer-${location.customerId}`;
            return [[nodeId, sublocationNodeId, locationNodeId, customerNodeId]];
          }
        }
      } else if (eventAssociatedTo === 'VENUE' && event.venueId) {
        const venueNodeId = `venue-${event.venueId}`;
        // Find all paths from venue to root (recursive call)
        const venuePaths = findAllPathsToRoot(venueNodeId, allData);
        venuePaths.forEach(venuePath => {
          paths.push([nodeId, ...venuePath]);
        });
      }
    }
  }

  return paths;
}
