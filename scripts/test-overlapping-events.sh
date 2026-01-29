#!/bin/bash

# Test Overlapping Events with Different Rates
# This script creates 3 overlapping events and analyzes automatic ratesheet priority resolution

set -e

API_BASE="http://localhost:3031/api"
VENUE_NAME="Venue-3"
DATE="2026-01-28"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================================================================================${NC}"
echo -e "${CYAN}                    OVERLAPPING EVENTS TEST: Automatic Ratesheet Priority Resolution${NC}"
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

# Step 3: Deactivate any conflicting events
echo -e "${YELLOW}Step 3: Deactivating any existing conflicting events...${NC}"
EXISTING_EVENTS=$(curl -s "$API_BASE/events" | python3 -c "
import sys, json
events = json.load(sys.stdin)
matching = [e for e in events if
    (e.get('customerId') == '$CUST_ID' or e.get('locationId') == '$LOC_ID' or e.get('subLocationId') == '$SUBLOC_ID')
    and e.get('startDate', '').startswith('$DATE')
    and e.get('isActive') == True
    and not e.get('name', '').startswith('Event')]
for e in matching:
    print(e['_id'])
")

for event_id in $EXISTING_EVENTS; do
    curl -s -X PATCH "$API_BASE/events/$event_id" -H "Content-Type: application/json" -d '{"isActive":false}' > /dev/null
    echo -e "${GREEN}✓ Deactivated event: ${event_id}${NC}"
done

if [ -z "$EXISTING_EVENTS" ]; then
    echo -e "${GREEN}✓ No conflicting events found${NC}"
fi
echo ""

# Step 4: Delete any existing test events
echo -e "${YELLOW}Step 4: Cleaning up any existing test events...${NC}"
OLD_TEST_EVENTS=$(curl -s "$API_BASE/events" | python3 -c "
import sys, json
events = json.load(sys.stdin)
test_events = [e for e in events if e.get('name', '').startswith('Event') and e.get('name', '') in ['EventA-Morning', 'EventB-Midday', 'EventC-Afternoon']]
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

# Step 5: Create EventA (9am-11am EST, $100/hr)
echo -e "${YELLOW}Step 5: Creating EventA (9am-11am EST, \$100/hr)...${NC}"
EVENTA_RESPONSE=$(curl -s -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"EventA-Morning\",\"description\":\"Morning event to test overlapping ratesheets\",\"venueId\":\"$VENUE_ID\",\"subLocationId\":\"$SUBLOC_ID\",\"locationId\":\"$LOC_ID\",\"customerId\":\"$CUST_ID\",\"startDate\":\"${DATE}T14:00:00.000Z\",\"endDate\":\"${DATE}T16:00:00.000Z\",\"gracePeriodBefore\":60,\"gracePeriodAfter\":120,\"defaultHourlyRate\":100,\"attendees\":50,\"timezone\":\"America/New_York\",\"isActive\":true}")

EVENTA_ID=$(echo "$EVENTA_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['_id'])")
echo -e "${GREEN}✓ Created EventA: ${EVENTA_ID}${NC}"
sleep 1

# Step 6: Create EventB (10am-3pm EST, $150/hr)
echo -e "${YELLOW}Step 6: Creating EventB (10am-3pm EST, \$150/hr)...${NC}"
EVENTB_RESPONSE=$(curl -s -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"EventB-Midday\",\"description\":\"Midday event overlapping with EventA and EventC\",\"venueId\":\"$VENUE_ID\",\"subLocationId\":\"$SUBLOC_ID\",\"locationId\":\"$LOC_ID\",\"customerId\":\"$CUST_ID\",\"startDate\":\"${DATE}T15:00:00.000Z\",\"endDate\":\"${DATE}T20:00:00.000Z\",\"gracePeriodBefore\":60,\"gracePeriodAfter\":120,\"defaultHourlyRate\":150,\"attendees\":75,\"timezone\":\"America/New_York\",\"isActive\":true}")

EVENTB_ID=$(echo "$EVENTB_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['_id'])")
echo -e "${GREEN}✓ Created EventB: ${EVENTB_ID}${NC}"
sleep 1

# Step 7: Create EventC (2pm-6pm EST, $200/hr)
echo -e "${YELLOW}Step 7: Creating EventC (2pm-6pm EST, \$200/hr)...${NC}"
EVENTC_RESPONSE=$(curl -s -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"EventC-Afternoon\",\"description\":\"Afternoon event overlapping with EventB\",\"venueId\":\"$VENUE_ID\",\"subLocationId\":\"$SUBLOC_ID\",\"locationId\":\"$LOC_ID\",\"customerId\":\"$CUST_ID\",\"startDate\":\"${DATE}T19:00:00.000Z\",\"endDate\":\"${DATE}T23:00:00.000Z\",\"gracePeriodBefore\":60,\"gracePeriodAfter\":120,\"defaultHourlyRate\":200,\"attendees\":60,\"timezone\":\"America/New_York\",\"isActive\":true}")

EVENTC_ID=$(echo "$EVENTC_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['_id'])")
echo -e "${GREEN}✓ Created EventC: ${EVENTC_ID}${NC}"
echo ""
sleep 1

# Step 8: Fetch auto-generated ratesheets
echo -e "${YELLOW}Step 8: Fetching auto-generated ratesheets...${NC}"
RATESHEET_A=$(curl -s "$API_BASE/events/$EVENTA_ID/ratesheet")
RATESHEET_B=$(curl -s "$API_BASE/events/$EVENTB_ID/ratesheet")
RATESHEET_C=$(curl -s "$API_BASE/events/$EVENTC_ID/ratesheet")

echo -e "${GREEN}✓ EventA Ratesheet: $(echo "$RATESHEET_A" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['name'], '| Priority:', r['priority'])")${NC}"
echo -e "${GREEN}✓ EventB Ratesheet: $(echo "$RATESHEET_B" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['name'], '| Priority:', r['priority'])")${NC}"
echo -e "${GREEN}✓ EventC Ratesheet: $(echo "$RATESHEET_C" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r['name'], '| Priority:', r['priority'])")${NC}"
echo ""

