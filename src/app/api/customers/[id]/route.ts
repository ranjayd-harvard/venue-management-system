import { NextResponse } from 'next/server';
import { CustomerRepository } from '@/models/Customer';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await CustomerRepository.findById(new ObjectId(params.id));
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { defaultHourlyRate, name, email, phone, address } = body;

    // Get current customer data for history tracking
    const currentCustomer = await CustomerRepository.findById(new ObjectId(params.id));
    if (!currentCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const updates: any = {};
    
    // Track if rate is changing
    let rateChanged = false;
    let oldRate = currentCustomer.defaultHourlyRate;
    
    // PATCH: Only update fields that are provided
    if (defaultHourlyRate !== undefined) {
      updates.defaultHourlyRate = parseFloat(defaultHourlyRate);
      rateChanged = oldRate !== updates.defaultHourlyRate;
    }
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    const success = await CustomerRepository.update(new ObjectId(params.id), updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Customer not found or no changes made' },
        { status: 404 }
      );
    }

    // Record rate history if rate changed
    if (rateChanged) {
      try {
        const db = await getDb();
        await db.collection('rate_history').insertOne({
          entityType: 'customer',
          entityId: new ObjectId(params.id),
          entityName: currentCustomer.name,
          oldRate: oldRate || null,
          newRate: parseFloat(defaultHourlyRate),
          changedBy: 'system', // TODO: Replace with actual user from session
          changedAt: new Date(),
          reason: body.reason || null
        });
        console.log('✅ Rate history recorded for customer:', currentCustomer.name);
      } catch (historyError) {
        console.error('⚠️ Failed to record rate history:', historyError);
        // Don't fail the request if history fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Get current customer data for history tracking
    const currentCustomer = await CustomerRepository.findById(new ObjectId(params.id));
    if (!currentCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Track if rate is changing
    let rateChanged = false;
    let oldRate = currentCustomer.defaultHourlyRate;
    
    if (body.defaultHourlyRate !== undefined) {
      rateChanged = oldRate !== parseFloat(body.defaultHourlyRate);
    }

    // PUT: Replace entire resource (but keep _id and createdAt)
    const success = await CustomerRepository.update(new ObjectId(params.id), body);

    if (!success) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Record rate history if rate changed
    if (rateChanged && body.defaultHourlyRate !== undefined) {
      try {
        const db = await getDb();
        await db.collection('rate_history').insertOne({
          entityType: 'customer',
          entityId: new ObjectId(params.id),
          entityName: body.name || currentCustomer.name,
          oldRate: oldRate || null,
          newRate: parseFloat(body.defaultHourlyRate),
          changedBy: 'system', // TODO: Replace with actual user from session
          changedAt: new Date(),
          reason: body.reason || null
        });
        console.log('✅ Rate history recorded for customer (PUT):', body.name || currentCustomer.name);
      } catch (historyError) {
        console.error('⚠️ Failed to record rate history:', historyError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const success = await CustomerRepository.delete(new ObjectId(params.id));

    if (!success) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
