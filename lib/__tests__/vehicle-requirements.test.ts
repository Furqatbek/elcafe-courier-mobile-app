import {
  VEHICLE_TYPES,
  requiresLicense,
  requiresPlate,
  VehicleType,
} from '@/constants/config';
import { errorFromResponse, AppError } from '@/lib/errors';

const ALL_TYPES = Object.values(VEHICLE_TYPES) as VehicleType[];

describe('vehicle document requirements', () => {
  // The bug: registration demanded a driving licence and a number plate from
  // every applicant, so a courier on foot or on a bicycle could not register
  // without inventing both. Neither document exists for these vehicles.
  it.each([VEHICLE_TYPES.WALKING, VEHICLE_TYPES.BICYCLE, VEHICLE_TYPES.E_BIKE])(
    '%s requires neither a licence nor a plate',
    (type) => {
      expect(requiresLicense(type)).toBe(false);
      expect(requiresPlate(type)).toBe(false);
    }
  );

  it.each([VEHICLE_TYPES.MOTORCYCLE, VEHICLE_TYPES.CAR])(
    '%s requires both a licence and a plate',
    (type) => {
      expect(requiresLicense(type)).toBe(true);
      expect(requiresPlate(type)).toBe(true);
    }
  );

  // A new vehicle type added to VEHICLE_TYPES without a decision here would
  // silently default to "no documents required", which is the permissive
  // direction. Fail instead, so the choice is made deliberately.
  it('every known vehicle type is classified explicitly', () => {
    const classified = [
      VEHICLE_TYPES.WALKING,
      VEHICLE_TYPES.BICYCLE,
      VEHICLE_TYPES.E_BIKE,
      VEHICLE_TYPES.MOTORCYCLE,
      VEHICLE_TYPES.CAR,
    ];
    expect(ALL_TYPES.sort()).toEqual(classified.sort());
  });
});

describe('errorFromResponse', () => {
  const makeResponse = (status: number, body: string): Response =>
    ({ status, text: async () => body } as unknown as Response);

  it('keeps the server message and the status code', async () => {
    const err = await errorFromResponse(
      makeResponse(403, JSON.stringify({ message: 'Courier is not approved' })),
      'Failed to update courier status'
    );
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toContain('Courier is not approved');
    expect(err.message).toContain('403');
    expect(err.statusCode).toBe(403);
  });

  // The original code did `await response.json()` on every response. An HTML
  // error page from a gateway threw "JSON Parse error: Unexpected character",
  // which told the courier nothing about their request.
  it('does not throw on a non-JSON body, and reports the status', async () => {
    const err = await errorFromResponse(
      makeResponse(405, '<html><body>Method Not Allowed</body></html>'),
      'Failed to update courier status'
    );
    expect(err.message).toContain('405');
    expect(err.statusCode).toBe(405);
  });

  it('falls back to the status alone for an empty body', async () => {
    const err = await errorFromResponse(makeResponse(500, ''), 'Failed to load reviews');
    expect(err.message).toBe('Failed to load reviews: HTTP 500');
  });

  it('truncates a long non-JSON body instead of embedding a whole page', async () => {
    const err = await errorFromResponse(makeResponse(502, 'x'.repeat(5000)), 'Failed');
    expect(err.message.length).toBeLessThan(300);
  });

  it('survives a body that cannot be read at all', async () => {
    const broken = {
      status: 503,
      text: async () => {
        throw new Error('already consumed');
      },
    } as unknown as Response;
    const err = await errorFromResponse(broken, 'Failed');
    expect(err.message).toBe('Failed: HTTP 503');
  });
});
