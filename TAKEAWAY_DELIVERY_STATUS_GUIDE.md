# Takeaway & Delivery Order Status Workflow

## Status Words and Their Meanings

### 1. **awaiting_confirmation**
- **Display**: "Awaiting Confirmation"
- **When**: Order is placed and payment received, but not yet accepted by restaurant
- **Actions Available**: 
  - Accept Order (moves to `preparing`)
  - Cancel & Refund
- **Color**: Yellow (⚠️)

### 2. **preparing**
- **Display**: "Preparing"
- **When**: Order accepted and being prepared in kitchen
- **Actions Available**:
  - Mark Ready for Pickup (for takeaway → moves to `ready_for_pickup`)
  - Mark Out for Delivery (for delivery → moves to `out_for_delivery`)
  - Print KOT
- **Color**: Blue (🔵)

### 3. **ready_for_pickup**
- **Display**: "Ready for Pickup"
- **When**: Takeaway order is ready for customer pickup
- **Actions Available**:
  - Mark as Completed
- **Color**: Green (✅)

### 4. **out_for_delivery**
- **Display**: "Out for Delivery"
- **When**: Delivery order is on the way to customer
- **Actions Available**:
  - Mark as Completed
- **Color**: Purple (🟣)

### 5. **completed**
- **Display**: "Completed"
- **When**: Order fulfilled and finished
- **Actions Available**: None (final state)
- **Color**: Gray (⚫)

### 6. **cancelled**
- **Display**: "Cancelled"
- **When**: Order cancelled before or during preparation
- **Actions Available**: None (final state)
- **Color**: Red (🔴)

## Order Workflow

### Takeaway Orders
```
Payment Made
    ↓
awaiting_confirmation (Accept/Cancel)
    ↓
preparing (Print KOT, Mark Ready)
    ↓
ready_for_pickup (Mark Completed)
    ↓
completed
```

### Delivery Orders
```
Payment Made
    ↓
awaiting_confirmation (Accept/Cancel)
    ↓
preparing (Print KOT, Mark Out for Delivery)
    ↓
out_for_delivery (Mark Completed)
    ↓
completed
```

### Online Delivery Orders (e.g., Talabat, Careem)
```
Payment Made (by delivery partner)
    ↓
awaiting_confirmation (Accept/Cancel)
    ↓
preparing (Print KOT, Mark Out for Delivery)
    ↓
out_for_delivery (Mark Completed)
    ↓
completed
```

## Key Differences from Dine-In Orders

1. **Payment First**: Takeaway/Delivery orders are paid before acceptance
2. **Confirmation Required**: Must be explicitly accepted by restaurant
3. **Refund Option**: Can be cancelled with refund before acceptance
4. **No Table Assignment**: No table status management
5. **Different Final States**: 
   - Takeaway: `ready_for_pickup`
   - Delivery: `out_for_delivery`

## Component Usage

### TakeawayDeliveryOrderModal
Use for: `take_away`, `delivery`, `online_delivery` order types

### OrderDetailsModal
Use for: `dine_in` order types

## Implementation Files

### Backend
- `/srv/zaki/workspace/backend/src/routes/order.ts` - Updated status validation and order creation logic

### Frontend
- `/srv/zaki/workspace/frontend/src/components/TakeawayDeliveryOrderModal.tsx` - New modal component
- `/srv/zaki/workspace/frontend/src/pages/Orders.tsx` - Updated to use correct modal
- `/srv/zaki/workspace/frontend/src/lib/utils.ts` - Added formatStatus() and updated getStatusBadge()

## Next Steps (Refund Implementation)

To implement Thawani Pay refunds:

1. Create refund endpoint in backend
2. Call Thawani Pay refund API
3. Update order status to `cancelled`
4. Track refund status
5. Send confirmation to customer

The placeholder for refund logic is marked with:
```typescript
// TODO: Implement Thawani Pay refund logic here
```
in `TakeawayDeliveryOrderModal.tsx` → `handleCancelOrder()` function.
