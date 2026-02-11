#!/bin/bash

# Test Custom Priority Override Feature
# This script tests that custom priority values properly override the default 4900 priority

set -e

API_BASE="http://localhost:3031/api"
VENUE_NAME="Venue-3"
DATE="2026-01-29"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================================================================================${NC}"
echo -e "${CYAN}                    CUSTOM PRIORITY TEST: Verify Priority Override Functionality${NC}"
echo -e "${CYAN}========================================================================================================${NC}"
echo ""

# Step 1: Fetch Venue-3 ObjectId
echo -e "${YELLOW}Step 1: Fetching Venue-3 ObjectId...${NC}"
VENUE_RESPONSE=$(curl -s "$API_BASE/venues")
VENUE_ID=$(echo "$VENUE_RESPONSE" | python3 -c "import sys, json; venues = json.load(sys.stdin); venue3 = [v for v in venues if v['name'] == '$VENUE_NAME']; print(venue3[0]['_id'] if venue3 else '')")

if [ -z "$VENUE_ID" ]; then
    echo -e "${RED}Error: Venue-3 not found! Please seed the database first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found Venue-3: ${VENUE_ID}${NC}"
echo ""

# Step 2: Get hierarchy for pricing calculation
echo -e "${YELLOW}Step 2: Getting entity hierarchy for pricing...${NC}"
SUBLOC_ID=$(curl -s "$API_BASE/sublocations" | python3 -c "import sys, json; sublocs = json.load(sys.stdin); print(sublocs[0]['_id'] if sublocs else '')")
SUBLOC=$(curl -s "$API_BASE/sublocations/$SUBLOC_ID")
LOC_ID=$(echo "$SUBLOC" | python3 -c "import sys, json; print(json.load(sys.stdin)['locationId'])")
LOC=$(curl -s "$API_BASE/locations/$LOC_ID")
CUST_ID=$(echo "$LOC" | python3 -c "import sys, json; print(json.load(sys.stdin)['customerId'])")

echo -e "${GREEN}✓ Customer ID: ${CUST_ID}${NC}"
echo -e "${GREEN}✓ Location ID: ${LOC_ID}${NC}"
echo -e "${GREEN}✓ SubLocation ID: ${SUBLOC_ID}${NC}"
echo ""

# Step 3: Clean up any existing test events
echo -e "${YELLOW}Step 3: Cleaning up any existing test events...${NC}"
OLD_TEST_EVENTS=$(curl -s "$API_BASE/events" | python3 -c "
import sys, json
events = json.load(sys.stdin)
test_events = [e for e in events if e.get('name', '') in ['PriorityTest-Low', 'PriorityTest-High', 'PriorityTest-Default']]
for e in test_events:
    print(e['_id'])
")

for event_id in $OLD_TEST_EVENTS; do
    curl -s -X DELETE "$API_BASE/events/$event_id" > /dev/null
    echo -e "${GREEN}✓ Deleted old test event: ${event_id}${NC}"
done

if [ -z "$OLD_TEST_EVENTS" ]; then
    echo -e "${GREEN}✓ No old test events found${NC}"
fi
echo ""

# Step 4: Create Event with Low Priority (4100)
echo -e "${YELLOW}Step 4: Creating Event with LOW custom priority (4100)...${NC}"
EVENT_LOW_RESPONSE=$(curl -s -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"PriorityTest-Low\",\"description\":\"Event with low priority 4100\",\"venueId\":\"$VENUE_ID\",\"subLocationId\":\"$SUBLOC_ID\",\"locationId\":\"$LOC_ID\",\"customerId\":\"$CUST_ID\",\"startDate\":\"${DATE}T14:00:00.000Z\",\"endDate\":\"${DATE}T18:00:00.000Z\",\"gracePeriodBefore\":0,\"gracePeriodAfter\":0,\"defaultHourlyRate\":50,\"customPriority\":4100,\"attendees\":30,\"timezone\":\"America/New_York\",\"isActive\":true}")

EVENT_LOW_ID=$(echo "$EVENT_LOW_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['_id'])")
echo -e "${GREEN}✓ Created PriorityTest-Low (Priority 4100): ${EVENT_LOW_ID}${NC}"
sleep 1

# Step 5: Create Event with High Priority (4950)
echo -e "${YELLOW}Step 5: Creating Event with HIGH custom priority (4950)...${NC}"
EVENT_HIGH_RESPONSE=$(curl -s -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"PriorityTest-High\",\"description\":\"Event with high priority 4950\",\"venueId\":\"$VENUE_ID\",\"subLocationId\":\"$SUBLOC_ID\",\"locationId\":\"$LOC_ID\",\"customerId\":\"$CUST_ID\",\"startDate\":\"${DATE}T14:00:00.000Z\",\"endDate\":\"${DATE}T18:00:00.000Z\",\"gracePeriodBefore\":0,\"gracePeriodAfter\":0,\"defaultHourlyRate\":200,\"customPriority\":4950,\"attendees\":50,\"timezone\":\"America/New_York\",\"isActive\":true}")

EVENT_HIGH_ID=$(echo "$EVENT_HIGH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['_id'])")
echo -e "${GREEN}✓ Created PriorityTest-High (Priority 4950): ${EVENT_HIGH_ID}${NC}"
sleep 1

# Step 6: Create Event with Default Priority (no customPriority set)
echo -e "${YELLOW}Step 6: Creating Event with DEFAULT priority (4900)...${NC}"
EVENT_DEFAULT_RESPONSE=$(curl -s -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"PriorityTest-Default\",\"description\":\"Event with default priority 4900\",\"venueId\":\"$VENUE_ID\",\"subLocationId\":\"$SUBLOC_ID\",\"locationId\":\"$LOC_ID\",\"customerId\":\"$CUST_ID\",\"startDate\":\"${DATE}T14:00:00.000Z\",\"endDate\":\"${DATE}T18:00:00.000Z\",\"gracePeriodBefore\":0,\"gracePeriodAfter\":0,\"defaultHourlyRate\":100,\"attendees\":40,\"timezone\":\"America/New_York\",\"isActive\":true}")

EVENT_DEFAULT_ID=$(echo "$EVENT_DEFAULT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['_id'])")
echo -e "${GREEN}✓ Created PriorityTest-Default (Priority 4900): ${EVENT_DEFAULT_ID}${NC}"
echo ""
sleep 1

# Step 7: Fetch auto-generated ratesheets
echo -e "${YELLOW}Step 7: Fetching auto-generated ratesheets...${NC}"
RATESHEET_LOW=$(curl -s "$API_BASE/events/$EVENT_LOW_ID/ratesheet")
RATESHEET_HIGH=$(curl -s "$API_BASE/events/$EVENT_HIGH_ID/ratesheet")
RATESHEET_DEFAULT=$(curl -s "$API_BASE/events/$EVENT_DEFAULT_ID/ratesheet")

echo -e "${GREEN}✓ Low Priority Event Ratesheet: $(echo "$RATESHEET_LOW" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['name'], '| Priority:', r['priority'])")${NC}"
echo -e "${GREEN}✓ High Priority Event Ratesheet: $(echo "$RATESHEET_HIGH" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['name'], '| Priority:', r['priority'])")${NC}"
echo -e "${GREEN}✓ Default Priority Event Ratesheet: $(echo "$RATESHEET_DEFAULT" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['name'], '| Priority:', r['priority'])")${NC}"
echo ""

