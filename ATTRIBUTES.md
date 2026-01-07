# Attributes System Guide

## Overview

The Attributes system allows you to add custom key-value pairs to any entity in the system. These attributes automatically inherit from parent entities and can be overridden at any level.

## Where to Manage Attributes

### 1. **Customer Attributes**
- **URL**: `/customers/[id]/manage`
- **Access**: Click "Manage Customer" button on any customer detail page
- **Inheritance**: These attributes are inherited by all locations and sub-locations belonging to this customer

**Example Use Cases:**
- `industry: "Technology"`
- `account_type: "Enterprise"`
- `region: "North America"`
- `contract_tier: "Premium"`

### 2. **Location Attributes**
- **URL**: `/locations/[id]`
- **Access**: Click on any location from the locations list or customer detail page
- **Inheritance**: 
  - Inherits from parent Customer
  - These attributes are inherited by all sub-locations of this location

**Example Use Cases:**
- `timezone: "EST"`
- `building_type: "Commercial"`
- `parking_rate: "$5/hour"`
- `operating_hours: "24/7"`

### 3. **Sub-Location Attributes**
- **URL**: `/sublocations/[id]/manage`
- **Access**: Click "View Details" on any sub-location card from the location page
- **Inheritance**: 
  - Inherits from parent Location (which inherits from Customer)
  - Can override any inherited attribute

**Example Use Cases:**
- `access_level: "Public"`
- `surface_type: "Paved"`
- `lighting: "LED"`
- `security: "24-hour monitoring"`

### 4. **Venue Attributes**
- **URL**: `/venues/[id]/manage`
- **Access**: Click "Manage" link on any venue card from the venues list
- **Inheritance**: None (venues don't have a strict hierarchy, but you can add attributes)

**Example Use Cases:**
- `audio_system: "Bose"`
- `seating_style: "Theater"`
- `catering: "Available"`
- `wheelchair_accessible: "Yes"`

## How Inheritance Works

### Inheritance Chain
```
Customer → Location → Sub-Location
```

### Example Scenario

**Customer: Acme Corporation**
```json
{
  "industry": "Technology",
  "region": "North"
}
```

**Location: NYC Headquarters (inherits from Customer)**
```json
{
  "industry": "Technology",     // inherited
  "region": "North",            // inherited
  "timezone": "EST",            // added at location level
  "building_code": "NYC-001"    // added at location level
}
```

**Sub-Location: LOT A (inherits from Location and Customer)**
```json
{
  "industry": "Technology",     // inherited from customer
  "region": "South",            // OVERRIDDEN at sublocation level
  "timezone": "EST",            // inherited from location
  "building_code": "NYC-001",   // inherited from location
  "access_level": "VIP"         // added at sublocation level
}
```

## Visual Indicators

### In the Attributes Manager UI:

1. **Blue Background (Inherited)**
   - Read-only attributes from parent entities
   - Cannot be edited or deleted
   - Show where the value comes from

2. **Yellow Background (Override)**
   - When you add an attribute with the same key as an inherited one
   - Your local value takes precedence
   - Label shows "Override:" prefix

3. **White Background (Own Attributes)**
   - Attributes defined directly on this entity
   - Fully editable
   - Can be deleted

## Managing Attributes

### Adding New Attributes

1. Navigate to the entity's management page
2. Scroll to the "Attributes" section
3. In the "Add New Attribute" box:
   - Enter a key (e.g., `parking_type`)
   - Enter a value (e.g., `Covered`)
   - Click "Add" or press Enter
4. Click "Save Attributes" to persist changes

### Editing Attributes

1. Find the attribute in the "Own Attributes" section
2. Click in the key or value field
3. Make your changes
4. Click "Save Attributes"

### Overriding Inherited Attributes

1. Look at the "Inherited from Parent" section
2. Note the key you want to override (e.g., `region`)
3. Add a new attribute with the same key but different value
4. The new attribute will show with a yellow "Override" indicator
5. Click "Save Attributes"

### Deleting Attributes

1. Find the attribute in "Own Attributes"
2. Click the "X" button on the right
3. Click "Save Attributes"

**Note**: You cannot delete inherited attributes, only override them.

## Common Attribute Keys by Entity Type

### Customer Attributes
- `industry`
- `account_type`
- `region`
- `sales_rep`
- `contract_start_date`
- `billing_cycle`
- `support_tier`

### Location Attributes
- `timezone`
- `building_type`
- `square_footage`
- `year_built`
- `manager_name`
- `emergency_contact`
- `operating_hours`
- `parking_rate`

### Sub-Location Attributes
- `access_level` (Public, Private, VIP)
- `surface_type` (Paved, Gravel, Grass)
- `lighting` (LED, Halogen, None)
- `security` (24-hour, Business hours, None)
- `ev_charging` (Yes, No)
- `covered` (Yes, No)

### Venue Attributes
- `audio_system`
- `video_system`
- `seating_capacity`
- `stage_size`
- `catering_available`
- `wifi_speed`
- `wheelchair_accessible`
- `green_room`

## API Access

Attributes are stored in the `attributes` array field on each entity:

```javascript
// Get entity with attributes
const customer = await fetch('/api/customers/123');
// customer.attributes = [{ key: 'industry', value: 'Tech' }]

// Get inherited attributes
const inherited = await fetch('/api/attributes/inherited?entityType=location&entityId=456');
// Returns merged attributes from all parents
```

## Best Practices

### 1. Use Consistent Keys
- Use lowercase with underscores: `parking_type` not `ParkingType`
- Be consistent across entities
- Create a company-wide attribute dictionary

### 2. Set Common Attributes at Customer Level
- Industry, region, account type should be at customer level
- Specific location details at location level
- Physical characteristics at sub-location level

### 3. Override Sparingly
- Only override when truly needed
- Document why an override exists
- Consider if a new attribute key would be clearer

### 4. Attribute Naming Convention
```
{entity}_attribute_name
```
Examples:
- `customer_billing_cycle`
- `location_operating_hours`
- `sublocation_access_level`

### 5. Use Attributes for Variable Data
- Good: `timezone`, `parking_rate`, `access_level`
- Bad: `name`, `address` (use proper fields)

## Querying Attributes

While attributes are flexible, they're best for:
- Custom metadata
- Client-specific fields
- Temporary/experimental data
- Integration metadata

For frequently-queried data, consider adding proper database fields.

## Troubleshooting

### "Attributes not saving"
- Check browser console for errors
- Ensure you clicked "Save Attributes"
- Verify you have edit permissions

### "Can't see inherited attributes"
- Navigate to the parent entity
- Check if parent has attributes defined
- Refresh the page

### "Override not working"
- Ensure the key matches exactly (case-sensitive)
- Check spelling
- Save after adding

### "Inherited attributes showing wrong values"
- Check parent entities' attributes
- Verify inheritance chain: Customer → Location → SubLocation
- Clear browser cache and refresh

## Future Enhancements

- [ ] Attribute templates by entity type
- [ ] Attribute validation rules
- [ ] Required vs optional attributes
- [ ] Attribute data types (string, number, boolean, date)
- [ ] Attribute search and filtering
- [ ] Bulk attribute management
- [ ] Attribute history/audit log

---

**Quick Access URLs:**
- Customer Attributes: `/customers/[id]/manage`
- Location Attributes: `/locations/[id]` (scroll down)
- SubLocation Attributes: `/sublocations/[id]/manage`
- Venue Attributes: `/venues/[id]/manage`