# Step 9: Run walk-in pricing calculation
echo -e "${YELLOW}Step 9: Running WALK-IN pricing calculation (isEventBooking: false)...${NC}"
WALKIN_RESULT=$(curl -s -X POST "$API_BASE/pricing/calculate-hourly" \
    -H "Content-Type: application/json" \
    -d "{\"subLocationId\":\"$SUBLOC_ID\",\"startTime\":\"${DATE}T13:00:00.000Z\",\"endTime\":\"${DATE}T25:00:00.000Z\",\"isEventBooking\":false}")

echo "$WALKIN_RESULT" | python3 << 'PYEOF'
import json, sys

result = json.load(sys.stdin)

print("=" * 90)
print("WALK-IN PRICING: Overlapping Events A ($100), B ($150), C ($200)")
print("=" * 90)
print("\nHour-by-Hour Analysis:\n")

for i, seg in enumerate(result['segments'], 1):
    start = seg['startTime']
    hour_utc = int(start[11:13])
    hour_est = (hour_utc - 5) % 24

    if seg.get('ratesheet'):
        rs = seg['ratesheet']
        print(f"Hour {i:2d} ({hour_est:02d}:00-{(hour_est+1)%24:02d}:00 EST): ${seg['pricePerHour']:3d}/hr | {rs['name']:30s} | Priority {rs['priority']}")
    else:
        print(f"Hour {i:2d} ({hour_est:02d}:00-{(hour_est+1)%24:02d}:00 EST): ${seg['pricePerHour']:3d}/hr | DEFAULT_RATE")

print(f"\n{'-' * 90}")
print(f"TOTAL: ${result['totalPrice']} for {result['totalHours']} hours")
PYEOF
echo ""