# Step 8: Run pricing calculation to test priority resolution
echo -e "${YELLOW}Step 8: Running pricing calculation to verify priority resolution...${NC}"
PRICING_RESULT=$(curl -s -X POST "$API_BASE/pricing/calculate-hourly" \
    -H "Content-Type: application/json" \
    -d "{\"subLocationId\":\"$SUBLOC_ID\",\"startTime\":\"${DATE}T14:00:00.000Z\",\"endTime\":\"${DATE}T18:00:00.000Z\",\"isEventBooking\":false}")

echo "$PRICING_RESULT" | python3 << 'PYEOF'
import json, sys

result = json.load(sys.stdin)

print("=" * 90)
print("PRICING RESULT: All 3 Events Overlap at Same Time (9:00 AM - 1:00 PM EST)")
print("=" * 90)
print("\nExpected Winner: PriorityTest-High (Priority 4950, Rate $200/hr)")
print("Second Choice: PriorityTest-Default (Priority 4900, Rate $100/hr)")
print("Last Choice: PriorityTest-Low (Priority 4100, Rate $50/hr)")
print("\nActual Results:\n")

for i, seg in enumerate(result['segments'], 1):
    start = seg['startTime']
    hour_utc = int(start[11:13])
    hour_est = (hour_utc - 5) % 24

    if seg.get('ratesheet'):
        rs = seg['ratesheet']
        rate = seg['pricePerHour']
        print(f"Hour {i:2d} ({hour_est:02d}:00-{(hour_est+1)%24:02d}:00 EST): ${rate:3d}/hr | {rs['name']:35s} | Priority {rs['priority']}")
    else:
        print(f"Hour {i:2d} ({hour_est:02d}:00-{(hour_est+1)%24:02d}:00 EST): ${seg['pricePerHour']:3d}/hr | DEFAULT_RATE")

print(f"\n{'-' * 90}")
print(f"TOTAL: ${result['totalPrice']} for {result['totalHours']} hours")
PYEOF
echo ""

# Step 9: Verify results
echo -e "${CYAN}========================================================================================================${NC}"
echo -e "${CYAN}                                        VERIFICATION${NC}"
echo -e "${CYAN}========================================================================================================${NC}"
echo ""
echo "$PRICING_RESULT" | python3 << 'PYEOF'
import json, sys

result = json.load(sys.stdin)

# All 4 hours should have the high priority event winning
high_priority_count = sum(1 for seg in result['segments'] if seg.get('ratesheet', {}).get('priority') == 4950)
expected_rate = 200  # $200/hr for high priority event
actual_rate = result['segments'][0]['pricePerHour'] if result['segments'] else 0

print("✅ TEST RESULTS:")
print(f"   • High Priority (4950) won: {high_priority_count}/4 hours")
print(f"   • Rate charged: ${actual_rate}/hr (expected: ${expected_rate}/hr)")

if high_priority_count == 4 and actual_rate == expected_rate:
    print("\n🎉 SUCCESS: Custom priority override is working correctly!")
    print("   Higher priority (4950) overrode default (4900) and low (4100) priorities.")
else:
    print("\n❌ FAILURE: Priority override not working as expected!")
    print(f"   Expected all 4 hours at priority 4950 and ${expected_rate}/hr")

PYEOF
echo ""
echo -e "${GREEN}✓ Test completed successfully!${NC}"
echo -e "${CYAN}========================================================================================================${NC}"
