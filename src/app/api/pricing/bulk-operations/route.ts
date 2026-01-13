import { NextResponse } from 'next/server';
import { SubLocationRepository } from '@/models/SubLocation';
import { LocationRepository } from '@/models/Location';
import { CustomerRepository } from '@/models/Customer';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

interface BulkOperationProgress {
  total: number;
  completed: number;
  entityType: string;
  entityName: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operation, entityType, entityId, rate } = body;

    console.log('🚀 Bulk operation started:', { operation, entityType, entityId, rate });

    if (!operation || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const results: any[] = [];
    let totalAffected = 0;

    // Helper function to record rate history
    const recordHistory = async (
      type: 'customer' | 'location' | 'sublocation',
      id: ObjectId,
      name: string,
      oldRate: number | undefined,
      newRate: number,
      reason: string
    ) => {
      try {
        await db.collection('rate_history').insertOne({
          entityType: type,
          entityId: id,
          entityName: name,
          oldRate: oldRate || null,
          newRate: newRate,
          changedBy: 'system', // TODO: Get from session
          changedAt: new Date(),
          reason: reason
        });
        console.log(`✅ History recorded: ${type} ${name}: ${oldRate} → ${newRate}`);
      } catch (error) {
        console.error(`⚠️ Failed to record history for ${name}:`, error);
      }
    };

    // Execute bulk operation
    switch (operation) {
      case 'apply': {
        // Validate rate
        if (!rate || rate <= 0) {
          return NextResponse.json(
            { error: 'Valid rate is required for apply operation' },
            { status: 400 }
          );
        }

        const newRate = parseFloat(rate);

        if (entityType === 'customer') {
          // Step 1: Update customer itself
          const customer = await CustomerRepository.findById(new ObjectId(entityId));
          if (customer) {
            const oldRate = customer.defaultHourlyRate;
            await CustomerRepository.update(new ObjectId(entityId), {
              defaultHourlyRate: newRate
            });
            
            await recordHistory('customer', new ObjectId(entityId), customer.name, oldRate, newRate, 'Bulk apply rate to all');
            results.push({ type: 'customer', name: customer.name, oldRate, newRate });
            totalAffected++;
          }

          // Step 2: Get all locations under customer
          const locations = await LocationRepository.findByCustomerId(new ObjectId(entityId));
          
          // Step 3: Update each location
          for (const location of locations) {
            const oldRate = location.defaultHourlyRate;
            await LocationRepository.update(location._id!, {
              defaultHourlyRate: newRate
            });
            
            await recordHistory('location', location._id!, location.name, oldRate, newRate, `Bulk apply from customer: ${customer?.name}`);
            results.push({ type: 'location', name: location.name, oldRate, newRate });
            totalAffected++;

            // Step 4: Update sublocations under this location
            const sublocations = await SubLocationRepository.findByLocationId(location._id!);
            for (const sublocation of sublocations) {
              const oldRate = sublocation.defaultHourlyRate;
              await SubLocationRepository.update(sublocation._id!, {
                defaultHourlyRate: newRate
              });
              
              await recordHistory('sublocation', sublocation._id!, sublocation.label, oldRate, newRate, `Bulk apply from customer: ${customer?.name} → location: ${location.name}`);
              results.push({ type: 'sublocation', name: sublocation.label, oldRate, newRate });
              totalAffected++;
            }
          }

        } else if (entityType === 'location') {
          // Step 1: Update location itself
          const location = await LocationRepository.findById(new ObjectId(entityId));
          if (location) {
            const oldRate = location.defaultHourlyRate;
            await LocationRepository.update(new ObjectId(entityId), {
              defaultHourlyRate: newRate
            });
            
            await recordHistory('location', new ObjectId(entityId), location.name, oldRate, newRate, 'Bulk apply rate to sublocations');
            results.push({ type: 'location', name: location.name, oldRate, newRate });
            totalAffected++;

            // Step 2: Update all sublocations
            const sublocations = await SubLocationRepository.findByLocationId(new ObjectId(entityId));
            for (const sublocation of sublocations) {
              const oldRate = sublocation.defaultHourlyRate;
              await SubLocationRepository.update(sublocation._id!, {
                defaultHourlyRate: newRate
              });
              
              await recordHistory('sublocation', sublocation._id!, sublocation.label, oldRate, newRate, `Bulk apply from location: ${location.name}`);
              results.push({ type: 'sublocation', name: sublocation.label, oldRate, newRate });
              totalAffected++;
            }
          }
        }

        break;
      }

      case 'reset': {
        if (entityType === 'customer') {
          // Step 1: Get customer (don't change customer rate)
          const customer = await CustomerRepository.findById(new ObjectId(entityId));
          
          // Step 2: Get all locations and reset them
          const locations = await LocationRepository.findByCustomerId(new ObjectId(entityId));
          
          for (const location of locations) {
            const oldRate = location.defaultHourlyRate;
            if (oldRate) {
              await LocationRepository.update(location._id!, {
                defaultHourlyRate: undefined
              });
              
              await recordHistory('location', location._id!, location.name, oldRate, 0, `Reset to inherit from customer: ${customer?.name}`);
              results.push({ type: 'location', name: location.name, oldRate, newRate: 'inherit' });
              totalAffected++;
            }

            // Reset all sublocations under this location
            const sublocations = await SubLocationRepository.findByLocationId(location._id!);
            for (const sublocation of sublocations) {
              const oldRate = sublocation.defaultHourlyRate;
              if (oldRate) {
                await SubLocationRepository.update(sublocation._id!, {
                  defaultHourlyRate: undefined
                });
                
                await recordHistory('sublocation', sublocation._id!, sublocation.label, oldRate, 0, `Reset to inherit from location: ${location.name}`);
                results.push({ type: 'sublocation', name: sublocation.label, oldRate, newRate: 'inherit' });
                totalAffected++;
              }
            }
          }

        } else if (entityType === 'location') {
          // Get location (don't change location rate)
          const location = await LocationRepository.findById(new ObjectId(entityId));
          
          // Reset all sublocations
          const sublocations = await SubLocationRepository.findByLocationId(new ObjectId(entityId));
          for (const sublocation of sublocations) {
            const oldRate = sublocation.defaultHourlyRate;
            if (oldRate) {
              await SubLocationRepository.update(sublocation._id!, {
                defaultHourlyRate: undefined
              });
              
              await recordHistory('sublocation', sublocation._id!, sublocation.label, oldRate, 0, `Reset to inherit from location: ${location?.name}`);
              results.push({ type: 'sublocation', name: sublocation.label, oldRate, newRate: 'inherit' });
              totalAffected++;
            }
          }
        }

        break;
      }

      case 'enable': {
        // Enable pricing for all sublocations
        let affectedSublocations: any[] = [];

        if (entityType === 'customer') {
          const locations = await LocationRepository.findByCustomerId(new ObjectId(entityId));
          for (const location of locations) {
            const sublocations = await SubLocationRepository.findByLocationId(location._id!);
            affectedSublocations.push(...sublocations);
          }
        } else if (entityType === 'location') {
          affectedSublocations = await SubLocationRepository.findByLocationId(new ObjectId(entityId));
        }

        for (const sublocation of affectedSublocations) {
          if (!sublocation.pricingEnabled) {
            await SubLocationRepository.update(sublocation._id!, {
              pricingEnabled: true
            });
            results.push({ type: 'sublocation', name: sublocation.label, action: 'enabled' });
            totalAffected++;
          }
        }

        break;
      }

      case 'disable': {
        // Disable pricing for all sublocations
        let affectedSublocations: any[] = [];

        if (entityType === 'customer') {
          const locations = await LocationRepository.findByCustomerId(new ObjectId(entityId));
          for (const location of locations) {
            const sublocations = await SubLocationRepository.findByLocationId(location._id!);
            affectedSublocations.push(...sublocations);
          }
        } else if (entityType === 'location') {
          affectedSublocations = await SubLocationRepository.findByLocationId(new ObjectId(entityId));
        }

        for (const sublocation of affectedSublocations) {
          if (sublocation.pricingEnabled) {
            await SubLocationRepository.update(sublocation._id!, {
              pricingEnabled: false
            });
            results.push({ type: 'sublocation', name: sublocation.label, action: 'disabled' });
            totalAffected++;
          }
        }

        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }

    console.log(`✅ Bulk operation completed: ${totalAffected} entities affected`);

    return NextResponse.json({ 
      success: true, 
      affectedCount: totalAffected,
      results: results
    });
  } catch (error: any) {
    console.error('❌ Bulk operation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute bulk operation',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