# Step 10: Run event booking pricing calculation
echo -e "${YELLOW}Step 10: Running EVENT BOOKING pricing calculation (isEventBooking: true)...${NC}"
EVENT_RESULT=$(curl -s -X POST "$API_BASE/pricing/calculate-hourly" \
    -H "Content-Type: application/json" \
    -d "{\"subLocationId\":\"$SUBLOC_ID\",\"startTime\":\"${DATE}T13:00:00.000Z\",\"endTime\":\"${DATE}T25:00:00.000Z\",\"isEventBooking\":true}")

echo "$EVENT_RESULT" | python3 << 'PYEOF'
import json, sys

result = json.load(sys.stdin)

print("=" * 90)
print("EVENT BOOKING PRICING: Grace Periods INCLUDED (isEventBooking: true)")
print("=" * 90)
print("\nHour-by-Hour Analysis:\n")

for i, seg in enumerate(result['segments'], 1):
    start = seg['startTime']
    hour_utc = int(start[11:13])
    hour_est = (hour_utc - 5) % 24

    if seg.get('ratesheet'):
        rs = seg['ratesheet']
        grace_marker = " [GRACE $0]" if seg['pricePerHour'] == 0 and rs['level'] == 'EVENT' else ""
        print(f"Hour {i:2d} ({hour_est:02d}:00-{(hour_est+1)%24:02d}:00 EST): ${seg['pricePerHour']:3d}/hr | {rs['name']:30s}{grace_marker}")
    else:
        print(f"Hour {i:2d} ({hour_est:02d}:00-{(hour_est+1)%24:02d}:00 EST): ${seg['pricePerHour']:3d}/hr | DEFAULT_RATE")

print(f"\n{'-' * 90}")
print(f"TOTAL: ${result['totalPrice']} for {result['totalHours']} hours")
PYEOF
echo ""

# Step 11: Final Analysis
echo -e "${CYAN}========================================================================================================${NC}"
echo -e "${CYAN}                                        CRITICAL FINDINGS${NC}"
echo -e "${CYAN}========================================================================================================${NC}"
echo ""
echo -e "${MAGENTA}KEY CONFLICT RESOLUTION:${NC}"
echo ""
echo "$WALKIN_RESULT" | python3 << 'PYEOF'
import json, sys

result = json.load(sys.stdin)

# Find the critical conflict hours
hour3 = result['segments'][2]  # 10:00-11:00 AM EST (Hour 3)
hour7 = result['segments'][6]  # 2:00-3:00 PM EST (Hour 7)

print("10:00-11:00 AM EST (Hour 3): EventA ($100) vs EventB ($150)")
if hour3.get('ratesheet'):
    winner = hour3['ratesheet']['name']
    rate = hour3['pricePerHour']
    print(f"   → WINNER: {winner} at ${rate}/hr")
    if rate == 100:
        print("   → CONCLUSION: First created (EventA) wins! INSERTION ORDER is the rule.")
    elif rate == 150:
        print("   → CONCLUSION: Higher rate (EventB) wins! Rate-based logic detected.")
print()

print("2:00-3:00 PM EST (Hour 7): EventB ($150) vs EventC ($200)")
if hour7.get('ratesheet'):
    winner = hour7['ratesheet']['name']
    rate = hour7['pricePerHour']
    print(f"   → WINNER: {winner} at ${rate}/hr")
    if rate == 150:
        print("   → CONCLUSION: First created (EventB) wins! INSERTION ORDER is the rule.")
    elif rate == 200:
        print("   → CONCLUSION: Higher rate (EventC) wins! Rate-based logic detected.")
PYEOF
echo ""
echo -e "${MAGENTA}GRACE PERIOD BEHAVIOR:${NC}"
echo "  • Walk-ins: Grace period \$0/hr windows are SKIPPED (prevents exploitation)"
echo "  • Event Bookings: Grace period \$0/hr windows are INCLUDED (free setup/teardown)"
echo ""
echo -e "${GREEN}✓ Test completed successfully!${NC}"
echo -e "${CYAN}========================================================================================================${NC}"
