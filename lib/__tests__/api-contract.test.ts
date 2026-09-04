import { API_ENDPOINTS } from '@/constants/config';

/**
 * Locks the endpoint table to the "Quick index" table at the end of
 * docs/COURIER_API_REFERENCE.md.
 *
 * These paths were wrong or missing in ways nothing could catch at runtime: a
 * misspelled path is a 404 that looks like an empty screen, and a missing one
 * gets hardcoded at the call site where it drifts unnoticed. This is a
 * transcription of the reference, so a failure here means either the app moved
 * or the backend did — both worth a human look.
 */
const P = '/api/v1';

describe('endpoint paths match COURIER_API_REFERENCE.md', () => {
  it('auth', () => {
    expect(API_ENDPOINTS.AUTH.PHONE_REQUEST_OTP).toBe(`${P}/auth/phone/request-otp`);
    expect(API_ENDPOINTS.AUTH.PHONE_VERIFY_OTP).toBe(`${P}/auth/phone/verify-otp`);
    expect(API_ENDPOINTS.AUTH.PHONE_COMPLETE_REGISTRATION).toBe(
      `${P}/auth/phone/complete-registration`
    );
    expect(API_ENDPOINTS.AUTH.PHONE_RESEND_OTP).toBe(`${P}/auth/phone/resend-otp`);
    expect(API_ENDPOINTS.AUTH.REFRESH).toBe(`${P}/auth/refresh`);
    expect(API_ENDPOINTS.AUTH.LOGOUT).toBe(`${P}/auth/logout`);
  });

  // Identity and work data are two different resources. Collapsing them is
  // called out in the reference as the most common mistake, and it is what hid
  // the courier's phone number: written to /users/me, only ever read back from
  // /couriers/me.
  it('keeps identity and courier profile separate', () => {
    expect(API_ENDPOINTS.USER.ME).toBe(`${P}/users/me`);
    expect(API_ENDPOINTS.COURIER.ME).toBe(`${P}/couriers/me`);
    expect(API_ENDPOINTS.USER.ME).not.toBe(API_ENDPOINTS.COURIER.ME);
  });

  it('courier', () => {
    expect(API_ENDPOINTS.COURIER.REGISTER).toBe(`${P}/couriers/register`);
    expect(API_ENDPOINTS.COURIER.UPDATE_STATUS).toBe(`${P}/couriers/me/status`);
    expect(API_ENDPOINTS.COURIER.UPDATE_LOCATION).toBe(`${P}/couriers/me/location`);
    expect(API_ENDPOINTS.COURIER.AVAILABLE_ORDERS).toBe(`${P}/couriers/me/available-orders`);
    expect(API_ENDPOINTS.COURIER.ACTIVE_ORDERS).toBe(`${P}/couriers/me/orders/active`);
    expect(API_ENDPOINTS.COURIER.ORDER_HISTORY).toBe(`${P}/couriers/me/orders/history`);
    expect(API_ENDPOINTS.COURIER.EARNINGS).toBe(`${P}/couriers/me/earnings`);
    expect(API_ENDPOINTS.COURIER.REVIEWS).toBe(`${P}/couriers/me/reviews`);
  });

  it('order transitions', () => {
    expect(API_ENDPOINTS.ORDERS.DETAIL(77)).toBe(`${P}/couriers/me/orders/77`);
    expect(API_ENDPOINTS.ORDERS.ACCEPT(77)).toBe(`${P}/couriers/me/orders/77/accept`);
    expect(API_ENDPOINTS.ORDERS.PICKUP(77)).toBe(`${P}/couriers/me/orders/77/pickup`);
    expect(API_ENDPOINTS.ORDERS.TRANSIT(77)).toBe(`${P}/couriers/me/orders/77/transit`);
    expect(API_ENDPOINTS.ORDERS.COMPLETE(77)).toBe(`${P}/couriers/me/orders/77/complete`);
    expect(API_ENDPOINTS.ORDERS.ISSUE(77)).toBe(`${P}/couriers/me/orders/77/issue`);
    expect(API_ENDPOINTS.ORDERS.RATING(77)).toBe(`${P}/couriers/me/orders/77/rating`);
  });

  it('push and notifications', () => {
    expect(API_ENDPOINTS.DEVICE_TOKENS.REGISTER).toBe(`${P}/device-tokens`);
    expect(API_ENDPOINTS.DEVICE_TOKENS.UNREGISTER).toBe(`${P}/device-tokens`);
    expect(API_ENDPOINTS.NOTIFICATIONS.LIST).toBe(`${P}/notifications/me`);
    expect(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT).toBe(`${P}/notifications/unread/count`);
    expect(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(5)).toBe(`${P}/notifications/5/read`);
  });

  // /auth/me is not in the reference. It was used for the courier's identity,
  // which belongs to /users/me.
  it('does not resurrect /auth/me', () => {
    expect(Object.values(API_ENDPOINTS.AUTH)).not.toContain(`${P}/auth/me`);
  });
});
