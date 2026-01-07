import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  return driver;
}

export async function getNeo4jSession(): Promise<Session> {
  const driver = getNeo4jDriver();
  return driver.session();
}

export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Sync MongoDB data to Neo4j graph database
 */
export async function syncToNeo4j() {
  const session = await getNeo4jSession();

  try {
    // Clear existing data
    await session.run('MATCH (n) DETACH DELETE n');

    // Import from MongoDB
    const { CustomerRepository } = await import('@/models/Customer');
    const { LocationRepository } = await import('@/models/Location');
    const { SubLocationRepository } = await import('@/models/SubLocation');
    const { VenueRepository } = await import('@/models/Venue');
    const { SubLocationVenueRepository } = await import('@/models/SubLocationVenue');

    // Create Customer nodes
    const customers = await CustomerRepository.findAll();
    for (const customer of customers) {
      await session.run(
        `CREATE (c:Customer {
          id: $id,
          name: $name,
          email: $email,
          attributes: $attributes
        })`,
        {
          id: customer._id!.toString(),
          name: customer.name,
          email: customer.email,
          attributes: JSON.stringify(customer.attributes || []),
        }
      );
    }

    // Create Location nodes and relationships
    const locations = await LocationRepository.findAll();
    for (const location of locations) {
      await session.run(
        `CREATE (l:Location {
          id: $id,
          name: $name,
          city: $city,
          totalCapacity: $totalCapacity,
          attributes: $attributes
        })`,
        {
          id: location._id!.toString(),
          name: location.name,
          city: location.city,
          totalCapacity: location.totalCapacity || 0,
          attributes: JSON.stringify(location.attributes || []),
        }
      );

      // Create relationship to customer
      await session.run(
        `MATCH (c:Customer {id: $customerId})
         MATCH (l:Location {id: $locationId})
         CREATE (c)-[:HAS_LOCATION]->(l)`,
        {
          customerId: location.customerId.toString(),
          locationId: location._id!.toString(),
        }
      );
    }

    // Create SubLocation nodes and relationships
    const sublocations = await SubLocationRepository.findAll();
    for (const sublocation of sublocations) {
      await session.run(
        `CREATE (sl:SubLocation {
          id: $id,
          label: $label,
          allocatedCapacity: $allocatedCapacity,
          attributes: $attributes
        })`,
        {
          id: sublocation._id!.toString(),
          label: sublocation.label,
          allocatedCapacity: sublocation.allocatedCapacity || 0,
          attributes: JSON.stringify(sublocation.attributes || []),
        }
      );

      // Create relationship to location
      await session.run(
        `MATCH (l:Location {id: $locationId})
         MATCH (sl:SubLocation {id: $subLocationId})
         CREATE (l)-[:HAS_SUBLOCATION]->(sl)`,
        {
          locationId: sublocation.locationId.toString(),
          subLocationId: sublocation._id!.toString(),
        }
      );
    }

    // Create Venue nodes
    const venues = await VenueRepository.findAll();
    for (const venue of venues) {
      await session.run(
        `CREATE (v:Venue {
          id: $id,
          name: $name,
          venueType: $venueType,
          capacity: $capacity,
          attributes: $attributes
        })`,
        {
          id: venue._id!.toString(),
          name: venue.name,
          venueType: venue.venueType,
          capacity: venue.capacity || 0,
          attributes: JSON.stringify(venue.attributes || []),
        }
      );
    }

    // Create SubLocation-Venue relationships
    const slVenues = await SubLocationVenueRepository.findAll();
    for (const slv of slVenues) {
      await session.run(
        `MATCH (sl:SubLocation {id: $subLocationId})
         MATCH (v:Venue {id: $venueId})
         CREATE (sl)-[:HAS_VENUE]->(v)`,
        {
          subLocationId: slv.subLocationId.toString(),
          venueId: slv.venueId.toString(),
        }
      );
    }

    console.log('✓ Successfully synced data to Neo4j');
  } catch (error) {
    console.error('Error syncing to Neo4j:', error);
    throw error;
  } finally {
    await session.close();
  }
}
