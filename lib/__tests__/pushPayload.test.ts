import {
  parseNewOrderPush,
  isOfferRenderable,
  toNumber,
  toText,
} from '@/lib/pushPayload';

// A realistic FCM data payload: every value is a string, because FCM data
// messages are Map<String,String>. This is the shape the backend will actually
// send from Android, and the one most likely to be got wrong.
const FCM_PAYLOAD = {
  type: 'NEW_DELIVERY_AVAILABLE',
  orderId: '77',
  externalOrderNo: 'ORD-2026-000077',
  restaurantId: '3',
  restaurantName: 'Osh Markazi',
  restaurantAddress: 'Amir Temur 1, Toshkent',
  restaurantLat: '41.3110810',
  restaurantLng: '69.2405620',
  deliveryAddress: 'Mustaqillik 15, kv 42',
  deliveryLat: '41.3200000',
  deliveryLng: '69.2500000',
  deliveryFee: '15000',
  tipAmount: '0',
  total: '85000',
  itemCount: '3',
  createdAt: '2026-09-16T10:02:11Z',
  expiresAt: '2026-09-16T10:03:11Z',
};

describe('toNumber', () => {
  it('reads FCM strings', () => {
    expect(toNumber('15000')).toBe(15000);
    expect(toNumber('41.311081')).toBeCloseTo(41.311081);
  });

  it('reads APNs native numbers', () => {
    expect(toNumber(15000)).toBe(15000);
  });

  // Number('') is 0 and Number('12abc') is NaN. A 0 would show a real order as
  // free; a NaN would render "NaN so'm" on the offer card. Both are worse than
  // showing nothing.
  it('never turns junk into 0 or NaN', () => {
    for (const bad of ['', '   ', 'abc', '12abc', null, undefined, {}, [], NaN, Infinity]) {
      expect(toNumber(bad)).toBeUndefined();
    }
  });
});

describe('toText', () => {
  it('treats an empty string as absent — FCM cannot send null', () => {
    expect(toText('')).toBeUndefined();
    expect(toText('   ')).toBeUndefined();
    expect(toText('Osh Markazi')).toBe('Osh Markazi');
  });
});

describe('parseNewOrderPush', () => {
  it('keeps every field of a full FCM payload', () => {
    const offer = parseNewOrderPush(FCM_PAYLOAD)!;
    expect(offer).toMatchObject({
      type: 'NEW_ORDER',
      orderId: 77,
      externalOrderNo: 'ORD-2026-000077',
      restaurantId: 3,
      restaurantName: 'Osh Markazi',
      deliveryFee: 15000,
      tipAmount: 0,
      total: 85000,
      itemCount: 3,
    });
    expect(offer.restaurantLat).toBeCloseTo(41.311081);
    expect(offer.deliveryLng).toBeCloseTo(69.25);
  });

  it('accepts an APNs payload with native JSON types', () => {
    const offer = parseNewOrderPush({
      orderId: 77,
      restaurantName: 'Osh Markazi',
      deliveryFee: 15000,
      itemCount: 3,
    })!;
    expect(offer.orderId).toBe(77);
    expect(offer.deliveryFee).toBe(15000);
  });

  it('accepts orderNumber as an alias for externalOrderNo', () => {
    const offer = parseNewOrderPush({ orderId: '77', orderNumber: 'ORD-77' })!;
    expect(offer.externalOrderNo).toBe('ORD-77');
  });

  // Without an order id there is nothing to accept, refetch or navigate to.
  it.each([
    [null],
    [undefined],
    [{}],
    [{ orderId: '' }],
    [{ orderId: 'abc' }],
    [{ orderId: '0' }],
    [{ orderId: '-3' }],
  ])('returns null for an unusable payload (%p)', (payload) => {
    expect(parseNewOrderPush(payload as any)).toBeNull();
  });

  it('leaves missing money undefined rather than 0', () => {
    const offer = parseNewOrderPush({ orderId: '77' })!;
    expect(offer.deliveryFee).toBeUndefined();
    expect(offer.total).toBeUndefined();
  });
});

describe('isOfferRenderable', () => {
  it('accepts a payload that can show a courier what they are accepting', () => {
    expect(isOfferRenderable(parseNewOrderPush(FCM_PAYLOAD)!)).toBe(true);
  });

  // The old handler built exactly this: id and name only, restaurantId 0,
  // itemCount 0, no money. The modal rendered, showing an empty card asking the
  // courier to accept a job with no stated pay.
  it('rejects an id-only payload, so the caller refetches instead', () => {
    expect(isOfferRenderable(parseNewOrderPush({ orderId: '77' })!)).toBe(false);
    expect(
      isOfferRenderable(parseNewOrderPush({ orderId: '77', restaurantName: 'Osh' })!)
    ).toBe(false);
  });

  it('rejects money with no place, and a place with no money', () => {
    expect(
      isOfferRenderable(parseNewOrderPush({ orderId: '77', deliveryFee: '15000' })!)
    ).toBe(false);
    expect(
      isOfferRenderable(
        parseNewOrderPush({ orderId: '77', restaurantName: 'Osh', deliveryFee: '0' })!
      )
    ).toBe(false);
  });
});
